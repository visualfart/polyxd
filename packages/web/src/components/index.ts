import type { Node } from "@polyxd/core";
import type { VChild } from "../dom.ts";
import type { Ctx } from "../renderer.ts";
import { Card, Columns, Disclosure, Group, Section, Views } from "./structure.ts";
import { Split } from "./split.ts";
import { AppBar, Custom, Footer, Frame, Outlet } from "./shell.ts";
import { Collection, DetailList, Media, Metric, Status, Text } from "./content.ts";
import { Table } from "./table.ts";
import { Chart } from "./chart.ts";
import { Choice, DateInput, Form, RangeInput, TextInput, Toggle } from "./inputs.ts";
import { Action, Comparison, Confirm, Steps } from "./flow.ts";
import { ActionBar } from "./action-bar.ts";
import { FilterPanel } from "./filter.ts";
import { Navigation } from "./navigation.ts";
import { Code, Identity, Progress, Rating, Tag } from "./marks.ts";
import { ActionMenu, Panel } from "./overlays.ts";
import { CodeInput, ColorInput, FileInput } from "./pickers.ts";
import { Tree } from "./tree.ts";

/** A component renderer: the document node and the context it renders in, to a description of elements (or an element). */
export type ComponentRenderer = (node: Node, ctx: Ctx) => VChild | Element;

/**
 * The default adapter: native DOM and ARIA, styled by design-system tokens, the same structure
 * and classes as @polyxd/react's. Replace entries through the `components` property.
 */
export const registry: Record<string, ComponentRenderer> = {
  Section, Group, Card, Disclosure, Views, Navigation,
  Text, Metric, DetailList, Collection, Table, Chart, Media, Status,
  TextInput, Choice, Toggle, DateInput, RangeInput, Form,
  Action, ActionBar, Steps, Confirm, Comparison, FilterPanel,
  Tag, Identity, Progress, Rating, Code, Tree, ActionMenu, Panel, FileInput, ColorInput, CodeInput,
  Columns, Split,
  // The shell (spec 0.3): the product's frame around its screens.
  Frame, AppBar, Footer, Outlet, Custom,
};
