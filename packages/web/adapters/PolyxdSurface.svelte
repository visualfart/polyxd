<script lang="ts">
  /**
   * A Svelte 5 wrapper around <polyxd-surface>. Copy this file into your project; the element does
   * the work, so the wrapper only forwards props and events. Import the stylesheet and a theme once:
   *   import "@polyxd/web/styles.css"; import "@polyxd/web/themes/material3.css";
   */
  import { defineElements, type PolyxdSurfaceElement } from "@polyxd/web";
  import type { ActionEvent, Data, SemanticEvent, SurfaceEventOptions, UIDocument } from "@polyxd/core";

  defineElements();

  let {
    document,
    data,
    theme,
    mode,
    density,
    locale,
    disclosure,
    resolveMedia,
    derive,
    components,
    onaction,
    ondatachange,
    ondismiss,
    onevent,
    events,
  }: {
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
    onaction?: (event: ActionEvent) => void;
    ondatachange?: (data: Data) => void;
    ondismiss?: () => void;
    /** Semantic analytics events, off unless given. */
    onevent?: (event: SemanticEvent) => void;
    events?: SurfaceEventOptions;
  } = $props();

  let el: PolyxdSurfaceElement | undefined = $state();

  // Object-valued props go through properties; the string ones are attributes in the markup below.
  $effect(() => {
    if (!el) return;
    el.document = document;
    el.data = data;
    el.resolveMedia = resolveMedia;
    el.derive = derive;
    el.components = components;
    el.events = events;
    el.onEvent = onevent ?? null;
  });
</script>

<polyxd-surface
  bind:this={el}
  {theme}
  {mode}
  {density}
  {locale}
  {disclosure}
  onpolyxd-action={(e: CustomEvent<ActionEvent>) => onaction?.(e.detail)}
  onpolyxd-datachange={(e: CustomEvent<Data>) => ondatachange?.(e.detail)}
  onpolyxd-dismiss={() => ondismiss?.()}
></polyxd-surface>
