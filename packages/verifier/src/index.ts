export { verifyDocument, score, DEFAULTS, type Report, type TargetReport, type VerifyOptions } from "./verify.ts";
export { staticAudit, type StaticOptions } from "./static.ts";
export { axeAudit, layoutAudit, type Finding } from "./rendered.ts";
export { runTask, type Task, type Step, type AgentResult } from "./agent.ts";
export { compare, signature, type Consistency } from "./consistency.ts";
export { launch, renderPage, HARNESSES, type RenderTarget, type RendererHarness } from "./browser.ts";
export { renderedFingerprint, compareFingerprints, type Fingerprint } from "./fingerprint.ts";
export { rewardFor, wiredCapabilities, probeActionable, coverageOf, type Reward, type RequestExpectation } from "./reward.ts";
