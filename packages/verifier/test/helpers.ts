import { readFileSync } from "node:fs";

export const examplesDir = new URL("../../spec/examples/", import.meta.url);
export const load = (name: string) => JSON.parse(readFileSync(new URL(`${name}.json`, examplesDir), "utf8"));
export const byId = (d: any, id: string) => d.components.find((c: any) => c.id === id);
export const registry = JSON.parse(readFileSync(new URL("registry/capabilities.json", examplesDir), "utf8"));
export const tasks: any[] = JSON.parse(readFileSync(new URL("../../../bench/tasks.json", import.meta.url), "utf8")).tasks;
