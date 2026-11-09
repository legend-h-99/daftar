import test, { beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes, scryptSync } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type { Store, DB } from "../src/db";
import { command, schedule, submitTicket, enqueue } from "../src/service";
import { claim, processJob, reserve } from "../src/engine";
import { digest, id, riyadh } from "../src/domain";
import { login, owner, logout, sameOrigin, cookieName } from "../src/auth";
import { safeCodePath } from "../src/engineering";
import type { Model } from "../src/model";
let pg: PGlite, store: Store;
const fake: Model = {
  draft: async () => ({
    output: {
      summary: "مسودة مع مصدر واضح وخطوة تالية للمراجعة.",
      evidence: ["سياق المهمة المدخل من المالك"],
      files: [],
      followups: [
        {
          title: "تحسين تجربة تسجيل أول فاتورة",
          department: "product",
          acceptance: "توثيق خطوات إعادة المشكلة والحل المقترح",
        },
      ],
    },
    inputTokens: 20,
    outputTokens: 20,
    costMicro: 100,
  }),
  review: async () => ({
    output: {
      pass: true,
      reason: "المخرج ضمن نطاق المهمة والأدلة متاحة في سياقها.",
    },
    inputTokens: 20,
    outputTokens: 20,
    costMicro: 100,
  }),
};
beforeEach(async () => {
  pg = new PGlite();
  await pg.exec(
    await readFile(
      new URL("../db/001_operations.sql", import.meta.url),
      "utf8",
    ),
  );
  store = {
    query: (s, p) => pg.query(s, p),
    transaction: (work) =>
      pg.transaction((tx) => work({ query: (s, p) => tx.query(s, p) })),
  };
  process.env.OPS_INPUT_SAR_PER_MILLION = "1";
  process.env.OPS_OUTPUT_SAR_PER_MILLION = "4";
  process.env.OPS_EMAIL_MAX_SAR = "0.01";
  delete process.env.RESEND_API_KEY;
  delete process.env.OPS_METRICS_URL;
});
afterEach(async () => {
  await pg.close();
});
const cmd = (commandName: string, data: Record<string, unknown> = {}) =>
  command(store, { command: commandName, data });
async function setup() {
  const g = await cmd("goal.create", {
    title: "تجهيز دفتر لأول مستخدمين",
    week: "2026-10-19",
  });
  await cmd("goal.approve", { id: g.id });
  await cmd("settings.save", { capSar: 100, paidEnabled: true });
  await cmd("resume");
  return g.id;
}
async function task(goalId: string, dept = "marketing") {
  return cmd("task.create", {
    goalId,
    title: "تجهيز محتوى تعريفي واضح",
    department: dept,
    agent: dept === "marketing" ? "كاتب محتوى" : "مدير منتج",
    reviewer: "مدير مشاريع",
    acceptance: "كتابة مسودة عربية مع المصدر دون ادعاءات غير مثبتة",
    context: "دفتر للمشاريع المنزلية. الدفع غير مفعل.",
  });
}
async function run() {
  const j = await claim(store);
  assert.ok(j);
  await processJob(store, j, fake);
  return j;
}
async function reviewed() {
  const g = await setup();
  const t = await task(g);
  await cmd("task.queue", { id: t.id });
  await run();
  await run();
  return t.id;
}
async function emailAction() {
  const t = await reviewed();
  const ticket = await submitTicket(
    store,
    {
      email: "customer@example.com",
      description: "تظهر مشكلة عند إنشاء أول فاتورة",
    },
    "one",
  );
  const a = await cmd("action.save", {
    taskId: t,
    kind: "email",
    payload: {
      ticketId: ticket.reference,
      subject: "مساعدتك في دفتر",
      text: "هذه مسودة رد بعد مراجعة المشكلة.",
    },
  });
  return (await store.query("SELECT * FROM ops_actions WHERE id=$1", [a.id]))
    .rows[0];
}
test("support → triage → independent review → product follow-up; tickets cannot be read publicly", async () => {
  const g = await setup();
  const ticket = await submitTicket(
    store,
    { email: "first@example.com", description: "لا أستطيع حفظ فاتورتي الأولى" },
    "client",
  );
  assert.deepEqual(Object.keys(ticket), ["reference"]);
  const t = await cmd("ticket.triage", { id: ticket.reference, goalId: g });
  assert.equal(
    (await cmd("ticket.triage", { id: ticket.reference, goalId: g })).id,
    t.id,
  );
  await cmd("task.queue", { id: t.id });
  await run();
  await run();
  const result = (
    await store.query("SELECT * FROM ops_tasks WHERE id=$1", [t.id])
  ).rows[0];
  assert.equal(result.status, "review");
  assert.ok(result.review_evidence);
  const children = (
    await store.query("SELECT * FROM ops_tasks WHERE parent_id=$1", [t.id])
  ).rows;
  assert.equal(children.length, 1);
  assert.equal(children[0].goal_id, g);
  assert.equal(children[0].status, "proposed");
  await cmd("task.complete", { id: t.id });
  assert.equal(
    (await store.query("SELECT status FROM ops_tasks WHERE id=$1", [t.id]))
      .rows[0].status,
    "done",
  );
});
test("marketing delivers reviewed draft without publishing", async () => {
  const t = await reviewed();
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_actions")).rows[0].n,
    0,
  );
  await cmd("task.complete", { id: t });
  const runs = (
    await store.query("SELECT agent FROM ops_runs WHERE task_id=$1", [t])
  ).rows;
  assert.notEqual(runs[0].agent, runs[1].agent);
});
test("cannot self-review, complete without evidence, or queue under an unapproved goal", async () => {
  const g = await cmd("goal.create", {
    title: "هدف تجريبي",
    week: "2026-10-19",
  });
  const t = await task(g.id);
  await assert.rejects(() => cmd("task.queue", { id: t.id }), /اعتمد/);
  await assert.rejects(() => cmd("task.complete", { id: t.id }), /أدلة/);
  await assert.rejects(
    () =>
      cmd("task.create", {
        goalId: g.id,
        title: "عنوان المهمة",
        department: "marketing",
        agent: "كاتب محتوى",
        reviewer: "كاتب محتوى",
        acceptance: "معيار قبول المهمة واضح",
      }),
    /مختلفين/,
  );
});
test("approval binds exact content and destination; edits cancel queued sends", async () => {
  const a = await emailAction();
  await cmd("action.approve", { id: a.id, digest: a.digest });
  await cmd("action.save", {
    id: a.id,
    taskId: a.task_id,
    kind: "email",
    payload: {
      ticketId: a.payload.ticketId,
      subject: "موضوع جديد",
      text: "رد معدّل يحتاج مراجعة أخرى.",
    },
  });
  const updated = (
    await store.query("SELECT * FROM ops_actions WHERE id=$1", [a.id])
  ).rows[0];
  assert.equal(updated.status, "pending");
  assert.equal(updated.approved_digest, null);
  assert.notEqual(updated.digest, a.digest);
  assert.equal(
    (await store.query("SELECT status FROM ops_jobs WHERE kind='action'"))
      .rows[0].status,
    "cancelled",
  );
  await assert.rejects(
    () => cmd("action.approve", { id: a.id, digest: a.digest }),
    /تغير/,
  );
});
test("budget reservation stops the provider before spending and persists across failures", async () => {
  const g = await setup();
  await cmd("settings.save", { capSar: 0.001, paidEnabled: true });
  const t = await task(g);
  await cmd("task.queue", { id: t.id });
  let called = false;
  const model: Model = {
    ...fake,
    draft: async () => {
      called = true;
      return fake.draft({}, {});
    },
  };
  await processJob(store, (await claim(store))!, model);
  assert.equal(called, false);
  assert.match(
    (await store.query("SELECT error FROM ops_tasks WHERE id=$1", [t.id]))
      .rows[0].error,
    /الميزانية/,
  );
  await cmd("settings.save", { capSar: 1, paidEnabled: true });
  await cmd("task.queue", { id: t.id });
  const j = (await claim(store))!;
  await processJob(store, j, {
    ...fake,
    draft: async () => {
      throw Error("network");
    },
  });
  assert.ok(
    Number(
      (
        await store.query(
          "SELECT reserved_micro FROM ops_usage WHERE job_id=$1",
          [j.id],
        )
      ).rows[0].reserved_micro,
    ) > 0,
  );
  assert.equal(
    (
      await store.query("SELECT actual_micro FROM ops_usage WHERE job_id=$1", [
        j.id,
      ])
    ).rows[0].actual_micro,
    null,
  );
});
test("reservations cannot oversubscribe a cap", async () => {
  await setup();
  await cmd("settings.save", { capSar: 1, paidEnabled: true });
  await enqueue(store, "agent", "a");
  const j = (await store.query("SELECT id FROM ops_jobs")).rows[0];
  await store.transaction((db) => reserve(db, j.id, 700000));
  await assert.rejects(
    () => store.transaction((db) => reserve(db, j.id, 700000)),
    /الميزانية/,
  );
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_usage")).rows[0].n,
    1,
  );
});
test("daily schedule runs at 09:00 Riyadh once, within the approved week; no task pile-up", async () => {
  await setup();
  await schedule(store, new Date("2026-10-20T05:59:00Z"));
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_jobs")).rows[0].n,
    0,
  );
  await schedule(store, new Date("2026-10-20T06:00:00Z"));
  await schedule(store, new Date("2026-10-20T07:00:00Z"));
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_tasks")).rows[0].n,
    8,
  );
  await schedule(store, new Date("2026-10-21T06:00:00Z"));
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_tasks")).rows[0].n,
    8,
  );
  assert.equal(riyadh(new Date("2026-10-20T21:30:00Z")).day, "2026-10-21");
});
test("restart recovers internal leases but never repeats an uncertain external send", async () => {
  await setup();
  await enqueue(store, "agent", "lease");
  const internal = (await claim(store))!;
  await store.query(
    "UPDATE ops_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
    [internal.id],
  );
  const reclaimed = (await claim(store))!;
  assert.equal(reclaimed.id, internal.id);
  assert.notEqual(reclaimed.lease_token, internal.lease_token);
  await store.query("UPDATE ops_jobs SET status='done' WHERE id=$1", [
    internal.id,
  ]);
  const actionId = id();
  await store.query(
    "INSERT INTO ops_actions(id,kind,payload,digest,status) VALUES($1,'email','{}','hash','executing')",
    [actionId],
  );
  await enqueue(store, "action", "email", null, { actionId });
  const external = (await claim(store))!;
  await store.query(
    "UPDATE ops_jobs SET lease_until=now()-interval '1 second' WHERE id=$1",
    [external.id],
  );
  assert.equal(await claim(store), null);
  assert.equal(
    (
      await store.query("SELECT status FROM ops_actions WHERE id=$1", [
        actionId,
      ])
    ).rows[0].status,
    "uncertain",
  );
});
test("pause cancels queued work and approved actions, does not silently resume them", async () => {
  const a = await emailAction();
  await cmd("action.approve", { id: a.id, digest: a.digest });
  await cmd("pause");
  assert.equal(await claim(store), null);
  assert.equal(
    (await store.query("SELECT status FROM ops_actions WHERE id=$1", [a.id]))
      .rows[0].status,
    "cancelled",
  );
  await cmd("resume");
  assert.equal(await claim(store), null);
});
test("email uses provider idempotency key and runs only once with exact approval", async () => {
  const a = await emailAction();
  await cmd("action.approve", { id: a.id, digest: a.digest });
  process.env.RESEND_API_KEY = "test-key";
  process.env.OPS_SUPPORT_FROM = "support@example.com";
  let count = 0;
  const original = global.fetch;
  global.fetch = async (_url, options) => {
    count++;
    assert.equal(
      new Headers(options?.headers).get("Idempotency-Key"),
      `ops-${a.id}-1`,
    );
    assert.equal(
      JSON.parse(String(options?.body)).to[0],
      "customer@example.com",
    );
    return Response.json({ id: "receipt-test" });
  };
  try {
    await run();
    assert.equal(await claim(store), null);
    assert.equal(count, 1);
    assert.equal(
      (await store.query("SELECT status FROM ops_actions WHERE id=$1", [a.id]))
        .rows[0].status,
      "done",
    );
  } finally {
    global.fetch = original;
  }
});
test("uncertain email is not re-sent after network loss", async () => {
  const a = await emailAction();
  await cmd("action.approve", { id: a.id, digest: a.digest });
  process.env.RESEND_API_KEY = "test";
  process.env.OPS_SUPPORT_FROM = "support@example.com";
  const original = global.fetch;
  global.fetch = async () => {
    throw Error("connection reset");
  };
  try {
    await run();
    assert.equal(
      (await store.query("SELECT status FROM ops_actions WHERE id=$1", [a.id]))
        .rows[0].status,
      "uncertain",
    );
    assert.equal(await claim(store), null);
  } finally {
    global.fetch = original;
  }
});
test("owner sessions reject anonymous, wrong owner, bad origin and revoked sessions", async () => {
  const salt = randomBytes(16).toString("hex");
  process.env.OPS_PASSWORD_HASH =
    salt + ":" + scryptSync("a-long-test-password", salt, 64).toString("hex");
  process.env.OPS_SESSION_SECRET = "s".repeat(40);
  process.env.OPS_OWNER_EMAIL = "owner@example.com";
  process.env.OPS_ORIGIN = "http://localhost:3100";
  await assert.rejects(() =>
    owner(store, new Request("http://localhost:3100")),
  );
  await assert.rejects(() =>
    login(
      store,
      { email: "other@example.com", password: "a-long-test-password" },
      "x",
    ),
  );
  assert.throws(() =>
    sameOrigin(
      new Request("http://localhost:3100", {
        headers: { Origin: "https://evil.example" },
      }),
    ),
  );
  const cookie = await login(
    store,
    { email: "owner@example.com", password: "a-long-test-password" },
    "x",
  );
  const req = new Request("http://localhost:3100", {
    headers: { Cookie: cookie.split(";")[0] },
  });
  await owner(store, req);
  assert.ok(cookie.includes("HttpOnly"));
  await logout(store, req);
  await assert.rejects(() => owner(store, req));
});
test("support rate limiting and honeypot reject abuse", async () => {
  for (let i = 0; i < 5; i++)
    await submitTicket(
      store,
      { email: "user@example.com", description: "مشكلة دعم تحتاج متابعة" },
      "same",
    );
  await assert.rejects(
    () =>
      submitTicket(
        store,
        { email: "user@example.com", description: "مشكلة دعم تحتاج متابعة" },
        "same",
      ),
    /طلبات كثيرة/,
  );
  await assert.rejects(() =>
    submitTicket(
      store,
      {
        email: "user@example.com",
        description: "مشكلة دعم تحتاج متابعة",
        website: "bot",
      },
      "another",
    ),
  );
});
test("engineering cannot write env, traversal, workflows or arbitrary files", () => {
  assert.equal(safeCodePath("apps/web/app/support/page.tsx"), true);
  for (const p of [
    "../.env",
    "apps/web/lib/../../.env",
    "apps/web/.env.ts",
    "apps/web/lib/../evil.ts",
    "apps/web/package.json",
    ".github/workflows/main.yml",
  ])
    assert.equal(safeCodePath(p), false, p);
  assert.equal(digest({ b: 2, a: 1 }), digest({ a: 1, b: 2 }));
});

test("read-only product metrics exclude demo and configured founder accounts", async () => {
  await pg.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
 CREATE TABLE "User"(id text,phone text,"businessId" text);
 CREATE TABLE "Business"(id text,"ownerPhone" text);
 CREATE TABLE "Invoice"("businessId" text,"createdAt" timestamp);
 CREATE TABLE "Expense"("businessId" text,"createdAt" timestamp);
 CREATE TABLE "Purchase"("businessId" text,"createdAt" timestamp);
 CREATE TABLE "ApiErrorEvent"("createdAt" timestamptz);
 INSERT INTO "Business" VALUES ('real','+966511111111'),('demo','+966500000001'),('owner','+966522222222');
 INSERT INTO "User" VALUES ('u1','+966511111111','real'),('u2','+966500000001','demo'),('u3','+966522222222','owner');
 INSERT INTO "Invoice" VALUES('real',now()),('demo',now()),('owner',now());`);
  await pg.exec(
    await readFile(
      new URL(
        "../../../supabase/migrations/20261020100000_operations_metrics.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const result = (
    await store.query("SELECT public.operations_metrics(ARRAY['u3']) AS data")
  ).rows[0].data;
  assert.equal(result.users, 1);
  assert.equal(result.invoices7d, 1);
  assert.equal(result.activeBusinesses7d, 1);
  assert.equal(result.revenue, undefined);
});

test("failed connectors produce an explicit unavailable report, not invented metrics", async () => {
  await setup();
  await enqueue(store, "report", "report-test", null, { day: "2026-10-20" });
  await run();
  const report = (await store.query("SELECT body FROM ops_reports")).rows[0]
    .body;
  assert.equal(report.metrics.connected, false);
  assert.equal(report.metrics.values, undefined);
  assert.match(report.metrics.notice, /لا توجد بيانات كافية/);
});

test("owner reconciliation records evidence and cannot silently resend an unknown email", async () => {
  const a = await emailAction();
  await store.query("UPDATE ops_actions SET status='uncertain' WHERE id=$1", [
    a.id,
  ]);
  await assert.rejects(() =>
    cmd("action.approve", { id: a.id, digest: a.digest }),
  );
  await cmd("action.reconcile", {
    id: a.id,
    sent: true,
    receipt: "Provider delivery receipt test-123",
  });
  assert.equal(
    (await store.query("SELECT status FROM ops_actions WHERE id=$1", [a.id]))
      .rows[0].status,
    "done",
  );
  assert.equal(await claim(store), null);
  await cmd("task.complete", { id: a.task_id });
});

test("incoming support is processed before 09:00 only under the owner-selected active goal", async () => {
  const { intake } = await import("../src/service");
  const goal = await setup();
  const ticket = await submitTicket(
    store,
    {
      email: "event@example.com",
      description: "مشكلة تصل قبل دورة التخطيط اليومية",
    },
    "event",
  );
  await intake(store, new Date("2026-10-20T02:00:00Z"));
  assert.equal(
    (
      await store.query("SELECT task_id FROM ops_tickets WHERE id=$1", [
        ticket.reference,
      ])
    ).rows[0].task_id,
    null,
  );
  await cmd("support.configure", { goalId: goal });
  await intake(store, new Date("2026-10-20T02:00:00Z"));
  await intake(store, new Date("2026-10-20T02:00:00Z"));
  assert.equal(
    (await store.query("SELECT count(*) n FROM ops_jobs")).rows[0].n,
    1,
  );
  const second = await submitTicket(
    store,
    {
      email: "event@example.com",
      description: "مشكلة تصل بعد انتهاء صلاحية الهدف الأسبوعي",
    },
    "event2",
  );
  await intake(store, new Date("2026-10-27T02:00:00Z"));
  assert.equal(
    (
      await store.query("SELECT task_id FROM ops_tickets WHERE id=$1", [
        second.reference,
      ])
    ).rows[0].task_id,
    null,
  );
});

test("a completed lease cannot overwrite its output or run again after a worker restart", async () => {
  const goal = await setup();
  const t = await task(goal);
  await cmd("task.queue", { id: t.id });
  const job = (await claim(store))!;
  let calls = 0;
  const model: Model = {
    ...fake,
    draft: async (task, context) => {
      calls++;
      return fake.draft(task, context);
    },
  };
  await processJob(store, job, model);
  await processJob(store, job, model);
  assert.equal(calls, 1);
  assert.equal(
    (await store.query("SELECT status FROM ops_tasks WHERE id=$1", [t.id]))
      .rows[0].status,
    "review",
  );
  assert.equal(
    (
      await store.query("SELECT count(*) n FROM ops_runs WHERE task_id=$1", [
        t.id,
      ])
    ).rows[0].n,
    1,
  );
  assert.equal(
    (
      await store.query(
        "SELECT count(*) n FROM ops_jobs WHERE task_id=$1 AND kind='review'",
        [t.id],
      )
    ).rows[0].n,
    1,
  );
});

test("owner can correct a blocked task context before retrying, but cannot edit a running task", async () => {
  const goal = await setup();
  const t = await task(goal);
  await cmd("task.update", {
    id: t.id,
    title: "تجهيز محتوى أكثر تحديدًا",
    acceptance: "مسودة بثلاث رسائل واضحة مرتبطة بالقيمة",
    context: "مصدر محدث من المالك",
  });
  assert.equal(
    (await store.query("SELECT context FROM ops_tasks WHERE id=$1", [t.id]))
      .rows[0].context,
    "مصدر محدث من المالك",
  );
  await cmd("task.queue", { id: t.id });
  await assert.rejects(
    () =>
      cmd("task.update", {
        id: t.id,
        title: "تغيير المهمة",
        acceptance: "معيار قبول جديد للمهمة",
        context: "سياق آخر",
      }),
    /يمكن تعديل/,
  );
});
