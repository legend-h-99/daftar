import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { chromium } from "playwright";
import { readFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import assert from "node:assert/strict";
const pg = new PGlite();
await pg.exec(
  await readFile(new URL("../db/001_operations.sql", import.meta.url), "utf8"),
);
const dbServer = new PGLiteSocketServer({
  db: pg,
  port: 5546,
  maxConnections: 16,
  host: "127.0.0.1",
});
await dbServer.start();
const password = randomBytes(20).toString("hex"),
  salt = randomBytes(16).toString("hex");
const port = 3211,
  origin = `http://localhost:${port}`;
let log = "";
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    cwd: new URL("..", import.meta.url),
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NODE_ENV: "production",
      OPS_DATABASE_URL: "postgres://test@127.0.0.1:5546/test",
      OPS_ORIGIN: origin,
      OPS_OWNER_EMAIL: "owner@example.com",
      OPS_PASSWORD_HASH: `${salt}:${scryptSync(password, salt, 64).toString("hex")}`,
      OPS_SESSION_SECRET: randomBytes(32).toString("hex"),
      OPS_IP_HASH_SECRET: randomBytes(32).toString("hex"),
      OPS_SUPPORT_ORIGIN: "https://daftar1.com",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
server.stdout.on("data", (c) => (log += c));
server.stderr.on("data", (c) => (log += c));
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin + "/login")).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, log);
  assert.equal((await fetch(origin + "/api/state")).status, 401);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin);
  await page.waitForURL("**/login");
  await page.getByLabel("بريد المالك").fill("owner@example.com");
  await page.getByLabel("كلمة المرور").fill(password);
  await page.getByRole("button", { name: "دخول غرفة العمليات" }).click();
  await page.waitForURL(origin + "/");
  await page
    .getByRole("heading", { name: "صورة واضحة. وخطوة تالية." })
    .waitFor();
  await page
    .getByRole("button", { name: "الأهداف", exact: false })
    .first()
    .click();
  await page
    .getByLabel("ما النتيجة التي تريد الوصول إليها؟")
    .fill("هدف اختبار محلي: تجهيز أول فاتورة");
  await page.getByLabel("بداية الأسبوع").fill("2026-10-19");
  await page.getByRole("button", { name: "حفظ للمراجعة" }).click();
  await page.getByRole("button", { name: "اعتماد الهدف", exact: true }).click();
  await page.getByText("معتمد", { exact: true }).waitFor();
  const support = await fetch(origin + "/api/support", {
    method: "POST",
    headers: {
      Origin: "https://daftar1.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "test-customer@example.com",
      description: "طلب اختبار محلي: أحتاج مساعدة في أول فاتورة",
      website: "",
    }),
  });
  assert.equal(support.status, 201);
  const ticket = await support.json();
  assert.deepEqual(Object.keys(ticket), ["reference"]);
  assert.equal(
    (
      await fetch(origin + "/api/support", {
        headers: { Origin: "https://daftar1.com" },
      })
    ).status,
    405,
  );
  assert.equal(
    (
      await fetch(origin + "/api/command", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ command: "resume" }),
      })
    ).status,
    403,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "دعم العملاء", exact: false })
    .first()
    .click();
  await page.getByText("طلب اختبار محلي: أحتاج مساعدة في أول فاتورة").waitFor();
  await page
    .getByLabel("ربط بهدف معتمد")
    .selectOption({ label: "هدف اختبار محلي: تجهيز أول فاتورة" });
  await page.getByRole("button", { name: "إنشاء مهمة دعم" }).click();
  await page.getByRole("button", { name: "فتح مهمة المتابعة" }).click();
  await page.getByRole("dialog").waitFor();
  await page.getByRole("button", { name: "إغلاق ×" }).click();
  await page
    .getByRole("button", { name: "الأقسام والفريق", exact: false })
    .first()
    .click();
  assert.equal(await page.locator(".department").count(), 8);
  await page
    .getByRole("button", { name: "ملخص اليوم", exact: false })
    .first()
    .click();
  await mkdir("../../test-results/operations", { recursive: true });
  await page.screenshot({
    path: "../../test-results/operations/desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "../../test-results/operations/mobile.png",
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: actual login/API, goal approval, support intake, CSRF rejection, 8 departments, RTL desktop/mobile without overflow. Local test records only.",
  );
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 400));
  await dbServer.stop();
  await pg.close();
}
