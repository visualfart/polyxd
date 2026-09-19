export { verifyDocument, score, DEFAULTS, type Report, type TargetReport, type VerifyOptions } from "./verify.ts";
export { staticAudit, type StaticOptions } from "./static.ts";
export { axeAudit, layoutAudit, type Finding } from "./rendered.ts";
export { runTask, type Task, type Step, type AgentResult } from "./agent.ts";
export { compare, signature, type Consistency } from "./consistency.ts";
export { launch, renderPage, type RenderTarget } from "./browser.ts";
