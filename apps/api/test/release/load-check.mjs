// Bounded arrival-rate exercise on the explicitly verified preview branch.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base = process.env.DAFTAR_QA_API;
assert.equal(base, 'https://ymbkhhsberlweckijuzm.supabase.co/functions/v1/api');
const seed = JSON.parse(await fs.readFile(process.env.DAFTAR_QA_SEED_FILE, 'utf8'));
const auth = await fetch(`${base}/auth/email/login?forceFunctionRegion=ap-southeast-1`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `${seed.run}-a@example.invalid`, password: seed.password }),
});
assert.equal(auth.status, 200);
const { accessToken } = await auth.json();
const endpoints = ['/dashboard/summary?month=2026-10', '/materials', '/invoices', '/expenses', '/customers'];
const results = [];
let active = 0, peak = 0;
const started = performance.now();
async function request(index) {
  const path = endpoints[index % endpoints.length];
  active++; peak = Math.max(peak, active);
  const start = performance.now();
  try {
    const response = await fetch(`${base}${path}${path.includes('?') ? '&' : '?'}forceFunctionRegion=ap-southeast-1`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15000),
    });
    await response.text();
    results.push({ status: response.status, durationMs: Math.round(performance.now() - start), path });
  } catch {
    results.push({ status: 0, durationMs: Math.round(performance.now() - start), path });
  } finally { active--; }
}
const pending = [];
// 60 scheduled requests in 60 seconds, plus a burst of ten. This stays
// below the normal 100/minute cap; it is not a production capacity claim.
for (let i = 0; i < 60; i++) {
  await new Promise(resolve => setTimeout(resolve, Math.max(0, started + i * 1000 - performance.now())));
  pending.push(request(i));
}
await Promise.all(pending);
await Promise.all(Array.from({ length: 10 }, (_, i) => request(i)));
const latency = results.map(r => r.durationMs).sort((a, b) => a - b);
const percentile = p => latency[Math.ceil(latency.length * p) - 1];
const errors = results.filter(r => r.status !== 200).length;
const report = { scope: '70 requests, 1 arrival/sec then a 10-request burst; small synthetic dataset',
  requests: results.length, peakConcurrency: peak, errors,
  p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99),
  elapsedMs: Math.round(performance.now() - started), proposedP95LimitMs: 3000,
  passed: errors === 0 && percentile(0.95) <= 3000, results };
await fs.writeFile(process.env.DAFTAR_QA_RESULT_FILE || '/tmp/daftar-load-results.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: undefined }));
if (!report.passed) process.exitCode = 1;
