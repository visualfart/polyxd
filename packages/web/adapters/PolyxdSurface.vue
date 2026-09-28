<script setup lang="ts">
/**
 * A Vue 3 wrapper around <polyxd-surface>. Copy this file into your project; the element does the
 * work, so the wrapper only forwards props and events. Import the stylesheet and a theme once:
 *   import "@polyxd/web/styles.css"; import "@polyxd/web/themes/material3.css";
 *
 * Tell Vue the tag is a custom element (vite.config: vue({ template: { compilerOptions:
 * { isCustomElement: (tag) => tag.startsWith("polyxd-") } } })).
 */
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { defineElements, type PolyxdSurfaceElement } from "@polyxd/web";
import type { ActionEvent, Data, SemanticEvent, SurfaceEventOptions, UIDocument } from "@polyxd/core";

defineElements();

const props = defineProps<{
  document: UIDocument;
  data?: Data;
  theme?: string;
  mode?: "light" | "dark";
  density?: "compact" | "comfortable" | "spacious";
  locale?: string;
  disclosure?: "progressive" | "show-everything";
  resolveMedia?: (ref: string) => string | undefined;
  derive?: (data: Data) => Data | void;
  components?: PolyxdSurfaceElement["components"];
  /** Semantic analytics events, off unless given, e.g. `:on-event="send"` with `const send = toPostHog(posthog)`. */
  onEvent?: (event: SemanticEvent) => void;
  events?: SurfaceEventOptions;
}>();
const emit = defineEmits<{ action: [event: ActionEvent]; datachange: [data: Data]; dismiss: [] }>();

const el = ref<PolyxdSurfaceElement | null>(null);
const onAction = (e: Event) => emit("action", (e as CustomEvent<ActionEvent>).detail);
const onDataChange = (e: Event) => emit("datachange", (e as CustomEvent<Data>).detail);
const onDismiss = () => emit("dismiss");

const apply = () => {
  const s = el.value;
  if (!s) return;
  s.document = props.document;
  s.data = props.data;
  s.resolveMedia = props.resolveMedia;
  s.derive = props.derive;
  s.components = props.components;
  s.events = props.events;
  s.onEvent = props.onEvent ?? null;
};

onMounted(() => {
  apply();
  el.value?.addEventListener("polyxd-action", onAction);
  el.value?.addEventListener("polyxd-datachange", onDataChange);
  el.value?.addEventListener("polyxd-dismiss", onDismiss);
});
watch(() => [props.document, props.data, props.resolveMedia, props.derive, props.components, props.onEvent, props.events], apply);
onBeforeUnmount(() => {
  el.value?.removeEventListener("polyxd-action", onAction);
  el.value?.removeEventListener("polyxd-datachange", onDataChange);
  el.value?.removeEventListener("polyxd-dismiss", onDismiss);
});
</script>

<template>
  <polyxd-surface ref="el" :theme="theme" :mode="mode" :density="density" :locale="locale" :disclosure="disclosure" />
</template>
