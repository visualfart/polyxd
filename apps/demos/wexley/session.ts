import { createContext, useContext } from "react";
import { createStore, type Store, type Undo } from "../kit/store.ts";
import { seed, type Wexley } from "./seed.ts";

/** Wexley's data, kept in the browser. */
export const store: Store<Wexley> = createStore("wexley", 1, seed);

/** What every screen can reach. Lives apart from the components so hot reloads keep the context. */
export interface Session {
  w: Wexley;
  store: Store<Wexley>;
  /** Go to the ask page, optionally with text already typed. */
  ask: (text?: string) => void;
  /** Open an intent as a page straight away (a button on a screen can be an ask in disguise). */
  open: (intentId: string, slots?: Record<string, unknown>) => void;
  /** Show a notification banner at the top of the next page; with an undo handle it offers Undo. */
  say: (text: string, undo?: Undo, title?: string) => void;
}
export const Ctx = createContext<Session>(null!);
export const useWexley = () => useContext(Ctx);
