const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('node:module').createRequire(path.resolve(__dirname, '../../../apps/web/package.json'))('typescript');
const source = fs.readFileSync(`${__dirname}/index.ts`, 'utf8').replace(/^import .*$/gm, '');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
 const calls=[];
 const ctx=vm.createContext({ createClient:()=>({rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}}), Deno:{env:{get:()=> 'test'},serve:()=>{}}, crypto:require('node:crypto').webcrypto,Response,Request,URL,TextEncoder,TextDecoder,console,setTimeout,clearTimeout,atob,btoa });
 vm.runInContext(js,ctx);
 return {calls, post:(event,properties={})=>ctx.handleAnalytics(new Request('https://test/analytics/events',{method:'POST',body:JSON.stringify({id:crypto.randomUUID(),deviceId:crypto.randomUUID(),sessionId:crypto.randomUUID(),event,path:'/onboarding',source:'direct',properties,occurredAt:new Date().toISOString()})}))};
}
for (const event of ['first_expense_prompt_viewed','first_expense_prompt_clicked','first_expense_prompt_skipped','first_expense_completed']) {
 test(`accepts and persists ${event}`,async()=>{const h=harness();assert.equal((await h.post(event)).status,204);assert.equal(h.calls.at(-1).args.p_event,event);});
}
test('accepts diagnostic codes but rejects free-form reasons',async()=>{
 const h=harness();assert.equal((await h.post('workflow_failed',{workflow:'expense',stage:'validation',reason:'invalid_amount'})).status,204);
 assert.equal((await h.post('workflow_failed',{reason:'private user input'})).status,400);
 assert.equal(h.calls.filter(c=>c.name==='record_product_event').length,1);
});
