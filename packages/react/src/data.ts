/** JSON Pointer helpers and binding resolution live in @polyxd/core; the renderer's modules import them from here. */
export { type Data, type Scope, ROOT_SCOPE, isBinding, absolute, childPointer, get, set, asList, resolve, resolveContext, resolveDeep } from "@polyxd/core";
