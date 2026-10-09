import { spawn } from 'node:child_process';
import path from 'node:path';

// The server refuses every unmocked API request, so this gate cannot write to production.
const port=process.env.QA_STATIC_PORT||'4173';
const server=spawn(process.execPath,['test/ux/serve-static.mjs'],{
 env:{...process.env,QA_STATIC_DIR:process.env.QA_STATIC_DIR||'.next-cloudflare-check',QA_STATIC_PORT:port},
 stdio:['ignore','pipe','inherit'],
});
let timeout;
try{
 await new Promise((resolve,reject)=>{
  timeout=setTimeout(()=>reject(new Error('QA static server did not start')),10000);
  server.stdout.once('data',resolve);
  server.once('error',reject);
  server.once('exit',code=>reject(new Error(`QA server exited: ${code}`)));
 });
 clearTimeout(timeout);
 const run=spawn(process.execPath,['test/ux/run.mjs'],{
  env:{...process.env,UX_BASE_URL:`http://127.0.0.1:${port}`,UX_EMAIL_LOGIN_ENABLED:process.env.UX_EMAIL_LOGIN_ENABLED||'false',
   UX_OUTPUT_DIR:process.env.UX_OUTPUT_DIR||path.resolve('../../test-results/ux-release')},
  stdio:'inherit',
 });
 process.exitCode=await new Promise((resolve,reject)=>{run.once('exit',code=>resolve(code??1));run.once('error',reject);});
}finally{clearTimeout(timeout);server.kill('SIGTERM');}
