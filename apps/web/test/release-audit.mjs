// Gate the deployed web/PWA dependency graph. Native and legacy NestJS have
// separate release scopes; workspace findings are not silently declared fixed.
import { spawnSync } from 'node:child_process';
const scan = spawnSync('pnpm', ['audit', '--prod', '--json'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
let audit;
try { audit = JSON.parse(scan.stdout); } catch { throw new Error('Dependency audit could not complete'); }
if (scan.error || audit.error || !audit.metadata || !audit.advisories) throw new Error('Dependency audit unavailable');
const findings = Object.values(audit.advisories).filter(advisory =>
  advisory.findings.some(finding => finding.paths.some(path => path.startsWith('apps__web>'))));
const blocking = findings.filter(finding => ['high', 'critical'].includes(finding.severity));
console.log(JSON.stringify({ scope: 'web/PWA', findings: findings.map(f => ({
  module: f.module_name, severity: f.severity, advisory: f.url,
})), blocking: blocking.length }, null, 2));
if (blocking.length) process.exitCode = 1;
