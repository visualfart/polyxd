import type { ComponentType } from "react";
import type { Node } from "../context.tsx";
import { Card, Disclosure, Group, Section, Views } from "./structure.tsx";
import { Collection, DetailList, Media, Metric, Status, Table, Text } from "./content.tsx";
import { Chart } from "./chart.tsx";
import { Choice, DateInput, Form, RangeInput, TextInput, Toggle } from "./inputs.tsx";
import { Action, ActionBar, Comparison, Confirm, Steps } from "./flow.tsx";
import { FilterPanel } from "./filter.tsx";

export type ComponentRenderer = ComponentType<{ node: Node }>;

/**
 * The default adapter: Radix primitives styled by design-system tokens.
 * Other adapters (e.g. Astryx, see docs/decisions/0002) replace entries via PolyxdSurface's `components` prop.
 */
export const registry: Record<string, ComponentRenderer> = {
  Section, Group, Card, Disclosure, Views,
  Text, Metric, DetailList, Collection, Table, Chart, Media, Status,
  TextInput, Choice, Toggle, DateInput, RangeInput, Form,
  Action, ActionBar, Steps, Confirm, Comparison, FilterPanel,
};
