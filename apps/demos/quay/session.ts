import { createContext, useContext } from "react";
import { createStore, type Store, type Undo } from "../kit/store.ts";
import { seed, type Quay } from "./seed.ts";

/** Quay's data, kept in the browser. */
export const store: Store<Quay> = createStore("quay", 1, seed);

/** What every screen can reach. Lives apart from the components so hot reloads keep the context. */
export interface Session {
  h: Quay;
  store: Store<Quay>;
  mode: "light" | "dark";
  /** Open the command palette, optionally with text already typed. */
  ask: (text?: string) => void;
  /** Open an intent straight away (a button on a screen can be an ask in disguise). */
  open: (intentId: string, slots?: Record<string, unknown>) => void;
  say: (text: string, undo?: Undo) => void;
  /** An edit form with unsaved changes owns the contextual save bar in the top bar. */
  saveBar: (bar: SaveBar | null) => void;
}
export interface SaveBar { label: string; onSave: () => void; onDiscard: () => void; disabled?: boolean }
export const Ctx = createContext<Session>(null!);
export const useQuay = () => useContext(Ctx);
