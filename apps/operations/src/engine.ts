import type { DB, Store } from "./db";
import {
  departments,
  digest,
  Fault,
  id,
  month,
  type AgentOutput,
} from "./domain";
import { audit, enqueue } from "./service";
import {
  openAIModel,
  reservation,
  type Model,
  type ModelResult,
} from "./model";
import { codeContext, sandbox } from "./engineering";
export async function reserve(
  db: DB,
  jobId: string,
  amount: number,
  provider = "openai",
) {
  const s = (await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE"))
    .rows[0];
  if (s.paused || !s.paid_enabled) throw new Fault("التشغيل المدفوع غير معتمد");
  const used = (
    await db.query(
      "SELECT coalesce(sum(coalesce(actual_micro,reserved_micro)),0) AS n FROM ops_usage WHERE month=$1",
      [month()],
    )
  ).rows[0].n;
  if (Number(used) + amount > Number(s.monthly_cap_micro))
    throw new Fault("وصل التشغيل إلى سقف الميزانية");
  const usageId = id();
  await db.query(
    "INSERT INTO ops_usage(id,job_id,provider,reserved_micro,month) VALUES($1,$2,$3,$4,$5)",
    [usageId, jobId, provider, amount, month()],
  );
  return usageId;
}
async function settle(db: DB, usageId: string, r: ModelResult<unknown>) {
  await db.query(
    "UPDATE ops_usage SET actual_micro=$2,input_tokens=$3,output_tokens=$4 WHERE id=$1",
    [usageId, r.costMicro, r.inputTokens, r.outputTokens],
  );
}
export async function claim(store: Store) {
  return store.transaction(async (db) => {
    const settings = (
      await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    // External sends are never automatically retried after a lost lease; reconcile with the provider first.
    const expired = (
      await db.query(
        "SELECT * FROM ops_jobs WHERE status='running' AND lease_until<now() FOR UPDATE",
      )
    ).rows;
    for (const job of expired) {
      const uncertain = job.kind === "action";
      const status = uncertain
        ? "uncertain"
        : job.attempts >= 3
          ? "failed"
          : settings.paused
            ? "cancelled"
            : "queued";
      await db.query(
        "UPDATE ops_jobs SET status=$2,lease_token=null,lease_until=null,error=$3 WHERE id=$1",
        [
          job.id,
          status,
          uncertain
            ? "نتيجة الإرسال غير معروفة؛ تحقق من المزود"
            : "انتهت مهلة التشغيل",
        ],
      );
      if (uncertain)
        await db.query(
          "UPDATE ops_actions SET status='uncertain' WHERE id=$1 AND status='executing'",
          [job.payload.actionId],
        );
      if (job.task_id && ["failed", "cancelled"].includes(status))
        await db.query(
          "UPDATE ops_tasks SET status='blocked',error='انتهت مهلة المحاولات' WHERE id=$1",
          [job.task_id],
        );
    }
    if (settings.paused) return null;
    const job = (
      await db.query(
        "SELECT * FROM ops_jobs WHERE status='queued' AND available_at<=now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!job) return null;
    const token = id();
    await db.query(
      "UPDATE ops_jobs SET status='running',attempts=attempts+1,lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1",
      [job.id, token],
    );
    return { ...job, id: String(job.id), lease_token: token };
  });
}
async function fenced(db: DB, job: Record<string, any>) {
  await db.query("SELECT id FROM ops_settings WHERE id=1 FOR UPDATE");
  const current = (
    await db.query(
      "SELECT * FROM ops_jobs WHERE id=$1 AND status='running' AND lease_token=$2 AND lease_until>now() FOR UPDATE",
      [job.id, job.lease_token],
    )
  ).rows[0];
  if (!current) throw new Fault("انتهت ملكية المهمة");
}
async function finish(db: DB, job: Record<string, any>) {
  await db.query(
    "UPDATE ops_jobs SET status='done',lease_until=null,lease_token=null WHERE id=$1",
    [job.id],
  );
}
async function paid<T>(
  store: Store,
  job: Record<string, any>,
  call: () => Promise<ModelResult<T>>,
) {
  const usage = await store.transaction(async (db) => {
    await fenced(db, job);
    return reserve(db, job.id, reservation());
  });
  // If the provider outcome is unknown the reservation remains charged conservatively.
  const result = await call();
  await store.transaction(async (db) => {
    await settle(db, usage, result);
  });
  return result.output;
}
export async function metrics() {
  if (!process.env.OPS_METRICS_URL || !process.env.OPS_METRICS_TOKEN)
    return {
      connected: false,
      notice: "لا توجد بيانات كافية؛ موصل المؤشرات غير متصل",
    };
  const url = new URL(process.env.OPS_METRICS_URL);
  if (url.protocol !== "https:") throw new Fault("موصل المؤشرات يحتاج HTTPS");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.OPS_METRICS_TOKEN}` },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  });
  if (!res.ok) throw new Fault("تعذر الوصول لمصدر المؤشرات");
  const text = await res.text();
  if (text.length > 20000) throw new Fault("استجابة المؤشرات أكبر من الحد");
  const raw = JSON.parse(text);
  // Explicit aggregate allowlist; never return emails or raw accounting records to a model.
  const values: Record<string, number> = {};
  for (const key of [
    "users",
    "businesses",
    "onboardedUsers",
    "activeBusinesses7d",
    "invoices7d",
    "errors24h",
  ])
    if (
      typeof raw[key] === "number" &&
      Number.isFinite(raw[key]) &&
      raw[key] >= 0
    )
      values[key] = raw[key];
  return {
    connected: true,
    values,
    source: url.origin + url.pathname,
    observedAt: new Date().toISOString(),
    verifiedCustomers: false,
    revenue: null,
    notice:
      "أعداد حسابات ونشاط وليست عملاء فعليين أو إيرادات؛ تحقق من استبعاد التجريبي",
  };
}
async function sendAction(store: Store, job: Record<string, any>) {
  if (!process.env.RESEND_API_KEY || !process.env.OPS_SUPPORT_FROM)
    throw new Fault("بريد الدعم غير متصل");
  const emailRate = Number(process.env.OPS_EMAIL_MAX_SAR);
  if (!Number.isFinite(emailRate) || emailRate <= 0)
    throw new Fault("حدد الحد الأعلى لتكلفة الرسالة قبل الإرسال");
  const a: Record<string, any> = await store.transaction(async (db) => {
    await fenced(db, job);
    const s = (
      await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    if (s.paused || !s.paid_enabled) throw new Fault("الإرسال غير مفعّل");
    const action = (
      await db.query("SELECT * FROM ops_actions WHERE id=$1 FOR UPDATE", [
        job.payload.actionId,
      ])
    ).rows[0];
    if (
      !action ||
      action.kind !== "email" ||
      action.status !== "approved" ||
      action.digest !== job.payload.digest ||
      action.approved_digest !== action.digest ||
      digest({ kind: action.kind, payload: action.payload }) !== action.digest
    )
      throw new Fault("الموافقة غير صالحة");
    const usageId = await reserve(
      db,
      job.id,
      Math.ceil(emailRate * 1e6),
      "resend",
    );
    await db.query("UPDATE ops_actions SET status='executing' WHERE id=$1", [
      action.id,
    ]);
    await audit(db, "worker", "email.started", action.id);
    return { ...action, usageId };
  });
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ops-${a.id}-${a.revision}`,
      },
      body: JSON.stringify({
        from: process.env.OPS_SUPPORT_FROM,
        to: [a.payload.to],
        subject: a.payload.subject,
        text: a.payload.text,
      }),
    });
    if (!res.ok) throw new Fault(`لم يتأكد الإرسال (${res.status})`);
    const result = await res.json();
    if (typeof result.id !== "string") throw new Fault("لم يصل إيصال الإرسال");
    await store.transaction(async (db) => {
      await fenced(db, job);
      await db.query(
        "UPDATE ops_actions SET status='done',receipt=$2 WHERE id=$1",
        [a.id, result.id],
      );
      await db.query(
        "UPDATE ops_usage SET actual_micro=reserved_micro WHERE id=$1",
        [a.usageId],
      );
      await audit(db, "worker", "email.sent", a.id, { receipt: result.id });
      await finish(db, job);
    });
  } catch (e) {
    await store.query(
      "UPDATE ops_actions SET status='uncertain' WHERE id=$1 AND status='executing'",
      [a.id],
    );
    throw e;
  }
}
export async function processJob(
  store: Store,
  job: Record<string, any>,
  model: Model = openAIModel,
) {
  try {
    if (job.kind === "report") {
      let data: unknown;
      try {
        data = await metrics();
      } catch {
        data = {
          connected: false,
          notice: "تعذر تحديث المؤشرات؛ لا توجد بيانات كافية",
        };
      }
      await store.transaction(async (db) => {
        await fenced(db, job);
        const counts = (
          await db.query(
            "SELECT status,count(*) AS count FROM ops_tasks GROUP BY status",
          )
        ).rows;
        const approvals = (
          await db.query(
            "SELECT count(*) AS count FROM ops_actions WHERE status='pending'",
          )
        ).rows[0];
        await db.query(
          "INSERT INTO ops_reports(id,day,body) VALUES($1,$2,$3) ON CONFLICT(day) DO UPDATE SET body=excluded.body",
          [
            id(),
            job.payload.day,
            JSON.stringify({
              metrics: data,
              tasks: counts,
              pendingApprovals: Number(approvals.count),
              summary:
                "ملخص من سجل المهام؛ اكتمال المهمة يتطلب دليلًا ومراجعة.",
            }),
          ],
        );
        await finish(db, job);
      });
    } else if (job.kind === "action") {
      await sendAction(store, job);
    } else if (job.kind === "agent" || job.kind === "review") {
      const task = (
        await store.query(
          "SELECT t.*,g.approved FROM ops_tasks t JOIN ops_goals g ON g.id=t.goal_id WHERE t.id=$1",
          [job.task_id],
        )
      ).rows[0];
      if (!task?.approved) throw new Fault("الهدف غير معتمد");
      if (job.kind === "agent") {
        await store.transaction(async (db) => {
          await fenced(db, job);
          await db.query(
            "UPDATE ops_tasks SET status='running' WHERE id=$1 AND status<>'done'",
            [task.id],
          );
        });
        const context: any =
          task.department === "engineering"
            ? await codeContext(task.context)
            : await metrics().catch(() => ({
                notice: "مصدر المؤشرات غير متاح",
              }));
        if (
          task.department === "engineering" &&
          (!context.base || !context.files?.length)
        )
          throw new Fault("حدد مسارات ملفات المصدر المطلوبة في سياق المهمة");
        const output = await paid(store, job, () => model.draft(task, context));
        let engineering: unknown = null;
        if (task.department === "engineering") {
          if (
            !("base" in context) ||
            !context.base ||
            !("files" in context) ||
            !context.files?.length
          )
            throw new Fault("حدد مسارات ملفات المصدر المطلوبة في سياق المهمة");
          // Exact path tokens from the task context, not substrings: "lib/a.ts" must not match "apps/web/lib/a.ts".
          const mentioned = new Set(task.context.split(/[\s,;()"'`]+/));
          if (output.files.some((f) => !mentioned.has(f.path)))
            throw new Fault("التغيير يشمل ملفًا خارج المسارات المحددة للمهمة");
          engineering = await sandbox(
            `${task.id}-${job.lease_token}`,
            context.base,
            output.files,
          );
        }
        await store.transaction(async (db) => {
          await fenced(db, job);
          await db.query(
            "INSERT INTO ops_runs(id,task_id,agent,status,output) VALUES($1,$2,$3,$4,$5)",
            [
              id(),
              task.id,
              task.agent,
              "drafted",
              JSON.stringify({ ...output, engineering }),
            ],
          );
          await db.query(
            "UPDATE ops_tasks SET status='review',evidence=$2,error=null WHERE id=$1",
            [task.id, JSON.stringify({ ...output, engineering })],
          );
          const paused = (
            await db.query("SELECT paused FROM ops_settings WHERE id=1")
          ).rows[0].paused;
          if (!paused) await enqueue(db, "review", `review:${job.id}`, task.id);
          else
            await db.query(
              "UPDATE ops_tasks SET status='blocked',error='توقفت المراجعة بأمر المالك' WHERE id=$1",
              [task.id],
            );
          await finish(db, job);
        });
      } else {
        if (!task.evidence) throw new Fault("لا يوجد مخرج للمراجعة");
        const reviewOutput = {
          ...task.evidence,
          files: task.evidence.files?.map((f: any) => ({
            path: f.path,
            content: f.content.slice(0, 3000),
          })),
          engineering: task.evidence.engineering
            ? {
                passed: task.evidence.engineering.passed,
                base: task.evidence.engineering.base,
                log: task.evidence.engineering.log.slice(-4000),
              }
            : null,
        };
        const reviewed = await paid(store, job, () =>
          model.review(task, reviewOutput),
        );
        await store.transaction(async (db) => {
          await fenced(db, job);
          await db.query(
            "INSERT INTO ops_runs(id,task_id,agent,status,output) VALUES($1,$2,$3,$4,$5)",
            [
              id(),
              task.id,
              task.reviewer,
              reviewed.pass ? "passed" : "rejected",
              JSON.stringify(reviewed),
            ],
          );
          const pass =
            reviewed.pass &&
            task.evidence.evidence?.length > 0 &&
            (task.department !== "engineering" ||
              task.evidence.engineering?.passed === true);
          await db.query(
            "UPDATE ops_tasks SET status=$2,review_evidence=$3,error=$4 WHERE id=$1",
            [
              task.id,
              pass ? "review" : "blocked",
              pass ? reviewed.reason : null,
              pass ? null : reviewed.reason,
            ],
          );
          // Follow-ups remain proposals. One generation only, at most 3, same approved goal.
          if (pass && !task.parent_id) {
            const existing = (
              await db.query("SELECT id FROM ops_tasks WHERE parent_id=$1", [
                task.id,
              ])
            ).rows.length;
            const output = task.evidence as AgentOutput;
            for (const f of output.followups.slice(
              0,
              Math.max(0, 3 - existing),
            )) {
              const dept = departments.find((d) => d.id === f.department)!;
              const reviewer =
                dept.id === "management" ? "مدير منتج" : "مدير مشاريع";
              await db.query(
                "INSERT INTO ops_tasks(id,goal_id,parent_id,title,department,agent,reviewer,acceptance,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",
                [
                  id(),
                  task.goal_id,
                  task.id,
                  f.title,
                  f.department,
                  dept.agents[0],
                  reviewer,
                  f.acceptance,
                  `مصدر: المهمة ${task.id}\n${task.evidence.summary.slice(0, 3000)}`,
                ],
              );
            }
          }
          await finish(db, job);
        });
      }
    } else throw new Fault("نوع مهمة غير مدعوم");
  } catch (e) {
    const message =
      e instanceof Fault
        ? e.message
        : "تعذر التنفيذ؛ افحص الاتصال والإعدادات ثم أعد المهمة";
    await store.transaction(async (db) => {
      await db.query("SELECT id FROM ops_settings WHERE id=1 FOR UPDATE");
      const current = (
        await db.query(
          "SELECT * FROM ops_jobs WHERE id=$1 AND lease_token=$2 FOR UPDATE",
          [job.id, job.lease_token],
        )
      ).rows[0];
      if (!current) return;
      const action =
        job.kind === "action"
          ? (
              await db.query("SELECT status FROM ops_actions WHERE id=$1", [
                job.payload.actionId,
              ])
            ).rows[0]
          : null;
      await db.query(
        "UPDATE ops_jobs SET status=$2,error=$3,lease_until=null,lease_token=null WHERE id=$1",
        [
          job.id,
          action?.status === "uncertain" ? "uncertain" : "failed",
          message,
        ],
      );
      if (job.task_id)
        await db.query(
          "UPDATE ops_tasks SET status='blocked',error=$2 WHERE id=$1",
          [job.task_id, message],
        );
      await audit(db, "worker", "job.failed", job.id, { message });
    });
  }
}
