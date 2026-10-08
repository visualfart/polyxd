/**
 * The tools' output schemas: JSON Schema (2020-12, the MCP default) for each tool's
 * `structuredContent`. The SDK checks every successful result against its tool's schema before it
 * is sent (Ajv in Node, @cfworker/json-schema in a Worker), and skips results with `isError: true`,
 * which may leave `structuredContent` out or give a different shape.
 *
 * Every root is `type: "object"`: on the 2025-11-25 wire a root of any other kind makes the SDK wrap
 * the result as `{result: ...}`. Plain data only, so the module runs unchanged in a Worker.
 */
import { PACKS } from "./packs.generated.ts";
import { componentDefinitions } from "./spec.ts";

const packNames = PACKS.map((p) => p.name);
const categories = [...new Set(componentDefinitions().map((c) => c.category))];
const severity = { type: "string", enum: ["error", "warning"], description: "\"error\" must be fixed before the document is shown; \"warning\" is advice." } as const;
const specVersion = { type: "string", description: "The version of the Polyxd spec this server implements, e.g. \"0.3.0\". Documents set it as their \"specVersion\"." } as const;

const issue = {
  type: "object",
  description: "One problem in the document.",
  properties: {
    severity,
    pointer: { type: "string", description: "JSON Pointer to the problem in the document, e.g. \"/components/2/label\"." },
    component: {
      type: "object",
      description: "The component the pointer is inside, when it is inside one.",
      properties: {
        id: { type: "string", description: "The component's id." },
        type: { type: "string", description: "The component's type (its \"component\" value), e.g. \"TextInput\"." },
      },
      additionalProperties: false,
    },
    message: { type: "string", description: "What is wrong." },
    hint: { type: "string", description: "What to change to fix it, when there is a known fix." },
  },
  required: ["severity", "pointer", "message"],
  additionalProperties: false,
} as const;

const counts = {
  errors: { type: "integer", minimum: 0, description: "How many errors. Fix every one before showing the document." },
  warnings: { type: "integer", minimum: 0, description: "How many warnings. Advice; they do not stop the document being shown." },
} as const;

export const guideOutput = {
  type: "object",
  properties: {
    specVersion,
    guide: {
      type: "string",
      description: "The instructions for writing a Polyxd UI document: how to use these tools, the document shape, the rules, bindings, actions, every component with its props, and the patterns. The same text as the result's text content.",
    },
  },
  required: ["specVersion", "guide"],
  additionalProperties: false,
} as const;

export const validateOutput = {
  type: "object",
  properties: {
    valid: { type: "boolean", description: "True when the document has no errors and can be shown. Warnings do not make it invalid." },
    ...counts,
    issues: { type: "array", items: issue, description: "Every error and warning, each at its JSON Pointer with a hint. Empty when the document is clean." },
  },
  required: ["valid", "errors", "warnings", "issues"],
  additionalProperties: false,
} as const;

export const verifyOutput = {
  type: "object",
  properties: {
    ...counts,
    findings: {
      type: "array",
      description: "Every check that failed. Empty when the document passes with no warnings.",
      items: {
        type: "object",
        properties: {
          severity,
          check: {
            type: "string",
            description: "The check that failed, e.g. \"spec\", \"data:missing-path\", \"pattern:<id>\", \"rule:<id>\", \"capability\" or \"load:inputs-per-view\".",
          },
          message: { type: "string", description: "What failed; findings from the spec validator start with the JSON Pointer, as \"<pointer>: <message>\"." },
          hint: { type: "string", description: "What to change to fix it, when there is a known fix." },
        },
        required: ["severity", "check", "message"],
        additionalProperties: false,
      },
    },
    direction: { type: "string", description: "The name of the Design Direction the document was held to, when one was given and it has a name." },
    rules: { type: "integer", minimum: 0, description: "How many Design Direction rules were checked. 0 without a direction." },
  },
  required: ["errors", "warnings", "findings", "rules"],
  additionalProperties: false,
} as const;

export const showOutput = {
  type: "object",
  description: "shown is true with the document, pack and spec version when the screen was shown; false with the issues when it was not (that result is also an error).",
  properties: {
    shown: { type: "boolean", description: "Whether the screen was shown to the user. False when the document has errors." },
    document: {
      type: "object",
      description: "The Polyxd UI document as shown, with the separately passed data merged in as its \"data\". The MCP App renders it.",
      additionalProperties: true,
    },
    pack: { type: "string", enum: packNames, description: "The design-system pack the screen is drawn in." },
    packName: { type: "string", description: "The pack's display name, e.g. \"Material 3\"." },
    mode: { type: "string", enum: ["light", "dark"], description: "Light or dark, when one was asked for. Absent: the screen follows the host's theme." },
    specVersion,
    issues: { type: "array", items: issue, description: "When not shown: the document's errors and warnings, each at its JSON Pointer with a hint." },
  },
  required: ["shown"],
  oneOf: [
    { properties: { shown: { const: true } }, required: ["document", "pack", "packName", "specVersion"] },
    { properties: { shown: { const: false } }, required: ["issues"] },
  ],
  additionalProperties: false,
} as const;

export const packsOutput = {
  type: "object",
  properties: {
    default: { type: "string", enum: packNames, description: "The pack polyxd_show uses when none is given." },
    packs: {
      type: "array",
      description: "Every pack, for polyxd_show's \"pack\" argument.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The pack's name: the value to pass as polyxd_show's \"pack\"." },
          displayName: { type: "string", description: "The name to show people, e.g. \"IBM Carbon\"." },
          template: { type: "boolean", description: "True for an original template to start from; false for a published design system." },
          package: { type: "string", description: "The npm package with the pack's design tokens." },
          description: { type: "string", description: "A one-line description of the pack." },
        },
        required: ["name", "displayName", "template", "package", "description"],
        additionalProperties: false,
      },
    },
  },
  required: ["default", "packs"],
  additionalProperties: false,
} as const;

const strings = (description: string) => ({ type: "array", items: { type: "string" }, description }) as const;
const category = { type: "string", description: `The component's kind: ${categories.join(", ")}.` } as const;

export const componentsOutput = {
  type: "object",
  description: "\"component\" when a name was given; \"components\" otherwise.",
  properties: {
    component: {
      type: "object",
      description: "One component's full definition.",
      properties: {
        name: { type: "string", description: "The component's type name, the value of \"component\" in a document, e.g. \"Choice\"." },
        category,
        summary: { type: "string", description: "What the component is for, in one line." },
        props: {
          type: "object",
          description: "Every prop, by name, as a JSON Schema. $refs point into the spec's common definitions (DynamicString, Binding, Options and so on).",
          additionalProperties: true,
        },
        required: strings("The props a document must set."),
        whenToUse: strings("When to use this component."),
        whenNotToUse: strings("When not to, and what to use instead."),
        shell: { type: "boolean", description: "True for shell components, which frame a product's screens: authored once per product, never generated." },
        rendering: strings("How renderers draw it."),
        accessibility: { type: "object", description: "Its accessible role and requirements.", additionalProperties: true },
        agent: { type: "string", description: "How an agent operating the rendered screen should use it." },
      },
      required: ["name", "category", "summary", "props", "required", "whenToUse", "whenNotToUse"],
      additionalProperties: true,
    },
    components: {
      type: "array",
      description: "Every component, in the spec's order.",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "The component's type name. Pass it back as \"name\" for the full definition." },
          category,
          summary: { type: "string", description: "What the component is for, in one line." },
          shell: { type: "boolean", description: "True for shell components: authored once per product, never generated. Use the others in generated screens." },
        },
        required: ["name", "category", "summary", "shell"],
        additionalProperties: false,
      },
    },
  },
  oneOf: [{ required: ["component"] }, { required: ["components"] }],
  additionalProperties: false,
} as const;

/** polyxd_docs: matching sections, one whole page, or the list of pages. */
export const docsOutput = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      description: "The sections that best match \"query\", best first.",
      items: {
        type: "object",
        properties: {
          page: { type: "string", description: "The page's slug, for \"page\"." },
          title: { type: "string", description: "The page's title." },
          heading: { type: "string", description: "The section's heading." },
          url: { type: "string", description: "The section on polyxd.com, to cite." },
          text: { type: "string", description: "The section's Markdown." },
        },
        required: ["page", "title", "heading", "url", "text"],
      },
    },
    page: {
      type: "object",
      description: "The page asked for with \"page\".",
      properties: {
        slug: { type: "string", description: "The page's path under /docs/, \"\" for the docs home." },
        title: { type: "string", description: "The page's title." },
        description: { type: "string", description: "A one-line summary of the page." },
        url: { type: "string", description: "The page on polyxd.com, to cite." },
        markdown: { type: "string", description: "The whole page as Markdown, links made absolute." },
      },
      required: ["slug", "title", "url", "markdown"],
    },
    pages: {
      type: "array",
      description: "Every docs page, when neither \"query\" nor \"page\" is given.",
      items: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The page's path under /docs/, for \"page\"." },
          title: { type: "string", description: "The page's title." },
          description: { type: "string", description: "A one-line summary of the page." },
          section: { type: "string", description: "The docs section it sits in, e.g. \"Start\" or \"Guides\"." },
          url: { type: "string", description: "The page on polyxd.com, to cite." },
        },
        required: ["slug", "title", "url"],
      },
    },
  },
} as const;
