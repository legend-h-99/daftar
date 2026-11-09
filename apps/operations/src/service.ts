import { z } from "zod";
import { codeContext } from "./engineering";
import type { DB, Store } from "./db";
import {
  actionInput,
  departments,
  digest,
  Fault,
  id,
  month,
  required,
  riyadh,
  taskInput,
  validateAgents,
} from "./domain";
export async function audit(
  db: DB,
  actor: string,
  action: string,
  target: string,
  detail: unknown = {},
) {
  await db.query(
    "INSERT INTO ops_audit(id,actor,action,target,detail) VALUES($1,$2,$3,$4,$5)",
    [id(), actor, action, target, JSON.stringify(detail)],
  );
}
export async function enqueue(
  db: DB,
  kind: string,
  key: string,
  taskId: string | null = null,
  payload: unknown = {},
) {
  await db.query(
    "INSERT INTO ops_jobs(id,kind,dedupe_key,task_id,payload) VALUES($1,$2,$3,$4,$5) ON CONFLICT(dedupe_key) DO NOTHING",
    [id(), kind, key, taskId, JSON.stringify(payload)],
  );
}
export async function limit(db: DB, key: string, max: number, seconds: number) {
  const { rows } = await db.query(
    `INSERT INTO ops_limits(key,hits,expires_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN ops_limits.expires_at<now() THEN 1 ELSE ops_limits.hits+1 END, expires_at=CASE WHEN ops_limits.expires_at<now() THEN now()+$2*interval '1 second' ELSE ops_limits.expires_at END RETURNING hits`,
    [key, seconds],
  );
  if (rows[0].hits > max) throw new Fault("طلبات كثيرة؛ حاول لاحقًا", 429);
}
export async function snapshot(db: DB) {
  const names = [
    "goals",
    "tasks",
    "tickets",
    "actions",
    "runs",
    "reports",
    "audit",
  ];
  const out: Record<string, any> = {};
  for (const name of names)
    out[name] = (
      await db.query(
        `SELECT * FROM ops_${name} ORDER BY created_at DESC LIMIT 100`,
      )
    ).rows;
  out.settings = (
    await db.query("SELECT * FROM ops_settings WHERE id=1")
  ).rows[0];
  out.jobs = (
    await db.query(
      "SELECT id,kind,status,attempts,error,created_at FROM ops_jobs WHERE status IN ('running','uncertain','failed') ORDER BY created_at DESC LIMIT 30",
    )
  ).rows;
  out.usage = (
    await db.query(
      "SELECT provider, sum(coalesce(actual_micro,reserved_micro)) AS total_micro, count(*) AS calls FROM ops_usage WHERE month=$1 GROUP BY provider",
      [month()],
    )
  ).rows;
  out.connectors = {
    model: Boolean(process.env.OPENAI_API_KEY && process.env.OPS_MODEL),
    email: Boolean(process.env.RESEND_API_KEY && process.env.OPS_SUPPORT_FROM),
    metrics: Boolean(
      process.env.OPS_METRICS_URL && process.env.OPS_METRICS_TOKEN,
    ),
    engineering: Boolean(
      process.env.OPS_REPO_PATH && process.env.OPS_SANDBOX_IMAGE,
    ),
    social: false,
  };
  return out;
}
export async function submitTicket(store: Store, input: unknown, key: string) {
  const data = z
    .object({
      email: z.string().email().max(254),
      description: z.string().trim().min(10).max(4000),
      website: z.string().max(200).optional(),
    })
    .strict()
    .parse(input);
  if (data.website) throw new Fault("تعذر إرسال الطلب");
  return store.transaction(async (db) => {
    await limit(db, `support:${key}`, 5, 3600);
    await limit(db, "support:global", 100, 3600);
    const ticketId = id();
    await db.query(
      "INSERT INTO ops_tickets(id,email,description) VALUES($1,$2,$3)",
      [ticketId, data.email, data.description],
    );
    await audit(db, "public", "ticket.created", ticketId);
    return { reference: ticketId };
  });
}
export async function command(store: Store, input: unknown) {
  const body = z
    .object({ command: z.string(), data: z.record(z.string(), z.unknown()).default({}) })
    .strict()
    .parse(input);
  const d = body.data;
  return store.transaction(async (db) => {
    const settings = (
      await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    switch (body.command) {
      case "goal.create": {
        const title = required(d.title, 200);
        const week = z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .parse(d.week);
        const goalId = id();
        await db.query(
          "INSERT INTO ops_goals(id,title,week_start) VALUES($1,$2,$3)",
          [goalId, title, week],
        );
        await audit(db, "owner", body.command, goalId);
        return { id: goalId };
      }
      case "goal.approve": {
        const goalId = z.string().uuid().parse(d.id);
        const r = await db.query(
          "UPDATE ops_goals SET approved=true WHERE id=$1 RETURNING id",
          [goalId],
        );
        if (!r.rows.length) throw new Fault("الهدف غير موجود", 404);
        await audit(db, "owner", body.command, goalId);
        break;
      }
      case "task.create": {
        const t = taskInput.parse(d);
        validateAgents(t.agent, t.reviewer, t.department);
        const goal = (
          await db.query("SELECT * FROM ops_goals WHERE id=$1", [t.goalId])
        ).rows[0];
        if (!goal) throw new Fault("الهدف غير موجود");
        const taskId = id();
        await db.query(
          "INSERT INTO ops_tasks(id,goal_id,title,department,agent,reviewer,acceptance,context) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
          [
            taskId,
            t.goalId,
            t.title,
            t.department,
            t.agent,
            t.reviewer,
            t.acceptance,
            t.context,
          ],
        );
        await audit(db, "owner", body.command, taskId);
        return { id: taskId };
      }
      case "task.update": {
        const update = z
          .object({
            id: z.string().uuid(),
            title: taskInput.shape.title,
            acceptance: taskInput.shape.acceptance,
            context: taskInput.shape.context,
          })
          .strict()
          .parse(d);
        const task = (
          await db.query("SELECT * FROM ops_tasks WHERE id=$1 FOR UPDATE", [
            update.id,
          ])
        ).rows[0];
        if (!task || !["proposed", "blocked"].includes(task.status))
          throw new Fault("يمكن تعديل المهمة المقترحة أو المتعثرة فقط");
        if (
          (
            await db.query(
              "SELECT id FROM ops_jobs WHERE task_id=$1 AND status='running' LIMIT 1",
              [task.id],
            )
          ).rows.length ||
          (
            await db.query(
              "SELECT id FROM ops_actions WHERE task_id=$1 AND status IN ('pending','approved','executing','uncertain') LIMIT 1",
              [task.id],
            )
          ).rows.length
        )
          throw new Fault("توجد عملية أو موافقة نشطة لهذه المهمة");
        await db.query(
          "UPDATE ops_jobs SET status='cancelled' WHERE task_id=$1 AND status='queued'",
          [task.id],
        );
        await db.query(
          "UPDATE ops_tasks SET title=$2,acceptance=$3,context=$4,evidence=null,review_evidence=null,error=null WHERE id=$1",
          [task.id, update.title, update.acceptance, update.context],
        );
        await audit(db, "owner", body.command, task.id);
        break;
      }
      case "task.queue": {
        const t = (
          await db.query(
            "SELECT t.*,g.approved FROM ops_tasks t JOIN ops_goals g ON g.id=t.goal_id WHERE t.id=$1 FOR UPDATE OF t",
            [z.string().uuid().parse(d.id)],
          )
        ).rows[0];
        if (!t || !t.approved) throw new Fault("اعتمد الهدف أولًا");
        if (settings.paused) throw new Fault("التشغيل متوقف");
        if (!["proposed", "blocked"].includes(t.status))
          throw new Fault("المهمة ليست جاهزة لإعادة التشغيل");
        await db.query(
          "UPDATE ops_tasks SET status='ready',error=null,review_evidence=null WHERE id=$1",
          [t.id],
        );
        await enqueue(db, "agent", `manual:${t.id}:${id()}`, t.id);
        await audit(db, "owner", body.command, t.id);
        break;
      }
      case "task.complete": {
        const t = (
          await db.query("SELECT * FROM ops_tasks WHERE id=$1 FOR UPDATE", [
            z.string().uuid().parse(d.id),
          ])
        ).rows[0];
        if (
          !t ||
          !["review", "approval"].includes(t.status) ||
          !t.evidence?.summary ||
          !t.evidence?.evidence?.length ||
          !t.review_evidence
        )
          throw new Fault("يلزم مخرج وأدلة ومراجعة مستقلة قبل الإغلاق");
        if (
          (
            await db.query(
              "SELECT id FROM ops_actions WHERE task_id=$1 AND status IN ('pending','approved','executing','uncertain') LIMIT 1",
              [t.id],
            )
          ).rows.length
        )
          throw new Fault("أكمل أو ألغ الإجراءات المعلقة قبل إغلاق المهمة");
        if (t.department === "engineering" && !t.evidence?.engineering?.passed)
          throw new Fault("يلزم نجاح اختبار التغيير في البيئة المعزولة");
        if (
          t.department === "engineering" &&
          (await codeContext("")).base !== t.evidence.engineering.base
        )
          throw new Fault("تغير الفرع الأساسي؛ أعد تشغيل المهمة واختبارها");
        await db.query("UPDATE ops_tasks SET status='done' WHERE id=$1", [
          t.id,
        ]);
        await audit(db, "owner", body.command, t.id);
        break;
      }
      case "ticket.triage": {
        const ticket = (
          await db.query("SELECT * FROM ops_tickets WHERE id=$1 FOR UPDATE", [
            z.string().uuid().parse(d.id),
          ])
        ).rows[0];
        if (!ticket) throw new Fault("الطلب غير موجود");
        if (ticket.task_id) return { id: ticket.task_id };
        const goalId = z.string().uuid().parse(d.goalId);
        if (
          !(
            await db.query(
              "SELECT id FROM ops_goals WHERE id=$1 AND approved=true",
              [goalId],
            )
          ).rows.length
        )
          throw new Fault("اختر هدفًا معتمدًا");
        const taskId = id();
        await db.query(
          `INSERT INTO ops_tasks(id,goal_id,title,department,agent,reviewer,acceptance,context) VALUES($1,$2,$3,'customers','مسؤول دعم','مدير منتج',$4,$5)`,
          [
            taskId,
            goalId,
            "تحليل طلب دعم " + ticket.id.slice(0, 8),
            "تحديد المشكلة وتقديم رد مفيد واقتراح مهمة منتج عند الحاجة",
            ticket.description,
          ],
        );
        await db.query(
          "UPDATE ops_tickets SET status='triaged',task_id=$2 WHERE id=$1",
          [ticket.id, taskId],
        );
        await audit(db, "owner", body.command, ticket.id);
        return { id: taskId };
      }
      case "action.save": {
        const a = actionInput.parse({ kind: d.kind, payload: d.payload });
        let payload: Record<string, unknown> = a.payload;
        if (a.kind === "email") {
          const ticket = (
            await db.query("SELECT email FROM ops_tickets WHERE id=$1", [
              a.payload.ticketId,
            ])
          ).rows[0];
          if (!ticket) throw new Fault("طلب الدعم غير موجود");
          payload = { ...a.payload, to: ticket.email };
        }
        const taskId = z.string().uuid().parse(d.taskId);
        const t = (
          await db.query("SELECT * FROM ops_tasks WHERE id=$1", [taskId])
        ).rows[0];
        if (
          !t ||
          !t.review_evidence ||
          !["review", "approval", "done"].includes(t.status)
        )
          throw new Fault("راجع المخرج أولًا");
        const actionId = d.id ? z.string().uuid().parse(d.id) : id();
        const hash = digest({ kind: a.kind, payload });
        if (d.id) {
          const current = (
            await db.query("SELECT * FROM ops_actions WHERE id=$1 FOR UPDATE", [
              actionId,
            ])
          ).rows[0];
          if (
            !current ||
            current.task_id !== taskId ||
            ["executing", "done", "uncertain"].includes(current.status)
          )
            throw new Fault("لا يمكن تعديل إجراء بدأ تنفيذه");
          await db.query(
            "UPDATE ops_jobs SET status='cancelled' WHERE kind='action' AND payload->>'actionId'=$1 AND status='queued'",
            [actionId],
          );
          await db.query(
            "UPDATE ops_actions SET kind=$2,payload=$3,digest=$4,revision=revision+1,status='pending',approved_digest=null,approved_at=null WHERE id=$1",
            [actionId, a.kind, JSON.stringify(payload), hash],
          );
        } else
          await db.query(
            "INSERT INTO ops_actions(id,task_id,kind,payload,digest) VALUES($1,$2,$3,$4,$5)",
            [actionId, taskId, a.kind, JSON.stringify(payload), hash],
          );
        await db.query("UPDATE ops_tasks SET status='approval' WHERE id=$1", [
          taskId,
        ]);
        await audit(db, "owner", body.command, actionId, { digest: hash });
        return { id: actionId };
      }
      case "action.approve":
      case "action.reject": {
        const a = (
          await db.query("SELECT * FROM ops_actions WHERE id=$1 FOR UPDATE", [
            z.string().uuid().parse(d.id),
          ])
        ).rows[0];
        if (!a || a.status !== "pending" || a.digest !== d.digest)
          throw new Fault("تغير الإجراء؛ حدّث الصفحة وراجعه مجددًا", 409);
        const approve = body.command === "action.approve";
        if (approve && ["merge", "deploy"].includes(a.kind)) {
          const t = (
            await db.query("SELECT * FROM ops_tasks WHERE id=$1", [a.task_id])
          ).rows[0];
          if (
            !t?.evidence?.engineering?.passed ||
            (await codeContext("")).base !== t.evidence.engineering.base
          )
            throw new Fault(
              "يجب اختبار التغيير على الفرع الأساسي الحالي قبل اعتماد الدمج أو النشر",
            );
        }
        await db.query(
          "UPDATE ops_actions SET status=$2,approved_digest=$3,approved_at=CASE WHEN $4 THEN now() ELSE null END WHERE id=$1",
          [
            a.id,
            approve ? "approved" : "rejected",
            approve ? a.digest : null,
            approve,
          ],
        );
        if (approve && a.kind === "email")
          await enqueue(db, "action", `action:${a.id}:${a.revision}`, null, {
            actionId: a.id,
            digest: a.digest,
          });
        await audit(db, "owner", body.command, a.id, { digest: a.digest });
        break;
      }
      case "action.reconcile": {
        const a = (
          await db.query("SELECT * FROM ops_actions WHERE id=$1 FOR UPDATE", [
            z.string().uuid().parse(d.id),
          ])
        ).rows[0];
        if (!a || a.status !== "uncertain")
          throw new Fault("لا توجد نتيجة مجهولة للتسوية");
        const sent = z.boolean().parse(d.sent);
        const receipt = required(d.receipt, 2000);
        await db.query(
          "UPDATE ops_actions SET status=$2,receipt=$3 WHERE id=$1",
          [a.id, sent ? "done" : "cancelled", receipt],
        );
        await db.query(
          "UPDATE ops_jobs SET status=$2 WHERE payload->>'actionId'=$1 AND status='uncertain'",
          [a.id, sent ? "done" : "cancelled"],
        );
        await audit(db, "owner", body.command, a.id, { sent, receipt });
        break;
      }
      case "action.receipt": {
        const a = (
          await db.query("SELECT * FROM ops_actions WHERE id=$1 FOR UPDATE", [
            z.string().uuid().parse(d.id),
          ])
        ).rows[0];
        if (!a || a.status !== "approved" || a.kind === "email")
          throw new Fault("الإجراء غير متاح للتنفيذ اليدوي");
        await db.query(
          "UPDATE ops_actions SET status='done',receipt=$2 WHERE id=$1",
          [a.id, required(d.receipt, 2000)],
        );
        await audit(db, "owner", body.command, a.id);
        break;
      }
      case "support.configure": {
        const goalId = d.goalId ? z.string().uuid().parse(d.goalId) : null;
        if (
          goalId &&
          !(
            await db.query(
              "SELECT id FROM ops_goals WHERE id=$1 AND approved=true",
              [goalId],
            )
          ).rows.length
        )
          throw new Fault("اختر هدفًا معتمدًا");
        await db.query(
          "UPDATE ops_settings SET support_goal_id=$1 WHERE id=1",
          [goalId],
        );
        await audit(db, "owner", body.command, "settings", { goalId });
        break;
      }
      case "settings.save": {
        const cap = z.number().min(0).max(100000).parse(d.capSar);
        const enabled = z.boolean().parse(d.paidEnabled);
        if (enabled && cap === 0) throw new Fault("حدد سقفًا موجبًا");
        await db.query(
          "UPDATE ops_settings SET monthly_cap_micro=$1,paid_enabled=$2,updated_at=now() WHERE id=1",
          [Math.round(cap * 1e6), enabled],
        );
        await audit(db, "owner", body.command, "settings", {
          capSar: cap,
          paidEnabled: enabled,
        });
        break;
      }
      case "pause":
      case "resume": {
        const paused = body.command === "pause";
        await db.query("UPDATE ops_settings SET paused=$1 WHERE id=1", [
          paused,
        ]);
        if (paused) {
          await db.query(
            "UPDATE ops_tasks SET status='blocked',error='أوقفها المالك' WHERE status='ready'",
          );
          await db.query(
            "UPDATE ops_jobs SET status='cancelled' WHERE status='queued'",
          );
          await db.query(
            "UPDATE ops_actions SET status='cancelled',approved_digest=null WHERE status='approved'",
          );
        }
        await audit(db, "owner", body.command, "settings");
        break;
      }
      default:
        throw new Fault("أمر غير معروف");
    }
    return { ok: true };
  });
}
export async function schedule(store: Store, now = new Date()) {
  const date = riyadh(now);
  if (date.hour < 9) return;
  await store.transaction(async (db) => {
    const s = (
      await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    if (s.paused) return;
    await enqueue(db, "report", `report:${date.day}`, null, { day: date.day });
    const goals = (
      await db.query(
        "SELECT * FROM ops_goals WHERE approved=true AND week_start<=$1::date AND week_start+7>$1::date ORDER BY created_at LIMIT 3",
        [date.day],
      )
    ).rows;
    for (const g of goals)
      for (const dept of departments) {
        const key = `daily:${date.day}:${g.id}:${dept.id}`;
        if (
          (await db.query("SELECT id FROM ops_jobs WHERE dedupe_key=$1", [key]))
            .rows.length
        )
          continue;
        // Do not accumulate a new task while this department has unfinished work for this goal.
        if (
          (
            await db.query(
              "SELECT id FROM ops_tasks WHERE goal_id=$1 AND department=$2 AND status<>'done' LIMIT 1",
              [g.id, dept.id],
            )
          ).rows.length
        )
          continue;
        const taskId = id();
        const agent =
          dept.agents[Number(date.day.slice(-2)) % dept.agents.length];
        const reviewer = dept.id === "management" ? "مدير منتج" : "مدير مشاريع";
        await db.query(
          `INSERT INTO ops_tasks(id,goal_id,title,department,agent,reviewer,acceptance,context,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ready')`,
          [
            taskId,
            g.id,
            `${dept.name}: ${g.title}`,
            dept.id,
            agent,
            reviewer,
            "مخرج قابل للمراجعة يدعم الهدف، مع المصادر وحدود الثقة",
            dept.mission,
          ],
        );
        await enqueue(db, "agent", key, taskId);
      }
  });
}

// Event intake is independent of the 09:00 planning cycle. The owner chooses the scope.
export async function intake(store: Store, now = new Date()) {
  await store.transaction(async (db) => {
    const settings = (
      await db.query("SELECT * FROM ops_settings WHERE id=1 FOR UPDATE")
    ).rows[0];
    if (settings.paused || !settings.support_goal_id) return;
    const goal = (
      await db.query(
        "SELECT id FROM ops_goals WHERE id=$1 AND approved=true AND week_start<=$2::date AND week_start+7>$2::date",
        [settings.support_goal_id, riyadh(now).day],
      )
    ).rows[0];
    if (!goal) return;
    const tickets = (
      await db.query(
        "SELECT * FROM ops_tickets WHERE task_id IS NULL ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 10",
      )
    ).rows;
    for (const ticket of tickets) {
      const taskId = id();
      await db.query(
        "INSERT INTO ops_tasks(id,goal_id,title,department,agent,reviewer,acceptance,context,status) VALUES($1,$2,$3,'customers','مسؤول دعم','مدير منتج',$4,$5,'ready')",
        [
          taskId,
          goal.id,
          "تحليل طلب دعم " + ticket.id.slice(0, 8),
          "تحديد المشكلة وتقديم رد مفيد واقتراح مهمة منتج عند الحاجة",
          ticket.description,
        ],
      );
      await db.query(
        "UPDATE ops_tickets SET task_id=$2,status='triaged' WHERE id=$1",
        [ticket.id, taskId],
      );
      await enqueue(db, "agent", "ticket:" + ticket.id, taskId);
      await audit(db, "worker", "ticket.triaged", ticket.id, { taskId });
    }
  });
}
