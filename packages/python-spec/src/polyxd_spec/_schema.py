"""JSON Schema validation that reports errors the way the TypeScript validator (Ajv) does.

The TypeScript validator runs Ajv with `allErrors` and `discriminator`. Two things follow that
plain `jsonschema` does differently, and both change which errors a document gets:

- `discriminator`: a component is checked only against the definition its `component` names,
  instead of against all 44 in a `oneOf`. So a missing label is reported at the label's object,
  not as "matches none of 44 schemas" on the component.
- A failed `oneOf` reports every branch's errors and then its own, flat, each at its own path.

Messages follow Ajv's wording, so the same document gets the same message in both languages.
"""

from __future__ import annotations

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from functools import cache
from typing import Any

from jsonschema import Draft202012Validator, ValidationError, validators
from referencing import Registry, Resource

from . import _data


@dataclass
class SchemaError:
    """One Ajv-style error: where (a JSON Pointer), which keyword, and Ajv's message."""

    at: str
    keyword: str
    message: str
    params: dict[str, Any] = field(default_factory=dict)
    instance: Any = None


def pointer(parts: Any) -> str:
    return "".join("/" + str(p).replace("~", "~0").replace("/", "~1") for p in parts)


def js_number(n: Any) -> str:
    """A number as JavaScript prints it: 1.0 is "1"."""
    if isinstance(n, float) and n.is_integer() and abs(n) < 1e21:
        return str(int(n))
    return str(n)


def json_equal(a: Any, b: Any) -> bool:
    """JSON equality: true and 1 differ, 1 and 1.0 don't."""
    if isinstance(a, bool) or isinstance(b, bool):
        return isinstance(a, bool) and isinstance(b, bool) and a == b
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a == b
    if isinstance(a, dict) and isinstance(b, dict):
        return a.keys() == b.keys() and all(json_equal(a[k], b[k]) for k in a)
    if isinstance(a, list) and isinstance(b, list):
        return len(a) == len(b) and all(json_equal(x, y) for x, y in zip(a, b))
    return type(a) is type(b) and a == b


@cache
def js_regex(pattern: str) -> re.Pattern[str]:
    """A schema pattern with JavaScript's meaning of `$`: the very end, not before a final newline."""
    out, in_class, i = [], False, 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "\\":
            out.append(pattern[i : i + 2])
            i += 2
            continue
        if ch == "[":
            in_class = True
        elif ch == "]":
            in_class = False
        elif ch == "$" and not in_class:
            ch = r"\Z"
        out.append(ch)
        i += 1
    return re.compile("".join(out))


def _error(message: str, keyword: str, **params: Any) -> ValidationError:
    e = ValidationError(message, validator=keyword)
    e.ajv_params = params  # type: ignore[attr-defined]
    return e


def _type(validator: Any, types: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    types = [types] if isinstance(types, str) else types
    if not any(validator.is_type(instance, t) for t in types):
        yield _error(f"must be {','.join(types)}", "type")


def _required(validator: Any, required: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if isinstance(instance, dict):
        for p in required:
            if p not in instance:
                yield _error(f"must have required property '{p}'", "required", missingProperty=p)


def _additional_properties(validator: Any, extra: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if not isinstance(instance, dict):
        return
    props = schema.get("properties", {})
    patterns = [js_regex(p) for p in schema.get("patternProperties", {})]
    for k in instance:
        if k in props or any(p.search(k) for p in patterns):
            continue
        if extra is False:
            yield _error("must NOT have additional properties", "additionalProperties", additionalProperty=k)
        elif isinstance(extra, dict):
            yield from validator.descend(instance[k], extra, path=k)


def _enum(validator: Any, allowed: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if not any(json_equal(instance, a) for a in allowed):
        yield _error("must be equal to one of the allowed values", "enum", allowedValues=allowed)


def _const(validator: Any, const: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if not json_equal(instance, const):
        yield _error("must be equal to constant", "const", allowedValue=const)


def _pattern(validator: Any, pattern: str, instance: Any, schema: Any) -> Iterator[ValidationError]:
    if isinstance(instance, str) and not js_regex(pattern).search(instance):
        yield _error(f'must match pattern "{pattern}"', "pattern", pattern=pattern)


def _bound(keyword: str, kind: str, test: Any, words: str) -> Any:
    def check(validator: Any, limit: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
        if kind == "array" and isinstance(instance, list):
            size = len(instance)
        elif kind == "string" and isinstance(instance, str):
            size = len(instance)
        elif kind == "number" and isinstance(instance, (int, float)) and not isinstance(instance, bool):
            size = instance
        else:
            return
        if not test(size, limit):
            yield _error(words.format(n=js_number(limit)), keyword, limit=limit)

    return check


def _branch_errors(validator: Any, branches: list[Any], instance: Any) -> tuple[int, list[ValidationError]]:
    passing, errors = 0, []
    for i, branch in enumerate(branches):
        errs = list(validator.descend(instance, branch, schema_path=i))
        if errs:
            errors.extend(errs)
        else:
            passing += 1
    return passing, errors


def _one_of(mappings: dict[int, tuple[str, dict[str, int]]]) -> Any:
    def one_of(validator: Any, branches: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
        discriminator = mappings.get(id(branches))
        if discriminator is not None:
            # Ajv's discriminator: only the branch the tag names is checked (objects only).
            if not isinstance(instance, dict):
                return
            tag_name, mapping = discriminator
            tag = instance.get(tag_name)
            if not isinstance(tag, str):
                yield _error(f'tag "{tag_name}" must be string', "discriminator", tag=tag, tagName=tag_name)
            elif tag not in mapping:
                yield _error(f'value of tag "{tag_name}" must be in oneOf', "discriminator", tag=tag, tagName=tag_name)
            else:
                i = mapping[tag]
                yield from validator.descend(instance, branches[i], schema_path=i)
            return
        passing, errors = _branch_errors(validator, branches, instance)
        if passing != 1:
            yield from errors
            yield _error("must match exactly one schema in oneOf", "oneOf")

    return one_of


def _any_of(validator: Any, branches: Any, instance: Any, schema: Any) -> Iterator[ValidationError]:
    errors: list[ValidationError] = []
    for i, branch in enumerate(branches):
        errs = list(validator.descend(instance, branch, schema_path=i))
        if not errs:
            return
        errors.extend(errs)
    yield from errors
    yield _error("must match a schema in anyOf", "anyOf")


def _discriminator_mappings(root: dict[str, Any], resources: dict[str, dict[str, Any]]) -> dict[int, tuple[str, dict[str, int]]]:
    """For each oneOf with a discriminator: the tag property and which branch each tag value picks."""
    out: dict[int, tuple[str, dict[str, int]]] = {}

    def resolve(ref: str, doc: dict[str, Any]) -> dict[str, Any]:
        base, _, frag = ref.partition("#")
        target = resources[base] if base else doc
        for part in frag.strip("/").split("/") if frag else []:
            target = target[part.replace("~1", "/").replace("~0", "~")]
        return target

    def walk(node: Any, doc: dict[str, Any]) -> None:
        if isinstance(node, dict):
            d = node.get("discriminator")
            if isinstance(d, dict) and isinstance(node.get("oneOf"), list):
                tag = d["propertyName"]
                mapping: dict[str, int] = {}
                for i, b in enumerate(node["oneOf"]):
                    s = resolve(b["$ref"], doc) if "$ref" in b else b
                    prop = s.get("properties", {}).get(tag, {})
                    for v in [prop["const"]] if "const" in prop else prop.get("enum", []):
                        mapping[v] = i
                out[id(node["oneOf"])] = (tag, mapping)
            for v in node.values():
                walk(v, doc)
        elif isinstance(node, list):
            for v in node:
                walk(v, doc)

    for doc in [root, *resources.values()]:
        walk(doc, doc)
    return out


_BOUNDS = {
    "minItems": ("array", lambda n, l: n >= l, "must NOT have fewer than {n} items"),
    "maxItems": ("array", lambda n, l: n <= l, "must NOT have more than {n} items"),
    "minLength": ("string", lambda n, l: n >= l, "must NOT have fewer than {n} characters"),
    "maxLength": ("string", lambda n, l: n <= l, "must NOT have more than {n} characters"),
    "minimum": ("number", lambda n, l: n >= l, "must be >= {n}"),
    "maximum": ("number", lambda n, l: n <= l, "must be <= {n}"),
    "exclusiveMinimum": ("number", lambda n, l: n > l, "must be > {n}"),
    "exclusiveMaximum": ("number", lambda n, l: n < l, "must be < {n}"),
}


@cache
def validator_for(name: str) -> Any:
    """A validator for schema/<name>.schema.json, with the other spec schemas available to $ref."""
    root = _data.schema(name)
    others = {_data.schema(n)["$id"]: _data.schema(n) for n in _data.schema_names() if n != name}
    registry = Registry().with_resources((uri, Resource.from_contents(s)) for uri, s in others.items())
    # Relative refs ("check.schema.json#/...") resolve against the $id's folder.
    base = root["$id"].rsplit("/", 1)[0] + "/"
    by_name = {**{uri.removeprefix(base): s for uri, s in others.items()}, **others}
    keywords = {
        "type": _type,
        "required": _required,
        "additionalProperties": _additional_properties,
        "enum": _enum,
        "const": _const,
        "pattern": _pattern,
        "oneOf": _one_of(_discriminator_mappings(root, by_name)),
        "anyOf": _any_of,
        **{k: _bound(k, kind, test, words) for k, (kind, test, words) in _BOUNDS.items()},
    }
    cls = validators.extend(Draft202012Validator, validators=keywords)
    return cls(root, registry=registry)


def schema_errors(name: str, instance: Any) -> list[SchemaError]:
    """Every error Ajv reports for `instance` against schema/<name>.schema.json, in document order."""
    out = []
    for e in validator_for(name).iter_errors(instance):
        out.append(SchemaError(pointer(e.absolute_path), str(e.validator), e.message, getattr(e, "ajv_params", {}), e.instance))
    return out
