#!/usr/bin/env node
/**
 * The `polyxd` command.
 *
 *   polyxd pack ./tokens.css       make a design-system pack out of your own tokens
 *   polyxd check ./manifest.json   check a pack against the semantic token contract
 *   polyxd studio push ./ --to …   send your tokens to Polyxd Studio (from CI, with an API key)
 *
 * Three commands, because those are the things a team does before anything else works: point
 * Polyxd at their design system, find out what it still needs, and keep Studio in step with it.
 */
const [command, ...rest] = process.argv.slice(2);
process.argv = [process.argv[0], process.argv[1], ...rest];

switch (command) {
  case "pack":
    await import("./cli.ts");
    break;
  case "check": {
    // Through @polyxd/spec's published API: a relative path into the monorepo exists in a
    // checkout and nowhere else.
    const { checkDesignSystem } = await import("@polyxd/spec");
    const manifest = rest[0];
    if (!manifest) {
      console.log("usage: polyxd check <manifest.json>");
      process.exit(2);
    }
    const issues = await checkDesignSystem(manifest);
    for (const i of issues) console.log(`${i.mode ? `[${i.mode}] ` : ""}${i.token}: ${i.message}`);
    console.log(issues.length ? `\n${issues.length} issue(s)` : "Design system satisfies the semantic token contract.");
    process.exit(issues.length ? 1 : 0);
  }
  case "studio": {
    const { main } = await import("./studio.ts");
    process.exit(await main(rest));
  }
  case "dev": {
    // Stays up once it has started: the server and the watcher keep the process alive.
    const { main } = await import("./dev.ts");
    const code = await main(rest);
    if (code || rest.includes("--help") || rest.includes("-h")) process.exit(code);
    break;
  }
  default:
    console.log(`polyxd <command>

  pack <tokens.css> [--dark <dark.css>] [--name <name>] [--out <dir>]
      Reads your design system's variables and drafts a Polyxd pack, plus a mapping file
      recording every guess. Correct it, run again; it prints what is still missing and why.

  check <manifest.json>
      Checks a pack against the semantic token contract: every token present and correctly
      typed, every contrast pair measured, every constraint met.

  studio push <package dir | tarball | token file> --to <studio>/api/w/<workspace>
      Sends your tokens to Polyxd Studio as a new version of your design system, using an
      API key from POLYXD_STUDIO_KEY. Made for a CI step on every release.

  dev [dir] [--port 4310] [--theme material3] [--data <file.json>] [--pack <manifest.json|theme.css>] [--verify] [--open]
      Previews the documents in a folder as you edit them: rendered with the real renderer in
      any built-in pack or one of yours, light or dark, phone to desktop, with the static check,
      the document, its data and the actions it dispatches beside it. Reloads on save.`);
    process.exit(command ? 1 : 0);
}
