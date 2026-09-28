# syntax=docker/dockerfile:1
#
# The Polyxd generation server, @polyxd/server. Build it from the repository root:
#
#   docker build -f packages/server/Dockerfile -t polyxd-server .
#   docker run --rm -p 8080:8080 -e POLYXD_PROVIDER=anthropic -e ANTHROPIC_API_KEY polyxd-server
#
# Three stages. `build` compiles the packages the server needs from this repository and packs
# them as npm would publish them. `deps` installs those tarballs the way `npm install
# @polyxd/server` would: production dependencies only, so no Playwright and no browser. The
# image is that and Node, run as the unprivileged `node` user.

FROM node:26-slim AS build
WORKDIR /repo
# .dockerignore lets through only the manifests, the lockfile and the packages the server needs.
COPY . .
# The verifier's own dev dependencies come too: compiling it needs Playwright's types.
RUN npm ci --workspace @polyxd/server --workspace @polyxd/verifier --include-workspace-root --ignore-scripts --no-audit --no-fund
# Spec first, on its own: see the note in .github/workflows/ci.yml.
RUN npx tsc -b packages/spec && npx tsc -b packages/server
RUN mkdir /packs && for p in spec core verifier runtime server; do \
      cp LICENSE NOTICE "packages/$p/" && \
      (cd "packages/$p" && npm pack --ignore-scripts --pack-destination /packs > /dev/null) || exit 1; \
    done

FROM node:26-slim AS deps
WORKDIR /app
COPY --from=build /packs /packs
RUN npm init -y > /dev/null && npm install --omit=dev --ignore-scripts --no-audit --no-fund /packs/*.tgz

FROM node:26-slim
LABEL org.opencontainers.image.title="polyxd-server" \
      org.opencontainers.image.description="Polyxd generation server: an HTTP API with streaming around @polyxd/runtime" \
      org.opencontainers.image.source="https://github.com/visualfart/polyxd" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY LICENSE NOTICE ./
# Owned by root and read-only to the server: it can't change its own code.
COPY --from=deps /app/node_modules ./node_modules
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["node", "/app/node_modules/@polyxd/server/dist/bin.js"]
