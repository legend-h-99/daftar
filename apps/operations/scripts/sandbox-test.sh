#!/bin/sh
set -eu
# /source is a read-only, secret-free snapshot. All writes stay in bounded /tmp.
cp -R /source /tmp/work
cd /tmp/work
ln -s /deps/node_modules node_modules
ln -s /deps/apps/web/node_modules apps/web/node_modules
pnpm --filter web exec tsc --noEmit --incremental false
pnpm --filter web exec vitest run --configLoader runner
