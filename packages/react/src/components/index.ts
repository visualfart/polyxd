import type { ComponentType } from "react";
import type { Node } from "../context.tsx";
import { Card, Columns, Disclosure, Group, Section, Views } from "./structure.tsx";
import { Split } from "./split.tsx";
import { AppBar, Custom, Footer, Frame, Outlet } from "./shell.tsx";
import { Collection, DetailList, Media, Metric, Status, Text } from "./content.tsx";
import { Table } from "./table.tsx";
import { Chart } from "./chart.tsx";
import { Choice, DateInput, Form, RangeInput, TextInput, Toggle } from "./inputs.tsx";
import { Action, Comparison, Confirm, Steps } from "./flow.tsx";
import { ActionBar } from "./action-bar.tsx";
import { FilterPanel } from "./filter.tsx";
import { Navigation } from "./navigation.tsx";
import { Tag, Identity, Progress, Rating, Code } from "./marks.tsx";
import { ActionMenu, Panel } from "./overlays.tsx";
import { FileInput, ColorInput, CodeInput } from "./pickers.tsx";
import { Tree } from "./tree.tsx";

export type ComponentRenderer = ComponentType<{ node: Node }>;

/**
 * The default adapter: Radix primitives styled by design-system tokens.
 * Other adapters (e.g. Astryx, see docs/decisions/0002) replace entries via PolyxdSurface's `components` prop.
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
