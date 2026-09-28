/**
 * The spec as instructions for the host's model. Everything the server says about writing a
 * document lives in this module.
 *
 * The generator prompt itself is not written here: it is the one the demos build from the spec
 * (apps/demos/scripts/build-prompt.ts), copied byte for byte into prompt.generated.ts by
 * `npm run sync -w @polyxd/mcp` and checked for drift by the tests. When a package owns that
 * prompt, this import is the one line to change.
 */
import { SPEC_VERSION, SYSTEM_PROMPT } from "./prompt.generated.ts";
import { PACKS } from "./packs.generated.ts";

export { SPEC_VERSION, SYSTEM_PROMPT };

/** How to use this server's tools, for a model that has the generator prompt above. */
export const MCP_NOTES = `How this works over MCP

You are the generator. Write the Polyxd UI document yourself, following the prompt below, and pass it to the tools as the "document" argument instead of writing JSON into the chat.

1. Write the document. Put the values the screen shows in "data" (the polyxd_show and polyxd_validate tools take it as a separate "data" argument, or inside the document). Take those values from the conversation or from other tools' results; never make figures up.
2. Call polyxd_validate. Fix every error at the JSON Pointer it gives, then validate again. Warnings are advice.
3. Optionally call polyxd_verify for the verifier's document checks, with a Design Direction if the user has one.
4. Call polyxd_show to put the screen in front of the user. It validates first and shows nothing if there are errors. Pick a design-system pack with "pack" (default material3; polyxd_packs lists them).

Actions: nobody has registered capabilities with this server, so rule 3's "capabilities listed" means the action names you choose. Name each action for what you will do when it arrives, as "domain.verb" (for example "task.save" or "booking.cancel"). When the user presses an action in the shown screen, you receive a chat message from the user naming the action, the button's label and the action's context with the values the user entered. Act on it as if the user had asked in words. "ui.dismiss" (closing the screen) arrives the same way.

Use polyxd_components for any component's full definition, and read the example documents (resources polyxd://examples/...) for complete, valid documents.`;

/** The whole guide: how to use the tools, then the generator prompt. */
export function guide(): string {
  const packs = PACKS.map((p) => p.name).join(", ");
  return `${MCP_NOTES}\n\nPacks: ${packs}.\n\n---\n\n${SYSTEM_PROMPT}`;
}
