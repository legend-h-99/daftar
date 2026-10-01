import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const base = process.env.UX_BASE_URL || 'https://daftar-ead.pages.dev';
const out = path.resolve(process.env.UX_OUTPUT_DIR || '../../outputs/ux-2026-09-06');
await mkdir(out, {recursive:true});
const browser = await chromium.launch({
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {}),
});
const results=[];
const summary={totalSales:100,totalPurchases:20,costOfGoodsSold:20,operatingExpenses:10,totalExpenses:30,netProfit:70,unpaidInvoices:[],unpaidInvoicesCount:0,unpaidInvoicesTotal:0,lowStock:[]};
async function scenario(name, options, run){
 const context=await browser.newContext({viewport:{width:390,height:844},...options});
 const page=await context.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Never send API requests with synthetic credentials or mutate production records.
 await context.route('**/*',route=>{
  const req=route.request();
  if(['fetch','xhr'].includes(req.resourceType()) && (/supabase\.co|onrender\.com|\/api-proxy|localhost:3001|127\.0\.0\.1:3001/.test(req.url())))return route.fulfill({status:401,json:{message:'Unauthorized test request'}});
  return route.continue();
 });
 try{await run(page,context);assert.equal(errors.length,0,errors.join('; '));results.push({name,status:'PASS'});}
 catch(e){results.push({name,status:'FAIL',error:e.message});await page.screenshot({path:path.join(out,`failure-${results.length}.png`),fullPage:true}).catch(()=>{});}
 finally{await context.close();console.log(results.at(-1));}
}
async function login(page){await page.goto(`${base}/login/`,{waitUntil:'networkidle'});}
async function fixtures(context, failures=false){
 await context.addInitScript(()=>localStorage.setItem('daftar_token','synthetic-ui-test'));
 let fail=failures;
 await context.route(/supabase\.co|onrender\.com|\/api-proxy|localhost:3001|127\.0\.0\.1:3001/,route=>{
  const u=route.request().url();
  if(u.includes('/auth/me'))return route.fulfill({json:{user:{id:'ux-test'},business:{id:'ux-business',name:'منشأة اختبار'}}});
  if(u.includes('/dashboard/summary')){if(fail){return route.fulfill({status:503,json:{message:'تعذر تحميل بيانات الاختبار'}});}return route.fulfill({json:summary});}
  return route.fulfill({json:[]});
 });
 return ()=>{fail=false};
}
for(const width of [320,390,768,1440]){
 await scenario(`login responsive ${width}px`,{viewport:{width,height:900}},async page=>{
  await login(page);assert.equal(await page.getByLabel('البريد الإلكتروني',{exact:true}).count(),1);
  assert.equal(await page.getByText('رقم الجوال',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
  const input=await page.locator('#email').boundingBox();assert(input.width>100 && input.x>=0 && input.x+input.width<=width);
 });
}
await scenario('system dark/light and saved preference',{},async page=>{
 await page.emulateMedia({colorScheme:'dark'});await login(page);
 await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
 const dark=await page.locator('main').evaluate(e=>getComputedStyle(e).backgroundColor);
 await page.screenshot({path:path.join(out,'login-dark.png'),fullPage:true});
 await page.emulateMedia({colorScheme:'light'});await page.waitForFunction(()=>!document.documentElement.classList.contains('dark'));
 assert.notEqual(await page.locator('main').evaluate(e=>getComputedStyle(e).backgroundColor),dark);
 await page.evaluate(()=>localStorage.setItem('daftar-theme','dark'));await page.reload({waitUntil:'networkidle'});
 await page.waitForFunction(()=>document.documentElement.classList.contains('dark'));
});
await scenario('Arabic/English language and direction',{},async page=>{
 await login(page);assert.equal(await page.locator('main').getAttribute('dir'),'rtl');
 await page.getByRole('button',{name:'Switch to English'}).click();await page.waitForFunction(()=>document.querySelector('main')?.dir==='ltr');
 assert.equal(await page.locator('main').getAttribute('dir'),'ltr');assert.equal(await page.getByLabel('Email',{exact:true}).count(),1);
 await page.getByRole('button',{name:'التبديل إلى العربية'}).click();await page.waitForFunction(()=>document.querySelector('main')?.dir==='rtl');assert.equal(await page.locator('main').getAttribute('dir'),'rtl');
});
await scenario('invalid email blocked before submission',{},async(page,context)=>{
 let calls=0;await context.route('**/auth/email/login',r=>{calls++;return r.fulfill({json:{}})});
 await login(page);await page.locator('#email').fill('invalid');await page.locator('#password').fill('password123');
 await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
 assert.equal(await page.locator('#email').evaluate(e=>e.validity.valid),false);assert.equal(calls,0);
});
await scenario('login failure recovery and duplicate prevention',{},async(page,context)=>{
 let calls=0;await context.route('**/auth/email/login',async r=>{calls++;await new Promise(res=>setTimeout(res,500));return r.fulfill({status:401,json:{message:'بيانات الدخول غير صحيحة'}})});
 await login(page);await page.locator('#email').fill('ux@example.invalid');await page.locator('#password').fill('password123');
 await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('button[type=submit]')?.disabled===true);
 await page.getByText('بيانات الدخول غير صحيحة',{exact:true}).waitFor();assert.equal(await page.locator('#email').inputValue(),'ux@example.invalid');assert.equal(calls,1);assert.equal(await page.locator('button[type=submit]').isDisabled(),false);
});
await scenario('signup completion with synthetic response',{},async(page,context)=>{
 await context.route('**/auth/email/register',r=>r.fulfill({json:{sent:true}}));await login(page);
 await page.getByRole('button',{name:'حساب جديد',exact:true}).click();await page.locator('#email').fill('ux@example.invalid');await page.locator('#password').fill('password123');
 await page.getByRole('button',{name:'إنشاء الحساب',exact:true}).click();await page.getByText('تم التسجيل بنجاح!',{exact:true}).waitFor();
 await page.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();assert.equal(await page.locator('#email').count(),1);
});
await scenario('unauthenticated dashboard redirects',{},async page=>{await page.goto(`${base}/dashboard/`);await page.waitForFunction(()=>/\/login\/?$/.test(location.pathname));});
await scenario('keyboard accessible password visibility control',{},async page=>{
 await login(page);const toggle=page.locator('#password').locator('..').locator('button');
 assert.notEqual(await toggle.getAttribute('tabindex'),'-1','Password visibility control is excluded from keyboard Tab order');
 assert(await toggle.getAttribute('aria-label'),'Password visibility control has no accessible name');
 await page.locator('#password').focus();await page.keyboard.press('Tab');assert.equal(await toggle.evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Enter');assert.equal(await page.locator('#password').getAttribute('type'),'text');assert.equal(await toggle.getAttribute('aria-pressed'),'true');
});
await scenario('reports links distinct and usable at mobile width',{},async(page,context)=>{
 await fixtures(context);await page.goto(`${base}/reports/`,{waitUntil:'networkidle'});
 const section=page.getByRole('region',{name:'تفاصيل التقرير'});await section.waitFor();
 const links=section.locator('a');assert.equal(await links.count(),3);
 const boxes=await links.evaluateAll(es=>es.map(e=>({y:e.getBoundingClientRect().y,height:e.getBoundingClientRect().height,position:getComputedStyle(e).position})));
 assert(boxes[0].y<boxes[1].y && boxes[1].y<boxes[2].y);assert(boxes.every(b=>b.position==='static'&&b.height>=44));
 await section.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'reports-mobile.png'),fullPage:true});
 await links.first().click();await page.waitForFunction(()=>/\/invoices\/list\/?$/.test(location.pathname));
 assert.equal(await page.locator('nav a[aria-current=page]').innerText(),'الفواتير');
});
await scenario('reports error recovery',{},async(page,context)=>{
 const recover=await fixtures(context,true);await page.goto(`${base}/reports/`,{waitUntil:'networkidle'});
 const retry=page.getByRole('button',{name:'حاول مرة ثانية'});await retry.waitFor();recover();
 await retry.click();await page.getByRole('region',{name:'تفاصيل التقرير'}).waitFor();
});
await scenario('English translation across app forms and reports',{},async(page,context)=>{
 await fixtures(context);await page.goto(`${base}/dashboard/`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Switch to English'}).click();await page.waitForFunction(()=>document.documentElement.dir==='ltr');
 await page.goto(`${base}/expenses/`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Add expense'}).first().click();
 await page.getByRole('heading',{name:'New expense'}).waitFor();assert.equal(await page.getByText('Category',{exact:true}).count(),1);
 assert((await page.locator('#expense-category option').allTextContents()).includes('Ingredients'));
 await page.goto(`${base}/reports/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Reports'}).waitFor();
 await page.getByRole('heading',{name:'Visual comparison'}).waitFor();await page.getByRole('heading',{name:'Profit and loss statement'}).waitFor();
 await page.goto(`${base}/invoices/new/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'New invoice'}).waitFor();
 await page.getByRole('button',{name:'Choose a product'}).waitFor();await page.getByText('Due date',{exact:false}).waitFor();
 await page.goto(`${base}/purchases/new/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'New purchase'}).waitFor();
 await page.getByRole('button',{name:'Save and update stock'}).waitFor();
 await page.goto(`${base}/products/new/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Product cost calculator'}).waitFor();
 await page.getByLabel('Product name').waitFor();await page.getByText('Suggested selling price',{exact:true}).waitFor();
 await page.goto(`${base}/purchases/scan/`,{waitUntil:'networkidle'});await page.getByRole('heading',{name:'Enter a purchase from its invoice'}).waitFor();
 await page.getByRole('link',{name:'Enter purchase manually'}).waitFor();
 assert.equal(await page.locator('input[type="file"]').count(),0,'Disabled OCR must not upload invoice photos');
});
await scenario('corrected form errors clear as fields are fixed',{},async(page,context)=>{
 await fixtures(context);await page.goto(`${base}/expenses/`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'إضافة مصروف'}).first().click();
 await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByText('أدخل مبلغ صحيح',{exact:true}).waitFor();
 await page.locator('#expense-amount').fill('12');assert.equal(await page.getByText('أدخل مبلغ صحيح',{exact:true}).count(),0);
 await page.goto(`${base}/products/new/`,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'حفظ',exact:true}).click();await page.getByText('اكتب اسم المنتج',{exact:true}).waitFor();
 await page.locator('#product-name').fill('اختبار');assert.equal(await page.getByText('اكتب اسم المنتج',{exact:true}).count(),0);
});
await scenario('unavailable OCR offers a private manual fallback',{},async(page,context)=>{
 await fixtures(context);
 await page.goto(`${base}/purchases/scan/`,{waitUntil:'networkidle'});
 await page.getByText(/تبقى الصورة على جهازك/).waitFor();
 assert.equal(await page.locator('input[type="file"]').count(),0,'Invoice photos must stay on the device while OCR is disabled');
 await page.getByRole('link',{name:'إدخال الشراء يدويًا'}).waitFor();
});
await scenario('privacy discoverability from login',{},async page=>{await login(page);const link=page.getByRole('link',{name:/خصوصية|privacy/i});assert(await link.count(),'No privacy notice link on login');await link.click();await page.getByRole('heading',{level:1,name:/خصوصية|privacy/i}).waitFor();});
await scenario('dark input text contrast', {colorScheme:'dark'}, async page=>{
 await login(page);await page.locator('#email').fill('ux@example.invalid');
 const contrast=await page.locator('#email').evaluate(e=>{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
  const rgb=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data].slice(0,3)};
  const luminance=color=>rgb(color).map(c=>{c/=255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4}).reduce((s,c,i)=>s+c*[0.2126,0.7152,0.0722][i],0);
  const style=getComputedStyle(e),a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
 });assert(contrast>=4.5,`Input text contrast ${contrast.toFixed(2)} is below 4.5`);
});
await browser.close();
await writeFile(path.join(out,'results.json'),JSON.stringify({base,runAt:new Date().toISOString(),scope:'Browser UI only; application API calls intercepted with synthetic responses; no production records created',results},null,2));
console.log(`${results.filter(r=>r.status==='PASS').length}/${results.length} passed; output: ${out}`);
process.exitCode=results.some(r=>r.status==='FAIL')?1:0;
