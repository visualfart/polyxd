import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { connect } from "./helpers.ts";

let session: Awaited<ReturnType<typeof connect>>;
before(async () => (session = await connect()));
after(async () => session.close());

test("the server lists its ready-made prompts, each titled and described for a person", async () => {
  const { prompts } = await session.client.listPrompts();
  assert.deepEqual(prompts.map((p) => p.name).sort(), ["add-to-app", "as-screen", "compare", "screen"]);
  for (const p of prompts) {
    assert.match(p.name, /^[a-z]+(-[a-z]+)*$/);
    assert.ok(p.title && p.title.length > 5, `${p.name} has a title`);
    assert.ok((p.description ?? "").length > 40, `${p.name} has a description`);
  }
  const screen = prompts.find((p) => p.name === "screen")!;
  assert.deepEqual(screen.arguments?.map((a) => [a.name, a.required ?? false]), [["what", true], ["pack", false]]);
});

test("a prompt becomes one user message with what the person filled in", async () => {
  const r = await session.client.getPrompt({ name: "screen", arguments: { what: "split a $168 dinner between four friends", pack: "Carbon" } });
  assert.equal(r.messages.length, 1);
  assert.equal(r.messages[0].role, "user");
  const text = (r.messages[0].content as any).text as string;
  assert.match(text, /split a \$168 dinner between four friends/);
  assert.match(text, /Draw it in Carbon\./);
  assert.match(text, /Polyxd/);

  const bare = await session.client.getPrompt({ name: "as-screen", arguments: {} });
  assert.doesNotMatch((bare.messages[0].content as any).text, /Draw it in/);
});
