#!/usr/bin/env node
/**
 * The `polyxd` command.
 *
 *   polyxd pack ./tokens.css     make a design-system pack out of your own tokens
 *   polyxd check ./manifest.json check a pack against the semantic token contract
 *
 * Two commands, because those are the two things a team does before anything else works: point
 * Polyxd at their design system, and find out what it still needs.
 */
const [command, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], process.argv[1], ...rest];

switch (command) {
  case "pack":
    await import("./cli.ts");
    break;
  case "check":
    await import("../../spec/src/cli/check-design-system.ts");
    break;
  default:
    console.log(`polyxd <command>

  pack <tokens.css> [--dark <dark.css>] [--name <name>] [--out <dir>]
      Reads your design system's variables and drafts a Polyxd pack, plus a mapping file
      recording every guess. Correct it, run again; it prints what is still missing and why.

  check <manifest.json>
      Checks a pack against the semantic token contract: every token present and correctly
      typed, every contrast pair measured, every constraint met.`);
    process.exit(command ? 1 : 0);
}
