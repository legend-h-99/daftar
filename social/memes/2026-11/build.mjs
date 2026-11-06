// Builds the text-based memes from marketing/meme-content-brief-2026-11.md (memes 2, 4, 9).
// Writes src/*.html and renders png/*.png — 1080x1350 for feed, 1080x1920 for WhatsApp status / stories.
// Run from the repo root: node social/memes/2026-11/build.mjs [name-filter]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../../..');
const require = createRequire(join(root, 'package.json'));
const lucideDir = join(root, 'node_modules/.pnpm/lucide-react@1.23.0_react@19.2.7/node_modules/lucide-react/dist/esm/icons');
const { chromium } = require(join(root, 'node_modules/.pnpm/playwright@1.62.1/node_modules/playwright'));

// Inline a Lucide icon as an SVG string so the pages need no runtime JS.
async function icon(name, strokeWidth = 2) {
  const { __iconNode } = await import(pathToFileURL(join(lucideDir, `${name}.mjs`)).href);
  const children = __iconNode
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`)
    .join('');
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${children}</svg>`;
}

const I = {
  back: await icon('chevron-right', 2.5),
  video: await icon('video'),
  phone: await icon('phone'),
  user: await icon('user', 1.75),
  ticks: await icon('check-check', 2.25),
};

// Fonts are shared with the Instagram batch rather than copied.
const fonts = [400, 500, 700, 800, 900]
  .map((w) => {
    const file = { 400: 'Regular', 500: 'Medium', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' }[w];
    return `@font-face { font-family: Tajawal; font-weight: ${w}; src: url(../../../instagram/2026-11/fonts/Tajawal_${w}${file}.ttf); }`;
  })
  .join('\n');

const base = `
${fonts}
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 1080px; height: 100vh; }
body {
  font-family: Tajawal, sans-serif; direction: rtl; color: #1c1917;
  -webkit-font-smoothing: antialiased; overflow: hidden; position: relative;
}
/* Small watermark only — memes should read as native posts, not ads. */
.site {
  position: absolute; left: 48px; bottom: 40px; direction: ltr;
  font-size: 26px; font-weight: 700; color: rgba(28, 25, 23, 0.45);
}
/* Story/status UI covers the top and bottom of a 9:16 frame. */
body.status .site { bottom: 260px; }
`;

const page = (css, body, variant = '') => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>${base}${css}</style></head>
<body class="${variant}">${body}</body></html>`;

// --- Meme 2: المشروع يسلّف البيت (tweet-style card from @daftar1app) -----------------------
// No timestamp and no like/retweet counts: those would be invented numbers.

const loansCss = `
body { background: #F5F2EC; display: grid; place-items: center; }
.tweet {
  width: 980px; background: #fff; border-radius: 44px; padding: 60px 60px 68px;
  box-shadow: 0 2px 0 rgba(0,0,0,0.04), 0 24px 60px rgba(60, 40, 20, 0.10);
}
.who { display: flex; align-items: center; gap: 24px; }
.avatar {
  width: 100px; height: 100px; border-radius: 50%; flex: none;
  background: linear-gradient(135deg, #4C1D95, #7C3AED);
  color: #fff; font-weight: 800; font-size: 60px; display: grid; place-items: center; padding-top: 6px;
}
.name { font-size: 40px; font-weight: 800; line-height: 1.2; }
.handle { direction: ltr; text-align: right; font-size: 32px; font-weight: 500; color: #78716c; }
.text { margin-top: 44px; font-size: 56px; font-weight: 700; line-height: 1.5; }
.text p + p { margin-top: 44px; }
`;
const loans = (variant) => page(loansCss, `
<div class="tweet">
  <div class="who">
    <div class="avatar">د</div>
    <div><div class="name">دفتر</div><div class="handle">@daftar1app</div></div>
  </div>
  <div class="text">
    <p>فلوس المشروع وفلوس البيت<br>في نفس المحفظة</p>
    <p>المشروع: يسلّف البيت<br>البيت: ما يرجّع</p>
  </div>
</div>
<div class="site">daftar1.com</div>`, variant);

// --- Meme 4: خصم القرابة (chat mock built from scratch, labelled «تمثيل») -------------------
// RTL chat layout: received bubbles sit on the right, sent bubbles on the left.

const cousinCss = `
body { display: flex; flex-direction: column; background: #fff; }
body.status { padding-top: 200px; background: linear-gradient(#F7F7F7 0 200px, #fff 200px); }
.bar {
  height: 132px; flex: none; background: #F7F7F7; border-bottom: 1px solid #E5E5E5;
  display: flex; align-items: center; gap: 18px; padding: 0 36px; color: #0A84FF;
}
.bar .ic { width: 52px; height: 52px; flex: none; }
.bar .ic svg { width: 100%; height: 100%; display: block; }
.bar .avatar {
  width: 80px; height: 80px; border-radius: 50%; background: #DFE5E7; color: #fff;
  padding: 14px; flex: none;
}
.bar .avatar svg { width: 100%; height: 100%; display: block; }
.bar .title { flex: 1; color: #111; font-size: 38px; font-weight: 800; }
.bar .calls { display: flex; gap: 40px; }
.chat {
  flex: 1; background: #EFEAE2; position: relative;
  display: flex; flex-direction: column; justify-content: flex-end; gap: 22px; padding: 48px 40px 56px;
}
.acting {
  position: absolute; top: 28px; left: 32px;
  background: rgba(0,0,0,0.55); color: #fff; font-size: 26px; font-weight: 700;
  padding: 8px 22px 4px; border-radius: 999px;
}
.day {
  align-self: center; margin-bottom: 14px; background: #fff; color: #54656F;
  font-size: 26px; font-weight: 700; padding: 10px 26px 6px; border-radius: 14px; box-shadow: 0 1px 1px rgba(0,0,0,0.08);
}
.msg {
  max-width: 80%; font-size: 56px; font-weight: 500; line-height: 1.35;
  padding: 20px 32px 16px; border-radius: 32px; box-shadow: 0 1px 1px rgba(0,0,0,0.12);
  display: flex; align-items: flex-end; gap: 24px;
}
.msg .t { font-size: 26px; font-weight: 500; color: #8696A0; white-space: nowrap; display: flex; align-items: center; gap: 6px; padding-bottom: 4px; }
.msg .t svg { width: 30px; height: 30px; color: #53BDEB; }
.in { align-self: flex-start; background: #fff; border-start-start-radius: 8px; }
.out { align-self: flex-end; background: #D9FDD3; border-start-end-radius: 8px; }
.punch {
  flex: none; height: 480px; display: grid; place-items: center; text-align: center;
  font-size: 80px; font-weight: 900; line-height: 1.35; padding: 0 50px 50px;
}
body.status .punch { height: 640px; padding-bottom: 260px; }
`;
const cousin = (variant) => page(cousinCss, `
<div class="bar">
  <span class="ic">${I.back}</span>
  <span class="avatar">${I.user}</span>
  <span class="title">بنت خالتي 🌸</span>
  <span class="calls"><span class="ic">${I.video}</span><span class="ic">${I.phone}</span></span>
</div>
<div class="chat">
  <span class="acting">تمثيل</span>
  <span class="day">اليوم</span>
  <div class="msg in"><span>كم الكيكة؟</span><span class="t">10:12 م</span></div>
  <div class="msg out"><span>120 ريال</span><span class="t">10:12 م ${I.ticks}</span></div>
  <div class="msg in"><span>طيب ولي أنا؟ 🥺</span><span class="t">10:13 م</span></div>
</div>
<div class="punch"><p>الدقيق والزبدة<br>ما يدرون إنها بنت خالتي</p></div>
<div class="site">daftar1.com</div>`, variant);

// --- Meme 9: وقتك من المكونات (recipe card) ------------------------------------------------

const recipeCss = `
body {
  background: radial-gradient(120% 90% at 50% 0%, #F6F1E8 0%, #EADFCD 100%);
  display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 40px;
}
.kicker { font-size: 46px; font-weight: 700; color: #78716c; }
h1 { margin-top: 6px; font-size: 104px; font-weight: 900; line-height: 1.2; }
.card {
  --row: 86px;
  position: relative; margin-top: 70px; width: 900px;
  /* Red margin rule under the title, then blue ruled lines only below it. */
  background:
    linear-gradient(#E25C5C, #E25C5C) 0 calc(var(--row) * 1.4) / 100% 3px no-repeat,
    repeating-linear-gradient(to bottom, transparent 0 calc(var(--row) - 2px), #C9DCF0 calc(var(--row) - 2px) var(--row))
      0 calc(var(--row) * 1.4 + 3px) / 100% calc(100% - var(--row) * 1.4 - 3px) no-repeat,
    #FFFDF6;
  border-radius: 10px; padding: 34px 64px 52px; transform: rotate(-2deg);
  box-shadow: 0 2px 2px rgba(0,0,0,0.06), 0 28px 50px rgba(80, 50, 20, 0.18);
}
.tape {
  position: absolute; top: -30px; left: 50%; width: 230px; height: 62px; transform: translateX(-50%) rotate(3deg);
  background: rgba(236, 225, 196, 0.85); box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
.card h2 { font-size: 54px; font-weight: 800; line-height: var(--row); color: #3f3a36; }
ul { list-style: none; margin-top: calc(var(--row) * 0.4 + 3px); }
li { font-size: 52px; font-weight: 500; line-height: var(--row); color: #44403c; }
li::before { content: '•'; margin-inline-end: 18px; color: #a8a29e; }
li.time { color: #C2410C; font-weight: 800; }
li.time::before { content: '+'; color: #C2410C; }
li.time mark {
  background: linear-gradient(100deg, transparent 0 1%, rgba(253, 224, 71, 0.85) 3% 96%, transparent 98%);
  color: inherit; padding: 0 10px; border-radius: 6px;
}
`;
const recipe = page(recipeCss, `
<p class="kicker">رأي غير شعبي:</p>
<h1>وقتك من المكونات</h1>
<div class="card">
  <span class="tape"></span>
  <h2>كيكة الفانيلا — المقادير:</h2>
  <ul>
    <li>3 بيضات</li>
    <li>كوب دقيق</li>
    <li>كوب سكر</li>
    <li>نص كوب زبدة</li>
    <li>ملعقة فانيلا</li>
    <li class="time"><mark>ساعتين من وقتك ⏱️</mark></li>
  </ul>
</div>
<div class="site">daftar1.com</div>`);

// --- Photo memes (1, 3, 5, 6, 7, 8, 10) -----------------------------------------------------
// Scenes in photos/ are AI-generated with no text in them (Halai, Nano Banana 2.1, 2026-11-06);
// every Arabic word is overlaid here so it stays correct and editable.
// Handwriting uses macOS system fonts: Waseem (pen) and Sana (marker).

const photoCss = `
body { background: #fff; display: flex; flex-direction: column; }
.label { font-size: 52px; font-weight: 800; line-height: 1.3; padding: 24px 48px 18px; color: #111; text-wrap: balance; }
.label.big { font-size: 62px; padding: 40px 48px 32px; }
.panel { position: relative; width: 1080px; flex: none; overflow: hidden; background-repeat: no-repeat; }
.panel.fill { flex: 1; background-size: cover; background-position: center; }
.hand { position: absolute; font-family: Waseem, sans-serif; white-space: nowrap; mix-blend-mode: multiply; }
.pen { color: #1e3a8a; }
.pencil { color: #3f3f46; opacity: 0.9; }
.marker { font-family: Sana, sans-serif; color: #18181b; }
.chip {
  position: absolute; background: #fff; color: #111; font-weight: 800; font-size: 38px;
  padding: 14px 28px 8px; border-radius: 999px; box-shadow: 0 4px 14px rgba(0,0,0,0.18);
}
.clock {
  position: absolute; background: rgba(0,0,0,0.6); color: #fff; font-weight: 800; font-size: 44px;
  padding: 12px 30px 6px; border-radius: 22px; direction: rtl;
}
.site.light { color: rgba(255,255,255,0.9); text-shadow: 0 1px 4px rgba(0,0,0,0.6); }
`;

const bg = (file, size, pos) => `background-image:url(../photos/${file}.jpg);background-size:${size};background-position:${pos}`;

// Meme 1: ورقة الطلبات
const paperWeek = page(photoCss, `
<div class="label">أنا أول الأسبوع:</div>
<div class="panel" style="height:545px;${bg('paper-neat', '1080px auto', '0 -110px')}">
  <div class="hand pen" style="right:368px;top:96px;font-size:38px;line-height:66px;transform:rotate(-1deg)">
    نوف — كيكة — 150 ✓<br>هند — كب كيك — 80 ✓<br>سعاد — بسبوسة — 70 ✓
  </div>
</div>
<div class="label">أنا آخر الأسبوع:</div>
<div class="panel" style="height:545px;${bg('paper-messy', '1080px auto', '0 -100px')}">
  <div class="hand pencil" style="right:430px;top:96px;font-size:44px;line-height:74px;transform:rotate(-11deg)">
    نوف؟ 70 ولا 17؟؟<br>دفعت ولا لا ؟؟<br><s>هند 80</s> 60 ؟
  </div>
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 3: الشوكولاتة والعيال
const kidsStock = page(photoCss, `
<div class="label">الشوكولاتة اللي شريتها لطلب بكرة:</div>
<div class="panel" style="height:545px;${bg('fridge-full', '1500px auto', '-111px -333px')}">
  <div class="hand" style="left:453px;top:182px;width:176px;height:176px;display:grid;place-items:center;text-align:center;font-size:34px;line-height:1.25;color:#b91c1c;transform:rotate(-2deg)">
    للطلب ⚠️<br>لا أحد<br>يلمس!
  </div>
</div>
<div class="label">الشوكولاتة الساعة 10 الليل:</div>
<div class="panel" style="height:545px;${bg('fridge-empty', '1080px auto', '0 -150px')}">
  <div class="hand" style="left:372px;top:236px;font-size:26px;color:#b91c1c;transform:rotate(9deg)">للطلب ⚠️</div>
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 5: توقعاتي مقابل الواقع
const expectation = page(photoCss, `
<div class="label">كيف تخيلت نفسي لما بدأت المشروع:</div>
<div class="panel" style="height:545px;${bg('desk-dream', '1080px auto', '0 -90px')}">
  <span class="chip" style="right:40px;top:36px">سيدة أعمال 💼</span>
</div>
<div class="label">الواقع:</div>
<div class="panel" style="height:545px;${bg('kitchen-real', '1080px auto', '0 -95px')}">
  <span class="clock" style="left:40px;top:36px">1:47 ص</span>
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 6: قبل ما أفتح حسبة الشهر
const monthPeek = page(photoCss, `
<div class="label big">أنا آخر الشهر<br>قبل ما أشوف الربح:</div>
<div class="panel fill" style="${bg('peek', 'cover', 'center')}">
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 7: العلبة أغلى من اللي داخلها
const fancyBox = page(photoCss, `
<div class="label">لما تحسبين التكلفة وتكتشفين إن العلبة<br>أغلى من الحلى اللي داخلها</div>
<div class="panel fill" style="${bg('fancy-box', 'cover', 'center')}">
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 8: المصطلحات هي الصعبة (marker on the blank cardboard sign)
const signCss = photoCss + `
.sign { position: absolute; left: 252px; top: 384px; width: 496px; height: 570px;
  display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center;
  transform: rotate(-0.5deg); mix-blend-mode: multiply; }
/* Sana is thin at this size; a stroke makes it read like a marker. */
.sign > div { -webkit-text-stroke: 2px currentColor; }
.sign .kick { font-size: 48px; }
.sign .main { font-size: 62px; line-height: 1.4; margin-top: 8px; }
.sign hr { width: 72%; border: 0; border-top: 6px solid #18181b; margin: 24px 0 20px; opacity: 0.85; border-radius: 3px; }
.sign .eq { font-size: 46px; line-height: 1.35; color: #b91c1c; }
`;
const accountingWords = page(signCss, `
<div class="panel fill" style="${bg('sign', 'cover', 'center')}">
  <div class="sign marker">
    <div class="kick">رأي:</div>
    <div class="main">المحاسبة مو صعبة.<br>المصطلحات<br>هي الصعبة.</div>
    <hr>
    <div class="eq">ذمم مدينة =<br>لي عند نوف 150</div>
  </div>
  <div class="site light">daftar1.com</div>
</div>`);

// Meme 10: أنتي أي وحدة؟ — two photos + two drawn phone screens
const whichCss = photoCss + `
.grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 26px 26px; padding: 6px 40px 70px; }
.tile { display: flex; flex-direction: column; min-height: 0; }
.shot { height: 430px; border-radius: 26px; overflow: hidden; position: relative; background-size: cover; background-position: center; }
.cap { display: flex; gap: 14px; align-items: flex-start; margin-top: 16px; font-size: 34px; font-weight: 700; line-height: 1.3; }
.num { flex: none; width: 52px; height: 52px; border-radius: 50%; background: #111; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 32px; padding-top: 4px; }
/* Notes app mock */
.notes { background: #F2F2F7; padding: 26px 24px; }
.notes h3 { font-size: 40px; font-weight: 800; color: #111; }
.notes .list { margin-top: 18px; background: #fff; border-radius: 18px; overflow: hidden; }
.notes .item { padding: 16px 22px 12px; border-bottom: 1px solid #E5E5EA; }
.notes .item b { display: block; font-size: 28px; color: #111; }
.notes .item span { font-size: 22px; color: #8E8E93; }
.notes .item.hot { background: #FEF3C7; }
/* Self-chat mock */
.self { background: #EFEAE2; display: flex; flex-direction: column; }
.self .top { background: #F7F7F7; padding: 18px 24px; font-size: 30px; font-weight: 800; border-bottom: 1px solid #E5E5E5; }
.self .msgs { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; gap: 12px; padding: 18px; }
.self .m { align-self: flex-end; background: #D9FDD3; border-radius: 18px; border-start-end-radius: 6px; padding: 10px 18px 8px; font-size: 27px; line-height: 1.35; max-width: 92%; box-shadow: 0 1px 1px rgba(0,0,0,0.1); }
.self .m i { font-style: normal; font-size: 18px; color: #8696A0; margin-inline-start: 10px; }
`;
const whichOne = page(whichCss, `
<div class="label big" style="padding-bottom:24px">صاحبة المشروع وطريقتها في الحساب:</div>
<div class="grid">
  <div class="tile">
    <div class="shot" style="background-image:url(../photos/head.jpg)"></div>
    <div class="cap"><span class="num">1</span><span>كل شي في راسي</span></div>
  </div>
  <div class="tile">
    <div class="shot" style="background-image:url(../photos/fridge-note.jpg)"></div>
    <div class="cap"><span class="num">2</span><span>ورقة على الثلاجة</span></div>
  </div>
  <div class="tile">
    <div class="shot notes">
      <h3>الملاحظات</h3>
      <div class="list">
        <div class="item"><b>طلبات</b><span>الأحد</span></div>
        <div class="item"><b>طلبات 2</b><span>الإثنين</span></div>
        <div class="item"><b>طلبات (الأخيرة)</b><span>أمس</span></div>
        <div class="item hot"><b>طلبات (الأخيرة النهائية 2)</b><span>اليوم</span></div>
      </div>
    </div>
    <div class="cap"><span class="num">3</span><span>ملاحظات الجوال</span></div>
  </div>
  <div class="tile">
    <div class="shot self">
      <div class="top">أنا (أنت)</div>
      <div class="msgs">
        <div class="m">نوف كيكة 150 لي عندها<i>9:02 م</i></div>
        <div class="m">الكاكاو خلص!!<i>9:40 م</i></div>
        <div class="m">هند دفعت؟؟ تأكدي<i>11:15 م</i></div>
      </div>
    </div>
    <div class="cap"><span class="num">4</span><span>أرسل لنفسي في واتساب</span></div>
  </div>
</div>
<div class="site">daftar1.com</div>`);

// Meme 11 (sarcastic): شهادة شكر وتقدير — "certified by: your wallet". Text-only, no photo.
const certCss = `
body { background: #EFE7D6; display: grid; place-items: center; }
.cert {
  width: 980px; height: 1250px; background: #FFFCF4; position: relative; text-align: center;
  border: 12px double #B08D3C; padding: 70px 80px 60px; display: flex; flex-direction: column; align-items: center;
  box-shadow: 0 20px 50px rgba(90, 60, 20, 0.18);
}
.cert::before { content: ''; position: absolute; inset: 16px; border: 2px solid #D9C28A; pointer-events: none; }
.cup { font-size: 84px; line-height: 1; }
.cert h1 { margin-top: 18px; font-family: 'Diwan Thuluth', serif; font-weight: 400; font-size: 100px; line-height: 1.25; color: #7A5A1C; }
.to { margin-top: 18px; font-size: 36px; font-weight: 500; color: #78716c; }
.name { margin-top: 10px; font-size: 64px; font-weight: 900; color: #1c1917; border-bottom: 3px dotted #B08D3C; padding: 0 30px 6px; }
.for { margin-top: 38px; font-size: 36px; font-weight: 700; color: #57534e; }
.list { margin-top: 18px; font-size: 46px; font-weight: 800; line-height: 1.6; color: #1c1917; }
.list b { color: #15803d; }
.thanks { margin-top: 30px; font-size: 40px; font-weight: 700; line-height: 1.45; color: #7A5A1C; }
.foot { margin-top: auto; width: 100%; display: flex; justify-content: space-between; align-items: flex-end; }
.sig { text-align: center; font-size: 28px; font-weight: 700; color: #78716c; }
.site { bottom: 12px; }
.sig .scrawl { font-family: Waseem, serif; font-size: 56px; color: #1e3a8a; border-bottom: 2px solid #a8a29e; padding: 0 24px 4px; margin-bottom: 8px; }
.stamp {
  width: 210px; height: 210px; border-radius: 50%; border: 6px solid #b91c1c; color: #b91c1c;
  display: grid; place-items: center; transform: rotate(-14deg); opacity: 0.82;
  font-weight: 900; font-size: 34px; line-height: 1.25; outline: 3px solid #b91c1c; outline-offset: -18px;
}
`;
const certificate = page(certCss, `
<div class="cert">
  <div class="cup">🏆</div>
  <h1>شهادة شكر وتقدير</h1>
  <p class="to">تُمنح بكل فخر إلى:</p>
  <p class="name">صاحبة المشروع</p>
  <p class="for">تقديراً لتقديمها:</p>
  <p class="list">التوصيل <b>مجاناً</b><br>التغليف <b>مجاناً</b><br>وقتها <b>مجاناً</b><br>والكيكة… <b>تقريباً مجاناً</b></p>
  <p class="thanks">شكراً لإسعادك الزباين<br>على حسابك الخاص 👏</p>
  <div class="foot">
    <div class="stamp">معتمد<br>من جيبك</div>
    <div class="sig"><div class="scrawl">محفظتك</div>التوقيع</div>
  </div>
</div>
<div class="site">daftar1.com</div>`);

// --- Sarcastic set 2 (12, 13, 14): text-only, no generated photos ---------------------------

// Meme 12: استراتيجيتي المالية المتقدمة — a self-important corporate slide for a four-step "plan".
const planCss = `
body { background: #F4F6FA; display: flex; flex-direction: column; }
.head { background: #0F1E3D; color: #fff; padding: 56px 64px 50px; }
.secret { display: inline-block; border: 3px solid #F87171; color: #FCA5A5; font-weight: 800; font-size: 28px; padding: 8px 22px 4px; border-radius: 10px; }
.head h1 { margin-top: 26px; font-size: 68px; font-weight: 900; line-height: 1.25; }
.head p { margin-top: 12px; font-size: 32px; font-weight: 500; color: #A5B4CF; }
.steps { flex: 1; display: flex; flex-direction: column; align-items: stretch; padding: 46px 90px 0; }
.step { display: flex; align-items: center; gap: 30px; background: #fff; border: 2px solid #DCE2EE; border-radius: 28px; padding: 26px 34px 20px; }
.step .n { flex: none; width: 74px; height: 74px; border-radius: 50%; background: #0F1E3D; color: #fff; display: grid; place-items: center; font-size: 40px; font-weight: 800; padding-top: 5px; }
.step .t { font-size: 56px; font-weight: 800; color: #0F1E3D; }
.step.last { background: #FEF2F2; border-color: #FCA5A5; }
.step.last .n { background: #DC2626; }
.step.last .t { color: #B91C1C; }
.arrow { align-self: center; font-size: 46px; line-height: 1; color: #94A3B8; padding: 10px 0 6px; }
.by { padding: 26px 90px 84px; font-size: 28px; font-weight: 500; line-height: 1.5; color: #64748B; text-wrap: balance; }
`;
const financePlan = page(planCss, `
<div class="head">
  <span class="secret">سري للغاية 🔒</span>
  <h1>استراتيجيتي المالية المتقدمة</h1>
  <p>خطة النمو 📈 — للإدارة العليا فقط</p>
</div>
<div class="steps">
  <div class="step"><span class="n">1</span><span class="t">أبيع</span></div>
  <div class="arrow">↓</div>
  <div class="step"><span class="n">2</span><span class="t">أشتري مقاضي</span></div>
  <div class="arrow">↓</div>
  <div class="step"><span class="n">3</span><span class="t">أبيع</span></div>
  <div class="arrow">↓</div>
  <div class="step last"><span class="n">4</span><span class="t">وين راحت الفلوس؟ 🤔</span></div>
</div>
<p class="by">إعداد: الرئيسة التنفيذية، والمحاسبة، والمسوّقة،<br>ومندوبة التوصيل (نفس الشخص)</p>
<div class="site">daftar1.com</div>`);

// Meme 13: وين راحت فلوس المشروع؟ — parody pie chart. No numbers shown: the slices are a joke, not data.
// Palette: dataviz reference categorical slots 1–5, validated (light): CVD ΔE 9.1, normal ΔE 19.6.
// Three slots sit under 3:1 on the surface, so every slice is named in a text legend (relief rule).
const pieSlices = [
  { label: 'ما أدري 🤷‍♀️', share: 0.46, color: '#2a78d6' },
  { label: 'مقاضي البيت', share: 0.2, color: '#eb6834' },
  { label: 'التغليف والتوصيل', share: 0.17, color: '#1baf7a' },
  { label: 'العيال والشوكولاتة', share: 0.14, color: '#eda100' },
  { label: 'الربح', share: 0.03, color: '#e87ba4' },
];
const pieSvg = (() => {
  const cx = 540, cy = 330, r = 300;
  let start = -Math.PI / 2;
  const paths = pieSlices.map(({ share, color }) => {
    const end = start + share * 2 * Math.PI;
    const p = (a) => `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
    const d = `M ${cx} ${cy} L ${p(start)} A ${r} ${r} 0 ${share > 0.5 ? 1 : 0} 1 ${p(end)} Z`;
    start = end;
    return `<path d="${d}" fill="${color}" stroke="#fcfcfb" stroke-width="4" stroke-linejoin="round"/>`;
  });
  // Point at the profit sliver (last slice, just left of 12 o'clock).
  const mid = -Math.PI / 2 + (1 - pieSlices.at(-1).share / 2) * 2 * Math.PI;
  const tip = [cx + (r + 14) * Math.cos(mid), cy + (r + 14) * Math.sin(mid)];
  const arrow = `<path d="M 250 40 Q 380 -10 ${tip[0].toFixed(1)} ${(tip[1] - 6).toFixed(1)}" fill="none" stroke="#0b0b0b" stroke-width="4" stroke-linecap="round" marker-end="url(#head)"/>`;
  return `<svg viewBox="0 -60 1080 720" width="1080" height="720" aria-label="مخطط ساخر: وين راحت فلوس المشروع">
    <defs><marker id="head" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="#0b0b0b"/></marker></defs>
    ${paths.join('')}${arrow}</svg>`;
})();
const pieCss = `
body { background: #fcfcfb; color: #0b0b0b; display: flex; flex-direction: column; align-items: center; }
.kick { margin-top: 64px; font-size: 38px; font-weight: 700; color: #52514e; }
h1 { margin-top: 4px; font-size: 80px; font-weight: 900; line-height: 1.2; }
.chart { position: relative; margin-top: 26px; }
.note { position: absolute; top: 22px; left: 70px; font-size: 34px; font-weight: 800; line-height: 1.3; text-align: center; }
.note span { display: block; font-size: 26px; font-weight: 500; color: #52514e; }
.legend { margin-top: 6px; display: grid; grid-template-columns: auto auto; gap: 16px 70px; font-size: 38px; font-weight: 700; }
.legend div { display: flex; align-items: center; gap: 16px; }
.legend i { width: 30px; height: 30px; border-radius: 6px; flex: none; }
`;
const moneyPie = page(pieCss, `
<p class="kick">تحليل مالي احترافي 📊</p>
<h1>وين راحت فلوس المشروع؟</h1>
<div class="chart">
  ${pieSvg}
  <p class="note">الربح<span>(كبّري الصورة)</span></p>
</div>
<div class="legend">${pieSlices.map((s) => `<div><i style="background:${s.color}"></i>${s.label}</div>`).join('')}</div>
<div class="site">daftar1.com</div>`);

// Meme 14: قاموس صاحبة المشروع (النسخة الصادقة)
const dictEntries = [
  ['التوصيل مجاني', 'أنا اللي أدفع البنزين.'],
  ['سعر خاص لك', 'بخسارة… بس بابتسامة.'],
  ['ربحي كويس', 'ما أدري.'],
  ['ما يحتاج أحسب', 'خايفة أحسب.'],
  ['الشهر الجاي أرتّبها', 'لا.'],
];
const dictCss = `
body { background: #FBF8F1; padding: 70px 76px 0; }
h1 { font-size: 78px; font-weight: 900; line-height: 1.2; }
.ed { margin-top: 6px; font-size: 36px; font-weight: 500; color: #78716c; }
.rule { margin-top: 30px; height: 6px; background: #1c1917; border-radius: 3px; }
.entry { padding: 26px 0 22px; border-bottom: 2px solid #E7E1D3; }
.term { font-size: 50px; font-weight: 900; }
.term small { font-size: 26px; font-weight: 500; color: #a8a29e; margin-inline-start: 14px; }
.def { margin-top: 6px; font-size: 42px; font-weight: 500; color: #44403c; }
.def b { color: #b45309; font-weight: 800; margin-inline-end: 10px; }
`;
const honestDictionary = page(dictCss, `
<h1>قاموس صاحبة المشروع</h1>
<p class="ed">النسخة الصادقة 📖</p>
<div class="rule"></div>
${dictEntries.map(([t, d]) => `<div class="entry"><div class="term">«${t}»<small>عبارة</small></div><div class="def"><b>يعني:</b>${d}</div></div>`).join('')}
<div class="site">daftar1.com</div>`);

// --- write + render ------------------------------------------------------------------------

const pages = {
  'meme-project-loans': [loans(''), 1350],
  'meme-project-loans-status': [loans('status'), 1920],
  'meme-cousin-discount': [cousin(''), 1350],
  'meme-cousin-discount-status': [cousin('status'), 1920],
  'meme-time-ingredient': [recipe, 1350],
  'meme-paper-week': [paperWeek, 1350],
  'meme-kids-stock': [kidsStock, 1350],
  'meme-expectation': [expectation, 1350],
  'meme-month-peek': [monthPeek, 1350],
  'meme-fancy-box': [fancyBox, 1350],
  'meme-accounting-words': [accountingWords, 1350],
  'meme-which-one': [whichOne, 1350],
  'meme-sarcastic-certificate': [certificate, 1350],
  'meme-finance-plan': [financePlan, 1350],
  'meme-money-pie': [moneyPie, 1350],
  'meme-honest-dictionary': [honestDictionary, 1350],
};

const only = process.argv[2];
mkdirSync(join(here, 'src'), { recursive: true });
mkdirSync(join(here, 'png'), { recursive: true });
const browser = await chromium.launch();
for (const [name, [html, height]] of Object.entries(pages)) {
  if (only && !name.includes(only)) continue;
  const tab = await browser.newPage({ viewport: { width: 1080, height }, deviceScaleFactor: 1 });
  const file = join(here, 'src', `${name}.html`);
  writeFileSync(file, html);
  await tab.goto(pathToFileURL(file).href);
  await tab.evaluate(() => document.fonts.ready);
  // Flag any element that spills outside the frame so layout bugs fail loudly.
  const overflow = await tab.evaluate(() => {
    const { innerWidth: w, innerHeight: h } = window;
    return [...document.body.querySelectorAll('*')]
      .filter((el) => { const r = el.getBoundingClientRect(); return r.bottom > h + 1 || r.left < -1 || r.right > w + 1; })
      .filter((el) => !el.closest('.tape'))
      .map((el) => el.className || el.tagName);
  });
  await tab.screenshot({ path: join(here, 'png', `${name}.png`) });
  console.log(name, overflow.length ? `OVERFLOW: ${overflow.join(', ')}` : 'ok');
  await tab.close();
}
await browser.close();
