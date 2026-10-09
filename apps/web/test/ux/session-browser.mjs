// Exercise the deployed Worker source with real browser cookies and a synthetic
// upstream. Nothing in this harness can call production or Google.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const source=(await readFile('public/_worker.js','utf8')).replace('export default worker;','globalThis.worker=worker;');
const revoked=new Set();
let clockOffset=0;
const jwt=(sub,exp=Math.floor(Date.now()/1000)+3600,businessId=null)=>`${btoa('{"alg":"HS256"}')}.${btoa(JSON.stringify({sub,exp,businessId})).replace(/=/g,'')}.signature`;
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const upstream=async(url,options)=>{
 const endpoint=url.pathname.replace('/functions/v1/api','');
 if(endpoint==='/auth/google'){
  const body=JSON.parse(new TextDecoder().decode(options.body));
  return json({accessToken:jwt(body.credential),hasBusiness:false});
 }
 const bearer=options.headers.get('Authorization')?.slice(7);
 let claims;try{claims=JSON.parse(atob(bearer.split('.')[1]));}catch{return json({message:'Unauthorized'},401);}
 if(revoked.has(bearer)||claims.exp<=Date.now()/1000+clockOffset)return json({message:'Unauthorized'},401);
 if(endpoint==='/auth/logout'){revoked.add(bearer);return json({success:true});}
 if(endpoint==='/onboarding')return json({accessToken:jwt(claims.sub,undefined,'business-1'),business:{id:'business-1'}});
 if(endpoint==='/invoices/account-1'&&claims.sub!=='account-1')return json({message:'Forbidden'},403);
 return json({user:{id:claims.sub},businessId:claims.businessId});
};
const sandbox={URL,Headers,Request,Response,Date,atob,fetch:upstream};
runInNewContext(source,sandbox);
const server=createServer(async(req,res)=>{
 try{
  const origin=`http://127.0.0.1:${server.address().port}`;
  if(!req.url.startsWith('/api-proxy/')){res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Isolated session test</title>');return;}
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
  const request=new Request(origin+req.url,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})});
  const result=await sandbox.worker.fetch(request,{ASSETS:{fetch:()=>new Response('asset')}});
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Harness failure');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
const results=[];
const contexts=[];
const call=(page,endpoint,body)=>page.evaluate(async({endpoint,body})=>{
 const res=await fetch(`/api-proxy${endpoint}`,{method:body===undefined?'GET':'POST',credentials:'include',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:res.status,data:await res.json()};
},{endpoint,body});
try{
 const first=await browser.newContext();contexts.push(first);const page=await first.newPage();await page.goto(base);
 const login=await call(page,'/auth/google',{credential:'account-1'});
 assert.equal(login.status,200);assert.equal(login.data.sessionAuthenticated,true);assert.equal('accessToken' in login.data,false);
 const cookies=await first.cookies();const cookie=cookies.find(c=>c.name==='__Host-daftar_session');
 assert(cookie?.httpOnly&&cookie.secure&&cookie.sameSite==='Lax');assert.equal(await page.evaluate(()=>document.cookie),'');
 results.push('Login cookie is Secure, HttpOnly and SameSite=Lax; JSON and document.cookie expose no bearer');
 await page.reload();assert.equal((await call(page,'/auth/me')).data.user.id,'account-1');
 results.push('Session survives reload without JavaScript token storage');
 const previous=cookie.value;const onboarding=await call(page,'/onboarding',{name:'Synthetic business'});
 assert.equal(onboarding.data.sessionAuthenticated,true);assert.notEqual((await first.cookies())[0].value,previous);
 assert.equal((await call(page,'/auth/me')).data.businessId,'business-1');
 results.push('Onboarding rotates the cookie and updates business claims');
 const second=await browser.newContext();contexts.push(second);const other=await second.newPage();await other.goto(base);
 assert.equal((await call(other,'/auth/me')).status,401);await call(other,'/auth/google',{credential:'account-2'});
 assert.equal((await call(other,'/invoices/account-1')).status,403);assert.equal((await call(page,'/invoices/account-1')).status,200);
 results.push('Separate browser accounts cannot read another account resource (synthetic upstream)');
 await call(page,'/auth/logout',{});assert.equal((await first.cookies()).length,0);assert.equal((await call(page,'/auth/me')).status,401);
 results.push('Logout revokes upstream session and clears browser cookie');
 await call(page,'/auth/google',{credential:'account-1'});clockOffset=3601;
 assert.equal((await call(page,'/auth/me')).status,401);assert.equal((await first.cookies()).length,0);
 results.push('Expired bearer is denied and its cookie cleared');
 const out=path.resolve(process.env.UX_OUTPUT_DIR||'../../test-results/session-browser');await mkdir(out,{recursive:true});
 await writeFile(path.join(out,'results.json'),JSON.stringify({runAt:new Date().toISOString(),scope:'Exact Worker source + real Chromium cookie handling; synthetic upstream only',results},null,2));
 console.log(`${results.length} session browser checks passed; ${out}`);
}finally{await Promise.all(contexts.map(c=>c.close()));await browser.close();await new Promise(resolve=>server.close(resolve));}
