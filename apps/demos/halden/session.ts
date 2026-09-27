import { createContext, useContext } from "react";
import { createStore, type Store, type Undo } from "../kit/store.ts";
import { seed, type Halden } from "./seed.ts";

/** Halden's data, kept in the browser. */
export const store: Store<Halden> = createStore("halden", 1, seed);

/** What every screen can reach. Lives apart from the components so hot reloads keep the context. */
export interface Session {
  h: Halden;
  store: Store<Halden>;
  mode: "light" | "dark";
  /** Open the ask screen, optionally with text already typed. */
  ask: (text?: string) => void;
  /** Open an intent straight away (a button on a screen can be an ask in disguise). */
  open: (intentId: string, slots?: Record<string, unknown>) => void;
  say: (text: string, undo?: Undo) => void;
}
export const Ctx = createContext<Session>(null!);
export const useHalden = () => useContext(Ctx);
