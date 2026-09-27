import { createContext, useContext } from "react";
import { createStore, type Store, type Undo } from "../kit/store.ts";
import { seed, type Foundry } from "./seed.ts";

/** Foundry's data, kept in the browser. */
export const store: Store<Foundry> = createStore("foundry", 1, seed);

/** What every screen can reach. Lives apart from the components so hot reloads keep the context. */
export interface Session {
  h: Foundry;
  store: Store<Foundry>;
  mode: "light" | "dark";
  /** Open the command palette, optionally with text already typed. */
  ask: (text?: string) => void;
  /** Open an intent straight away (a button on a screen can be an ask in disguise). */
  open: (intentId: string, slots?: Record<string, unknown>) => void;
  say: (text: string, undo?: Undo) => void;
}
export const Ctx = createContext<Session>(null!);
export const useFoundry = () => useContext(Ctx);
