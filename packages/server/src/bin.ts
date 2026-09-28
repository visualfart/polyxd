#!/usr/bin/env node
/**
 * `npx @polyxd/server`: the generation server, configured from the environment. It prints where
 * it listens and one JSON line per request; `--help` lists the settings.
 */
import { configFromEnv, ConfigError, ENV_HELP } from "./config.ts";
import { createServer, VERSION } from "./server.ts";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  process.stdout.write(ENV_HELP);
  process.exit(0);
}
if (process.argv.includes("--version")) {
  process.stdout.write(`${VERSION}\n`);
  process.exit(0);
}

let config;
try {
  config = configFromEnv();
} catch (err) {
  if (!(err instanceof ConfigError)) throw err;
  process.stderr.write(`polyxd-server: ${err.message}\nRun with --help for every setting.\n`);
  process.exit(1);
}

const server = createServer(config.options);
server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  process.stdout.write(JSON.stringify({ listening: `http://${config.host}:${port}`, version: VERSION, provider: config.provider, model: config.model }) + "\n");
});

// Stop taking requests, let the ones in flight finish, and give up on them after ten seconds.
const stop = () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => {
    server.closeAllConnections();
    process.exit(0);
  }, 10_000).unref();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
