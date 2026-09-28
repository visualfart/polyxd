/**
 * The preview panel's HTML: the chrome in the editor's colours (VS Code's --vscode-* variables),
 * the surface in the pack's. The script and the renderer bundle come from dist/webview/ through
 * webview URIs; a nonce and a content-security policy keep everything else out. There is no
 * 'unsafe-eval': the spec's validator in the renderer bundle is compiled ahead of time, so nothing
 * builds code from strings (test/bundle.test.ts checks the bundles, and the editor smoke test
 * renders under this policy and fails on any violation the page reports). The same page,
 * with a fake acquireVsCodeApi, is what scripts/build.ts writes as standalone.html for checking
 * the panel in a browser.
 */
export interface PageAssets {
  /** URIs the webview can load, as strings. */
  polyxdJs: string;
  polyxdCss: string;
  mainJs: string;
  cspSource: string;
  nonce: string;
  /** Script text run before everything else (the standalone page's fake API). */
  prelude?: string;
}

export function previewPage(a: PageAssets): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${a.cspSource} 'unsafe-inline'; script-src 'nonce-${a.nonce}'; img-src ${a.cspSource} data: https:; font-src ${a.cspSource} data:;">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Polyxd preview</title>
<link rel="stylesheet" href="${a.polyxdCss}">
<style id="packcss"></style>
<style>
  :root { --bg: var(--vscode-editor-background, #f4f4f6); --panel: var(--vscode-sideBar-background, #fff); --line: var(--vscode-panel-border, var(--vscode-widget-border, #dcdce2)); --ink: var(--vscode-foreground, #1c1c22); --muted: var(--vscode-descriptionForeground, #6a6a75); --accent: var(--vscode-focusBorder, #3554d1); }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body { font: var(--vscode-font-size, 13px)/1.45 var(--vscode-font-family, system-ui, sans-serif); color: var(--ink); background: var(--bg); display: flex; flex-direction: column; }
  body.log-closed .log-body { display: none; }
  button, select { font: inherit; color: inherit; }
  code, pre { font: 12px/1.5 var(--vscode-editor-font-family, ui-monospace, Menlo, monospace); }
  .bar { display: flex; align-items: center; gap: 10px; padding: 6px 10px; background: var(--panel); border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .bar label { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
  select { padding: 3px 6px; border: 1px solid var(--vscode-dropdown-border, var(--line)); border-radius: 4px; background: var(--vscode-dropdown-background, #fff); color: var(--vscode-dropdown-foreground, inherit); }
  .seg { display: inline-flex; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .seg button { border: 0; background: var(--vscode-button-secondaryBackground, transparent); color: var(--vscode-button-secondaryForeground, inherit); padding: 3px 9px; cursor: pointer; border-right: 1px solid var(--line); }
  .seg button:last-child { border-right: 0; }
  .seg button[aria-pressed="true"] { background: var(--vscode-button-background, #1c1c22); color: var(--vscode-button-foreground, #fff); }
  .px { color: var(--muted); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; min-width: 44px; }
  .file { color: var(--muted); font-size: 12px; padding: 3px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .file:empty { display: none; }
  .stage { flex: 1; overflow: auto; padding: 16px; display: flex; justify-content: center; align-items: flex-start; min-height: 0; }
  .frame { position: relative; flex: none; min-height: 60%; background: #fff; box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 0 0 1px var(--line); border-radius: 6px; }
  .frame .grip { position: absolute; top: 0; right: -14px; width: 10px; height: 100%; cursor: ew-resize; border-radius: 4px; }
  .frame .grip::after { content: ""; position: absolute; top: 50%; left: 3px; width: 4px; height: 36px; margin-top: -18px; border-radius: 2px; background: var(--vscode-scrollbarSlider-background, #c2c2cc); }
  .frame .grip:hover::after, .frame .grip.on::after, .frame .grip:focus-visible::after { background: var(--accent); }
  #surface { min-height: 200px; }
  .empty { padding: 40px 20px; color: var(--muted); text-align: center; }
  .pxd-outline { outline: 2px solid var(--accent) !important; outline-offset: 2px; border-radius: 2px; }
  .log { border-top: 1px solid var(--line); background: var(--panel); display: flex; flex-direction: column; max-height: 40%; }
  .log-head { display: flex; align-items: center; gap: 8px; padding: 4px 10px; }
  .log-head button { border: 0; background: none; cursor: pointer; padding: 2px 4px; color: var(--ink); }
  .log-head b { font-weight: 600; }
  .log-head .count { color: var(--muted); }
  .log-head .clear { margin-left: auto; color: var(--muted); }
  .log-body { overflow: auto; padding: 0 10px 8px; }
  .note { color: var(--muted); margin: 4px 0; }
  .action { padding: 6px 0; border-bottom: 1px solid var(--line); }
  .action .n { font-weight: 600; }
  .action .s { color: var(--muted); font-size: 12px; }
  .action pre { margin: 4px 0 0; white-space: pre-wrap; word-break: break-word; background: var(--vscode-textCodeBlock-background, #f6f6f8); border-radius: 4px; padding: 6px 8px; }
</style>
</head>
<body>
<header class="bar">
  <label>Pack <select id="theme" aria-label="Design-system pack"></select></label>
  <div class="seg" id="mode" role="group" aria-label="Mode"><button data-v="light">Light</button><button data-v="dark">Dark</button></div>
  <div class="seg" id="width" role="group" aria-label="Width"><button data-v="390">Phone</button><button data-v="820">Tablet</button><button data-v="1100">Desktop</button></div>
  <span id="widthpx" class="px">390px</span>
  <label>Density <select id="density" aria-label="Density"><option value="comfortable">comfortable</option><option value="compact">compact</option><option value="spacious">spacious</option></select></label>
</header>
<div class="file" id="file"></div>
<main class="stage" id="stage">
  <div class="frame" id="frame" style="width:390px">
    <div id="surface"><p class="empty">Open a Polyxd document to preview it.</p></div>
    <div class="grip" id="grip" title="Drag to resize" role="separator" aria-orientation="vertical" aria-label="Resize the surface"></div>
  </div>
</main>
<footer class="log" id="log">
  <div class="log-head">
    <button id="log-toggle" aria-expanded="true" aria-controls="log-body"><b>Actions</b> <span class="count" id="log-count"></span></button>
    <button id="log-clear" class="clear">Clear</button>
  </div>
  <div class="log-body" id="log-body"></div>
</footer>
${a.prelude ? `<script nonce="${a.nonce}">${a.prelude}</script>` : ""}
<script nonce="${a.nonce}" src="${a.polyxdJs}"></script>
<script nonce="${a.nonce}" src="${a.mainJs}"></script>
</body>
</html>`;
}
