// Isolated browser against the exact release assets. Every request is intercepted;
// no production, Google or analytics network calls can leave this context.
import { chromium } from 'playwright';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.env.QA_STATIC_DIR||'.next-behavior-release');
const origin='https://daftar1.com';
const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{});
const context=await browser.newContext({viewport:{width:390,height:844}});
const events=[];let loginAttempts=0;
await context.addCookies([{name:'__Host-daftar_session',value:'synthetic-cookie',url:origin,secure:true,httpOnly:true,sameSite:'Lax'}]);
await context.addInitScript(()=>{
 let callback;window.google={accounts:{id:{initialize(config){callback=config.callback},renderButton(parent){const b=document.createElement('button');b.textContent='Google';b.onclick=()=>callback({credential:'synthetic-never-sent'});parent.appendChild(b);}}}};
});
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.txt':'text/plain','.json':'application/json','.woff2':'font/woff2','.svg':'image/svg+xml'};
await context.route('**/*',async route=>{
 const req=route.request();const url=new URL(req.url());
 if(url.origin!==origin)return route.fulfill({status:204,body:''});
 if(url.pathname==='/api-proxy/analytics/events'){assert.equal(req.headers().cookie,undefined);events.push(JSON.parse(req.postData()));return route.fulfill({status:204});}
 if(url.pathname==='/api-proxy/auth/google')return route.fulfill(++loginAttempts===1?{status:503,json:{message:'Synthetic temporary failure'}}:{json:{sessionAuthenticated:true,hasBusiness:false,isNewUser:true}});
 if(url.pathname.startsWith('/api-proxy/'))return route.fulfill({json:[]});
 try{let file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep)&&file!==root)throw new Error('outside fixture root');if((await stat(file)).isDirectory())file=path.join(file,'index.html');return route.fulfill({status:200,contentType:types[path.extname(file)]||'application/octet-stream',body:await readFile(file)});}catch{return route.fulfill({status:404,body:'Missing fixture asset'});}
});
const page=await context.newPage();const failures=[];page.on('pageerror',e=>failures.push(e.message));
const output=path.resolve('../../test-results/behavior-browser');await mkdir(output,{recursive:true});
try{
 await page.goto(origin+'/login/?utm_source=x&email=never-send-this',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Google',exact:true}).click();
 await page.getByText('Synthetic temporary failure',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Google',exact:true}).click();
 await page.waitForURL(url=>/^\/onboarding\/?$/.test(url.pathname));
 assert.equal(events.filter(e=>e.event==='user_signed_up').length,1);
 assert.equal(events.filter(e=>e.event==='login_failed').length,1);
 assert.equal(events.filter(e=>e.event==='page_viewed'&&e.path==='/login').length,1);
 assert(events.every(e=>e.source==='x'));
 assert(!JSON.stringify(events).includes('never-send-this'));
 assert(!JSON.stringify(events).includes('synthetic-never-sent'));
 assert.equal(new Set(events.map(e=>e.deviceId)).size,1);
 await page.goto(origin+'/privacy/',{waitUntil:'networkidle'});
 await page.getByRole('checkbox').check();
 const count=events.length;
 await page.goto(origin+'/login/',{waitUntil:'networkidle'});
 assert.equal(events.length,count);assert.equal(await page.evaluate(()=>localStorage.getItem('daftar_aid')),null);
 assert.deepEqual(failures,[]);
 await page.screenshot({path:path.join(output,'login-mobile.png')});
 await writeFile(path.join(output,'results.json'),JSON.stringify({scope:'Exact production assets; all requests intercepted',passed:['signup versus login','sign-in failure','page deduplication','source continuity','no sensitive values','anonymous device continuity','opt-out suppresses events and clears ID'],events:events.map(({event,path,source})=>({event,path,source}))},null,2));
 console.log('7 isolated behavior browser checks passed');
}finally{await context.close();await browser.close();}
