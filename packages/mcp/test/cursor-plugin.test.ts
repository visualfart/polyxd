/**
 * The Cursor plugin (plugins/polyxd, listed by .cursor-plugin/marketplace.json): valid for
 * Cursor's marketplace, and pointing at this server. Cursor's rules: a kebab-case name, relative
 * paths only, a committed logo, a README, and skills with name and description front matter.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const REPO = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, REPO), "utf8");
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

test("the Cursor plugin is listed by the marketplace manifest and has what Cursor's review asks for", () => {
  const market = JSON.parse(read(".cursor-plugin/marketplace.json"));
  assert.match(market.name, KEBAB);
  assert.ok(market.owner?.name);
  assert.equal(market.plugins.length, 1);
  const entry = market.plugins[0];
  const dir = `${entry.source}/`;
  const plugin = JSON.parse(read(`${dir}.cursor-plugin/plugin.json`));
  assert.equal(plugin.name, entry.name);
  assert.match(plugin.name, KEBAB);
  for (const key of ["logo", "skills", "rules", "mcpServers"]) {
    assert.ok(!plugin[key].startsWith("/") && !plugin[key].includes(".."), `${key} is relative`);
    assert.ok(existsSync(new URL(`${dir}${plugin[key]}`, REPO)), `${key} exists`);
  }
  assert.ok(existsSync(new URL(`${dir}README.md`, REPO)));
});

test("the plugin connects to the hosted server, and its skills and rule are well formed", () => {
  const dir = "plugins/polyxd/";
  assert.deepEqual(JSON.parse(read(`${dir}mcp.json`)), { mcpServers: { polyxd: { url: "https://mcp.polyxd.com/mcp" } } });
  const skills = readdirSync(new URL(`${dir}skills/`, REPO));
  assert.ok(skills.length >= 2);
  for (const s of skills) {
    const md = read(`${dir}skills/${s}/SKILL.md`);
    const fm = /^---\nname: (.+)\ndescription: (.+)\n---\n/.exec(md);
    assert.ok(fm, `${s} has name and description front matter`);
    assert.equal(fm![1], s, "the skill's name is its folder");
    assert.match(fm![1], KEBAB);
    assert.ok(fm![2].length > 60, `${s} says when to use it`);
  }
  for (const r of readdirSync(new URL(`${dir}rules/`, REPO))) assert.match(read(`${dir}rules/${r}`), /^---\ndescription: .+\nalwaysApply: (true|false)\n---\n/, r);
  // Every tool a skill names is one the server has.
  const tools = new Set(read("packages/mcp/src/server.ts").match(/"polyxd_[a-z]+"/g)!.map((t) => t.slice(1, -1)));
  for (const s of skills) for (const t of read(`${dir}skills/${s}/SKILL.md`).match(/polyxd_[a-z]+/g) ?? []) assert.ok(tools.has(t), `${s} names ${t}, which the server has`);
});

test("the same plugin installs in Claude Code: a marketplace at the repo root, the hosted server, the skills folder", () => {
  const market = JSON.parse(read(".claude-plugin/marketplace.json"));
  assert.equal(market.name, "polyxd");
  assert.ok(market.owner?.name);
  assert.equal(market.plugins.length, 1);
  const entry = market.plugins[0];
  assert.match(entry.source, /^\.\//, "a relative source");
  const dir = `${entry.source.slice(2)}/`;
  const plugin = JSON.parse(read(`${dir}.claude-plugin/plugin.json`));
  assert.equal(plugin.name, entry.name);
  assert.deepEqual(plugin.mcpServers, { polyxd: { type: "http", url: "https://mcp.polyxd.com/mcp" } });
  assert.equal(plugin.version, JSON.parse(read("packages/mcp/package.json")).version, "the plugin's version moves with the packages");
  assert.ok(existsSync(new URL(`${dir}skills/`, REPO)), "Claude Code finds skills/ by convention");
});
