// Keeps `pnpm audit` exceptions honest (#79).
// Every GHSA or CVE ID that appears in pnpm-workspace.yaml or package.json
// (where pnpm reads `auditConfig.ignoreGhsas` / `ignoreCves`) must have an entry
// in audit-exceptions.json, and every entry must be valid and unexpired.
// CI runs this before `pnpm audit`, and a daily workflow runs it on main, so an
// expired exception turns the build red even with no new pull requests.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// IDs are matched anywhere in the config text on purpose: a YAML or JSON layout
// we did not foresee (inline maps, comments, quoted keys, CRLF) cannot hide an
// ignore from this check.
const ID_PATTERN = /\b(?:GHSA(?:-[0-9a-z]{4}){3}|CVE-\d{4}-\d{4,})\b/gi;
export const MAX_WINDOW_DAYS = 90;

/** Returns the unique advisory IDs found in the given config texts, normalised. */
export function referencedIds(...texts) {
  const ids = new Set();
  for (const text of texts) {
    for (const match of text.match(ID_PATTERN) ?? []) ids.add(normaliseId(match));
  }
  return [...ids];
}

/** Canonical forms: `GHSA-xxxx-xxxx-xxxx` (lower-case segments) and `CVE-YYYY-NNNN`. */
export function normaliseId(id) {
  return /^ghsa-/i.test(id) ? `GHSA${id.slice(4).toLowerCase()}` : id.toUpperCase();
}

function isRealDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Returns a list of problems. An empty list means the exceptions are valid.
 * `ignored` holds the IDs found in the config files. `today` is a UTC ISO date.
 */
export function checkExceptions({ ignored, exceptions, today }) {
  const problems = [];
  const byId = new Map(exceptions.map((entry) => [normaliseId(entry.id ?? ''), entry]));
  for (const id of ignored) {
    if (!byId.has(id)) problems.push(`${id} appears in the pnpm config but has no entry in audit-exceptions.json`);
  }
  const latest = addDays(today, MAX_WINDOW_DAYS);
  for (const entry of exceptions) {
    const id = normaliseId(entry.id ?? '');
    if (!id) {
      problems.push('an entry has no id');
      continue;
    }
    if (!isRealDate(entry.expires)) {
      problems.push(`${id} has no valid expires date (a real YYYY-MM-DD date)`);
    } else if (entry.expires < today) {
      problems.push(`${id} exception expired on ${entry.expires}; ${entry.owner ?? 'the owner'} must re-assess it (${entry.ticket ?? 'no ticket'})`);
    } else if (entry.expires > latest) {
      problems.push(`${id} expires on ${entry.expires}, more than ${MAX_WINDOW_DAYS} days ahead (latest allowed ${latest})`);
    }
    if (!entry.reason) problems.push(`${id} has no reason`);
    if (!entry.owner) problems.push(`${id} has no owner who re-assesses it`);
    if (!ignored.includes(id)) problems.push(`${id} is in audit-exceptions.json but not ignored in the pnpm config; remove the stale entry`);
  }
  return problems;
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(here, '../..');
  const read = (file) => (existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), 'utf8') : '');
  const ignored = referencedIds(read('pnpm-workspace.yaml'), read('package.json'));
  const { exceptions } = JSON.parse(readFileSync(path.join(here, 'audit-exceptions.json'), 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const problems = checkExceptions({ ignored, exceptions, today });
  if (problems.length) {
    for (const problem of problems) console.error(`audit exception: ${problem}`);
    process.exitCode = 1;
    return;
  }
  const summary = exceptions.map((e) => `${normaliseId(e.id)} until ${e.expires} (owner ${e.owner})`).join(', ');
  console.log(`audit exceptions OK: ${summary || 'none'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
