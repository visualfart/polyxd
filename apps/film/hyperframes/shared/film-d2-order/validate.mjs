import { readFileSync } from "node:fs";
import { validateDocument } from "@polyxd/spec";
const doc = JSON.parse(readFileSync(new URL("./order-status.json", import.meta.url), "utf8"));
console.log(validateDocument(doc));
