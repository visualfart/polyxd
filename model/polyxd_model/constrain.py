"""JSON-schema-constrained decoding for mlx-lm via llguidance.

llguidance computes the set of allowed next tokens lazily at each step, so a large schema costs
nothing up front (unlike approaches that precompile the whole schema into a token index). It plugs
into mlx-lm as a logits processor: disallowed tokens get -inf before sampling.
"""

from __future__ import annotations

import json
import time

import llguidance
import llguidance.hf
import llguidance.numpy as llnp
import mlx.core as mx
import numpy as np

_tokenizers: dict[int, llguidance.LLTokenizer] = {}


def ll_tokenizer(tokenizer) -> llguidance.LLTokenizer:
    """llguidance's view of an mlx-lm tokenizer (cached per tokenizer)."""
    hf = getattr(tokenizer, "_tokenizer", tokenizer)
    key = id(hf)
    if key not in _tokenizers:
        _tokenizers[key] = llguidance.hf.from_tokenizer(hf)
    return _tokenizers[key]


class SchemaConstraint:
    """A logits processor that only allows tokens keeping the output valid against a JSON Schema."""

    def __init__(self, tokenizer, schema: dict | str):
        self.lltok = ll_tokenizer(tokenizer)
        schema_text = schema if isinstance(schema, str) else json.dumps(schema)
        # Every oneOf in the Polyxd schema has mutually exclusive branches (string vs {path}, list vs
        # object, or a distinct "component" const), so anyOf accepts exactly the same documents.
        grammar = llguidance.LLMatcher.grammar_from_json_schema(schema_text, defaults={"whitespace_flexible": False, "coerce_one_of": True})
        self.matcher = llguidance.LLMatcher(self.lltok, grammar)
        if self.matcher.is_error():
            raise ValueError(f"llguidance rejected the schema: {self.matcher.get_error()}")
        self.bitmask = llnp.allocate_token_bitmask(1, self.lltok.vocab_size)
        self.prompt_len: int | None = None
        self.mask_time = 0.0

    def __call__(self, tokens: mx.array, logits: mx.array) -> mx.array:
        start = time.perf_counter()
        if self.prompt_len is None:
            self.prompt_len = tokens.size
        else:
            # The token sampled last step: advance the grammar state.
            self.matcher.consume_token(int(tokens[-1].item()))
        llnp.fill_next_token_bitmask(self.matcher, self.bitmask, 0)
        allowed = np.unpackbits(self.bitmask.view(np.uint8), bitorder="little")[: self.lltok.vocab_size].astype(bool)
        width = logits.shape[-1]
        if width > allowed.size:
            allowed = np.concatenate([allowed, np.zeros(width - allowed.size, dtype=bool)])
        out = mx.where(mx.array(allowed[:width]), logits, mx.array(-float("inf"), dtype=logits.dtype))
        self.mask_time += time.perf_counter() - start
        return out
