// Keeps `pnpm audit` exceptions honest (#79).
// Every GHSA in pnpm-workspace.yaml `auditConfig.ignoreGhsas` must have an entry
// in audit-exceptions.json, and every entry must be unexpired. CI runs this
// before `pnpm audit`, so an expired exception turns the build red.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const GHSA_PATTERN = /GHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}/g;

/** Returns the GHSA IDs listed under `auditConfig.ignoreGhsas` in workspace YAML text. */
export function ignoredGhsas(workspaceYaml) {
  const block = workspaceYaml.match(/^auditConfig:\s*\n((?:[ \t]+.*\n?)*)/m);
  if (!block) return [];
  return [...new Set(block[1].match(GHSA_PATTERN) ?? [])];
}

/**
 * Returns a list of problems. An empty list means the exceptions are valid.
 * `today` is an ISO date string (YYYY-MM-DD).
 */
export function checkExceptions({ ignored, exceptions, today }) {
  const problems = [];
  const byId = new Map(exceptions.map((entry) => [entry.ghsa, entry]));
  for (const id of ignored) {
    if (!byId.has(id)) problems.push(`${id} is ignored in pnpm-workspace.yaml but has no entry in audit-exceptions.json`);
  }
  for (const entry of exceptions) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
      problems.push(`${entry.ghsa} has no valid expires date (YYYY-MM-DD)`);
    } else if (entry.expires < today) {
      problems.push(`${entry.ghsa} exception expired on ${entry.expires}; re-assess it (${entry.ticket ?? 'no ticket'})`);
    }
    if (!entry.reason) problems.push(`${entry.ghsa} has no reason`);
    if (!ignored.includes(entry.ghsa)) problems.push(`${entry.ghsa} is in audit-exceptions.json but not ignored in pnpm-workspace.yaml; remove the stale entry`);
  }
  return problems;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '../..');
  const ignored = ignoredGhsas(readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8'));
  const { exceptions } = JSON.parse(readFileSync(path.join(here, 'audit-exceptions.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const problems = checkExceptions({ ignored, exceptions, today });
  if (problems.length) {
    for (const problem of problems) console.error(`audit exception: ${problem}`);
    process.exitCode = 1;
    return;
  }
  console.log(`audit exceptions OK: ${exceptions.map((e) => `${e.ghsa} until ${e.expires}`).join(', ') || 'none'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
