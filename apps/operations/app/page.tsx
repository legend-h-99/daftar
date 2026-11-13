"use client";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { departments, statuses } from "../src/catalog";
type Row = Record<string, any>;
const nav = [
  ["home", "◈", "ملخص اليوم"],
  ["departments", "▦", "الأقسام والفريق"],
  ["goals", "◎", "الأهداف"],
  ["tasks", "☷", "المهام"],
  ["outputs", "◇", "المخرجات"],
  ["approvals", "✓", "الموافقات"],
  ["support", "◌", "دعم العملاء"],
  ["performance", "↗", "الأداء والتقارير"],
  ["settings", "⚙", "التكلفة والإعدادات"],
];
const stateLabels: Record<string, string> = {
  pending: "تنتظر قرارك",
  approved: "معتمد",
  rejected: "مرفوض",
  executing: "جارٍ التنفيذ",
  uncertain: "نتيجة غير مؤكدة",
  cancelled: "ملغى",
  done: "مكتمل",
  failed: "تعثر",
  running: "يعمل",
  open: "جديد",
  triaged: "قيد المتابعة",
  resolved: "تم الحل",
};
const actionNames: Record<string, string> = {
  email: "إرسال بريد",
  publish: "نشر محتوى",
  spend: "صرف",
  merge: "دمج كود",
  deploy: "نشر إصدار",
};
const date = (v: string) =>
  new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeZone: "Asia/Riyadh",
  }).format(new Date(v));
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <span>◇</span>
      <p>{children}</p>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status}`}>
      {statuses[status] || stateLabels[status] || status}
    </span>
  );
}
export default function Operations() {
  const [state, setState] = useState<Row | null>(null);
  const [tab, setTab] = useState("home");
  const [today, setToday] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [dept, setDept] = useState("product");
  const [actionKind, setActionKind] = useState("email");
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) {
        location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      setState(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الاتصال");
    }
  }, []);
  useEffect(() => {
    const updateDate = () =>
      setToday(
        new Intl.DateTimeFormat("ar-SA", {
          dateStyle: "full",
          timeZone: "Asia/Riyadh",
        }).format(new Date()),
      );
    updateDate();
    void load();
    const t = setInterval(() => {
      updateDate();
      void load();
    }, 20000);
    return () => clearInterval(t);
  }, [load]);
  async function act(command: string, data: Row = {}) {
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const res = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, data }),
      });
      const result = await res.json();
      if (!res.ok) throw Error(result.error);
      await load();
      setNotice("حُفظ التغيير");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الحفظ");
      return false;
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = document.querySelector<HTMLElement>('[role="dialog"]');
    panel?.querySelector<HTMLElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input,select,textarea,summary,a[href]",
        ),
      ).filter((el) => el.offsetParent !== null);
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [selected]);
  const tasks: Row[] = state?.tasks || [];
  const goals: Row[] = state?.goals || [];
  const actions: Row[] = state?.actions || [];
  const tickets: Row[] = state?.tickets || [];
  const pending = actions.filter((a) => a.status === "pending");
  const detail = tasks.find((t) => t.id === selected);
  const used = (state?.usage || []).reduce(
    (s: number, u: Row) => s + Number(u.total_micro) / 1e6,
    0,
  );
  const cap = Number(state?.settings?.monthly_cap_micro || 0) / 1e6;
  const forms = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  const taskList = (rows: Row[]) =>
    rows.length ? (
      <div className="task-list">
        {rows.map((t) => (
          <button
            className="task-row"
            key={t.id}
            onClick={() => setSelected(t.id)}
          >
            <span className="task-dot" />
            <span className="grow">
              <strong>{t.title}</strong>
              <small>
                {t.agent} ·{" "}
                {departments.find((d) => d.id === t.department)?.name}
              </small>
            </span>
            <Badge status={t.status} />
            <span>←</span>
          </button>
        ))}
      </div>
    ) : (
      <Empty>لا توجد مهام هنا بعد. ابدأ بهدف واضح ثم وزّع العمل.</Empty>
    );
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">د</span>
          <span>
            دفتر<small>غرفة العمليات</small>
          </span>
        </a>
        <div className="workspace">
          <span className="live-dot" />
          مساحة حسام الخاصة
        </div>
        <nav aria-label="التنقل الرئيسي">
          {nav.map(([key, icon, label]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                setSelected(null);
              }}
            >
              <span>{icon}</span>
              {label}
              {key === "approvals" && pending.length > 0 && (
                <b>{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar">ح</span>
          <div>
            حسام<small>المالك · صاحب القرار</small>
          </div>
          <button
            aria-label="تسجيل الخروج"
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              location.href = "/login";
            }}
          >
            ↪
          </button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <span>
            مساحة العمل <span className="slash">/</span>{" "}
            <strong>{nav.find((n) => n[0] === tab)?.[2]}</strong>
          </span>
          <span className="top-date">{today}</span>
        </header>
        <main id="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">DAFTAR OPERATIONS</p>
              <h1>
                {tab === "home"
                  ? "صورة واضحة. وخطوة تالية."
                  : nav.find((n) => n[0] === tab)?.[2]}
              </h1>
              <p className="muted">
                {tab === "home"
                  ? "تابع ما يتحرك، راجع ما اكتمل، واتخذ القرارات التي تحتاجك."
                  : "عمل موثّق، ومسؤولية واضحة، ومخرجات قابلة للمراجعة."}
              </p>
            </div>
            <div className="heading-actions">
              <span
                className={`badge ${state?.settings?.paused ? "blocked" : "done"}`}
              >
                {state?.settings?.paused ? "التشغيل متوقف" : "التشغيل مفعّل"}
              </span>
              <button
                disabled={busy || !state}
                onClick={() =>
                  void act(state?.settings?.paused ? "resume" : "pause")
                }
              >
                {state?.settings?.paused ? "استئناف التشغيل" : "إيقاف التشغيل"}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" className="alert error">
              {error}
              <button onClick={() => void load()}>إعادة المحاولة</button>
            </div>
          )}
          {notice && (
            <p role="status" className="alert success">
              {notice}
            </p>
          )}
          {!state ? (
            <Empty>
              جارٍ الاتصال بغرفة العمليات. إذا لم يكتمل الإعداد، تحقق من قاعدة
              البيانات وإعدادات الدخول.
            </Empty>
          ) : (
            <>
              {tab === "home" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="hero-kicker">وجهتنا الأولى</span>
                      <h2>دفتر جاهز لأول مستخدميه.</h2>
                      <p>
                        نجهّز المنتج والتسويق والدعم، ثم نتعلّم من الاستخدام
                        الحقيقي.
                        <br />
                        هدفنا الأول 10 مستخدمين تجريبيين؛ لم يُقَس التقدم بعد.
                      </p>
                      <button onClick={() => setTab("goals")}>
                        إدارة أهداف الأسبوع ←
                      </button>
                    </div>
                    <div className="orbit" aria-hidden="true">
                      <div className="orbit-inner">د</div>
                      <span className="orb a">منتج</span>
                      <span className="orb b">عملاء</span>
                      <span className="orb c">نمو</span>
                    </div>
                  </section>
                  <section className="stats">
                    <article>
                      <small>تحتاج قرارك</small>
                      <strong>
                        {pending.length}
                        <span>موافقة</span>
                      </strong>
                      <button onClick={() => setTab("approvals")}>
                        مراجعة القرارات ←
                      </button>
                    </article>
                    <article>
                      <small>عمل جارٍ</small>
                      <strong>
                        {
                          tasks.filter((t) =>
                            ["running", "ready"].includes(t.status),
                          ).length
                        }
                        <span>مهمة</span>
                      </strong>
                      <button onClick={() => setTab("tasks")}>
                        متابعة الفريق ←
                      </button>
                    </article>
                    <article>
                      <small>تحتاج متابعة</small>
                      <strong>
                        {tasks.filter((t) => t.status === "blocked").length}
                        <span>مهمة متعثرة</span>
                      </strong>
                      <button onClick={() => setTab("tasks")}>
                        عرض المهام ←
                      </button>
                    </article>
                    <article>
                      <small>الاستهلاك المتغير هذا الشهر</small>
                      <strong>
                        {used.toFixed(2)}
                        <span>ر.س</span>
                      </strong>
                      <small>
                        {cap ? `من سقف ${cap} ر.س` : "لم تُعتمد ميزانية بعد"}
                      </small>
                    </article>
                  </section>
                  <div className="two-col">
                    <section className="panel">
                      <div className="section-head">
                        <h2>على طاولة الفريق</h2>
                        <button onClick={() => setTab("tasks")}>
                          كل المهام ←
                        </button>
                      </div>
                      {taskList(
                        tasks.filter((t) => t.status !== "done").slice(0, 5),
                      )}
                    </section>
                    <section className="panel">
                      <h2>جاهزية التشغيل</h2>
                      {Object.entries(state.connectors).map(([key, value]) => (
                        <div className="connection" key={key}>
                          <span>
                            {
                              (
                                {
                                  model: "نماذج الذكاء الاصطناعي",
                                  email: "بريد الدعم",
                                  metrics: "مؤشرات دفتر",
                                  engineering: "بيئة التطوير",
                                  social: "قنوات التواصل",
                                } as Row
                              )[key]
                            }
                          </span>
                          <span className={value ? "good" : "muted"}>
                            {value ? "إعدادات موجودة؛ يلزم التحقق" : "غير متصل"}
                          </span>
                        </div>
                      ))}
                      <p className="small muted">
                        الفريق يبدأ يوميًا الساعة 9 صباحًا بتوقيت الرياض، عند
                        تفعيل العامل والأهداف والميزانية.
                      </p>
                    </section>
                  </div>
                  <section className="panel">
                    <div className="section-head">
                      <h2>أقسام تعمل نحو هدف واحد</h2>
                      <button onClick={() => setTab("departments")}>
                        الفريق كاملًا ←
                      </button>
                    </div>
                    <div className="dept-strip">
                      {departments.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDept(d.id);
                            setTab("departments");
                          }}
                        >
                          <span>{d.icon}</span>
                          {d.name}
                          <small>{d.agents.length} أدوار</small>
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              )}
              {tab === "departments" && (
                <div className="department-grid">
                  {departments.map((d) => (
                    <section className="panel department" key={d.id}>
                      <span className="department-icon">{d.icon}</span>
                      <h2>{d.name}</h2>
                      <p className="muted">{d.mission}</p>
                      <div className="agents">
                        {d.agents.map((a) => (
                          <div key={a}>
                            <span className="agent-avatar">{a[0]}</span>
                            <span>{a}</span>
                            <small>
                              {tasks.some(
                                (t) => t.agent === a && t.status === "running",
                              )
                                ? "يعمل الآن"
                                : "عند الحاجة"}
                            </small>
                          </div>
                        ))}
                      </div>
                      <footer>
                        {tasks.filter((t) => t.department === d.id).length} مهمة
                        في السجل
                      </footer>
                    </section>
                  ))}
                </div>
              )}
              {tab === "goals" && (
                <div className="two-col">
                  <section className="panel">
                    <h2>أهداف الأسبوع</h2>
                    {goals.length ? (
                      goals.map((g) => (
                        <article className="item" key={g.id}>
                          <h3>{g.title}</h3>
                          <p className="small muted">
                            الأسبوع يبدأ {date(g.week_start)} · اعتمادك يسمح
                            بمهام ضمن هذا الهدف
                          </p>
                          {g.approved ? (
                            <Badge status="approved" />
                          ) : (
                            <button
                              className="primary"
                              disabled={busy}
                              onClick={() =>
                                void act("goal.approve", { id: g.id })
                              }
                            >
                              اعتماد الهدف
                            </button>
                          )}
                        </article>
                      ))
                    ) : (
                      <Empty>
                        أضف أول هدف؛ لا يعمل الفريق دون اتجاه معتمد.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <h2>هدف جديد</h2>
                    <form
                      onSubmit={(e) => {
                        const d = forms(e);
                        void act("goal.create", d);
                      }}
                    >
                      <Field label="ما النتيجة التي تريد الوصول إليها؟">
                        <input
                          name="title"
                          required
                          minLength={3}
                          maxLength={200}
                          placeholder="تجهيز رحلة أول فاتورة للمستخدمين التجريبيين"
                        />
                      </Field>
                      <Field label="بداية الأسبوع">
                        <input name="week" type="date" required />
                      </Field>
                      <button className="primary" disabled={busy}>
                        حفظ للمراجعة
                      </button>
                    </form>
                  </section>
                </div>
              )}
              {tab === "tasks" && (
                <>
                  <section className="panel">
                    <h2>سجل العمل</h2>
                    {taskList(tasks)}
                  </section>
                  <section className="panel">
                    <h2>توزيع مهمة جديدة</h2>
                    <form
                      className="form-grid"
                      onSubmit={(e) => {
                        void act("task.create", forms(e));
                      }}
                    >
                      <Field label="الهدف">
                        <select name="goalId" required>
                          <option value="">اختر الهدف</option>
                          {goals.map((g) => (
                            <option value={g.id} key={g.id}>
                              {g.title}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="عنوان المهمة">
                        <input
                          name="title"
                          required
                          minLength={3}
                          maxLength={200}
                        />
                      </Field>
                      <Field label="القسم">
                        <select
                          name="department"
                          value={dept}
                          onChange={(e) => setDept(e.target.value)}
                        >
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="المنفذ">
                        <select name="agent" key={dept}>
                          {departments
                            .find((d) => d.id === dept)!
                            .agents.map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                        </select>
                      </Field>
                      <Field label="المراجع المستقل">
                        <select name="reviewer" defaultValue="مدير مشاريع">
                          {departments
                            .flatMap((d) => d.agents)
                            .map((a) => (
                              <option key={a}>{a}</option>
                            ))}
                        </select>
                      </Field>
                      <Field label="معيار القبول">
                        <input
                          name="acceptance"
                          required
                          minLength={10}
                          maxLength={2000}
                          placeholder="كيف نعرف أن المهمة اكتملت؟"
                        />
                      </Field>
                      <label className="full">
                        السياق والمصادر
                        <textarea
                          name="context"
                          maxLength={10000}
                          placeholder="للتطوير: اكتب مسارات الملفات المطلوبة. لا تضع مفاتيح أو بيانات عملاء."
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={busy || !goals.length}
                      >
                        إضافة المهمة
                      </button>
                    </form>
                  </section>
                </>
              )}
              {tab === "outputs" && (
                <section className="panel">
                  <h2>المخرجات ومراجعاتها</h2>
                  {taskList(tasks.filter((t) => t.evidence))}
                  <p className="small muted">
                    افتح المهمة لقراءة المخرج والأدلة ونتائج الاختبارات قبل
                    اعتماد الإغلاق.
                  </p>
                </section>
              )}
              {tab === "approvals" && (
                <>
                  <div className="info">
                    الموافقة تخص المحتوى والوجهة المعروضين فقط. تعديلهما يلغي
                    الموافقة. الإرسال بالبريد ينفذه العامل؛ بقية الإجراءات تُنفذ
                    يدويًا ثم تُوثّق بإيصال.
                  </div>
                  <section className="panel">
                    {actions.length ? (
                      actions.map((a) => (
                        <article className="item" key={a.id}>
                          <div className="section-head">
                            <h2>{actionNames[a.kind]}</h2>
                            <Badge status={a.status} />
                          </div>
                          <p className="small muted">
                            نسخة {a.revision} · {date(a.created_at)}
                          </p>
                          <pre className="output">
                            {a.kind === "email"
                              ? `إلى: ${a.payload.to}\nالموضوع: ${a.payload.subject}\n\n${a.payload.text}`
                              : `الوجهة: ${a.payload.destination}\n\n${a.payload.content}`}
                          </pre>
                          {a.status === "pending" && (
                            <div className="actions">
                              <button
                                disabled={busy}
                                className="primary"
                                onClick={() =>
                                  void act("action.approve", {
                                    id: a.id,
                                    digest: a.digest,
                                  })
                                }
                              >
                                اعتماد هذا الإجراء
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void act("action.reject", {
                                    id: a.id,
                                    digest: a.digest,
                                  })
                                }
                              >
                                رفض
                              </button>
                            </div>
                          )}
                          {[
                            "pending",
                            "approved",
                            "rejected",
                            "cancelled",
                          ].includes(a.status) && (
                            <details>
                              <summary>
                                تعديل المحتوى وإلغاء الموافقة السابقة
                              </summary>
                              <form
                                onSubmit={(e) => {
                                  const d = forms(e);
                                  void act("action.save", {
                                    id: a.id,
                                    taskId: a.task_id,
                                    kind: a.kind,
                                    payload:
                                      a.kind === "email"
                                        ? {
                                            ticketId: a.payload.ticketId,
                                            subject: d.subject,
                                            text: d.text,
                                          }
                                        : {
                                            destination: d.destination,
                                            content: d.content,
                                          },
                                  });
                                }}
                              >
                                {a.kind === "email" ? (
                                  <>
                                    <Field label="الموضوع">
                                      <input
                                        name="subject"
                                        defaultValue={a.payload.subject}
                                        required
                                      />
                                    </Field>
                                    <Field label="الرد">
                                      <textarea
                                        name="text"
                                        defaultValue={a.payload.text}
                                        required
                                      />
                                    </Field>
                                  </>
                                ) : (
                                  <>
                                    <Field label="الوجهة">
                                      <input
                                        name="destination"
                                        defaultValue={a.payload.destination}
                                        required
                                      />
                                    </Field>
                                    <Field label="المحتوى">
                                      <textarea
                                        name="content"
                                        defaultValue={a.payload.content}
                                        required
                                      />
                                    </Field>
                                  </>
                                )}
                                <button disabled={busy}>حفظ نسخة جديدة</button>
                              </form>
                            </details>
                          )}
                          {a.status === "approved" && a.kind !== "email" && (
                            <form
                              onSubmit={(e) => {
                                void act("action.receipt", {
                                  id: a.id,
                                  ...forms(e),
                                });
                              }}
                            >
                              <Field label="دليل التنفيذ اليدوي (رابط أو إيصال)">
                                <input
                                  name="receipt"
                                  required
                                  maxLength={2000}
                                />
                              </Field>
                              <button disabled={busy}>توثيق التنفيذ</button>
                            </form>
                          )}
                          {a.status === "uncertain" && (
                            <form
                              onSubmit={(e) => {
                                const d = forms(e);
                                void act("action.reconcile", {
                                  id: a.id,
                                  sent: d.sent === "yes",
                                  receipt: d.receipt,
                                });
                              }}
                            >
                              <p className="error">
                                تحقق من سجل مزود البريد أولًا؛ لا يُعاد الإرسال
                                تلقائيًا.
                              </p>
                              <Field label="النتيجة المؤكدة لدى المزود">
                                <select name="sent">
                                  <option value="yes">تم الإرسال</option>
                                  <option value="no">
                                    تأكدت من عدم الإرسال
                                  </option>
                                </select>
                              </Field>
                              <Field label="دليل التحقق أو معرف العملية">
                                <input
                                  name="receipt"
                                  required
                                  maxLength={2000}
                                />
                              </Field>
                              <button disabled={busy}>
                                توثيق نتيجة التحقق
                              </button>
                            </form>
                          )}
                          {a.receipt && (
                            <p className="small">إيصال: {a.receipt}</p>
                          )}
                        </article>
                      ))
                    ) : (
                      <Empty>لا توجد إجراءات تنتظر المراجعة.</Empty>
                    )}
                  </section>
                </>
              )}
              {tab === "support" && (
                <section className="panel">
                  <h2>صندوق دعم العملاء</h2>
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      void act("support.configure", forms(e));
                    }}
                  >
                    <Field label="هدف المعالجة التلقائية للطلبات الجديدة">
                      <select
                        name="goalId"
                        defaultValue={state.settings.support_goal_id || ""}
                        key={state.settings.support_goal_id || "manual"}
                      >
                        <option value="">متابعة يدوية فقط</option>
                        {goals
                          .filter((g) => g.approved)
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.title}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <button disabled={busy}>حفظ مسار الدعم</button>
                  </form>
                  <p className="small muted">
                    عند اختيار هدف معتمد لهذا الأسبوع، يستقبل العامل الطلبات
                    وينشئ مهام الدعم تلقائيًا. الردود تظل بحاجة لموافقتك.
                  </p>
                  <p className="muted">
                    مصدر الطلبات: نموذج الدعم في دفتر. لا تُرسل الردود قبل
                    مراجعتها واعتمادها.
                  </p>
                  {tickets.length ? (
                    tickets.map((t) => (
                      <article className="item" key={t.id}>
                        <div className="section-head">
                          <h3>طلب {t.id.slice(0, 8)}</h3>
                          <Badge status={t.status} />
                        </div>
                        <p dir="ltr" className="email">
                          {t.email}
                        </p>
                        <p className="output">{t.description}</p>
                        {t.task_id ? (
                          <button onClick={() => setSelected(t.task_id)}>
                            فتح مهمة المتابعة ←
                          </button>
                        ) : (
                          <form
                            className="inline-form"
                            onSubmit={(e) => {
                              void act("ticket.triage", {
                                id: t.id,
                                ...forms(e),
                              });
                            }}
                          >
                            <Field label="ربط بهدف معتمد">
                              <select name="goalId" required>
                                <option value="">اختر الهدف</option>
                                {goals
                                  .filter((g) => g.approved)
                                  .map((g) => (
                                    <option value={g.id} key={g.id}>
                                      {g.title}
                                    </option>
                                  ))}
                              </select>
                            </Field>
                            <button disabled={busy}>إنشاء مهمة دعم</button>
                          </form>
                        )}
                      </article>
                    ))
                  ) : (
                    <Empty>عندما يرسل مستخدم طلبًا من الموقع، سيظهر هنا.</Empty>
                  )}
                </section>
              )}
              {tab === "performance" && (
                <>
                  <section className="panel">
                    <h2>التقارير اليومية</h2>
                    <p className="muted">
                      الحسابات ليست دليلًا على عملاء فعليين. لا توجد بوابة دفع
                      مفعّلة، لذلك لا نعرض إيرادًا افتراضيًا.
                    </p>
                    {state.reports.length ? (
                      state.reports.map((r: Row) => (
                        <article className="item" key={r.id}>
                          <h3>{date(r.day)}</h3>
                          <p>{r.body.summary}</p>
                          <p>{r.body.metrics?.notice}</p>
                          {r.body.metrics?.values && (
                            <div className="metrics">
                              {Object.entries(r.body.metrics.values).map(
                                ([k, v]) => (
                                  <div key={k}>
                                    <small>
                                      {
                                        (
                                          {
                                            users: "حسابات",
                                            businesses: "منشآت",
                                            onboardedUsers: "أكملوا الإعداد",
                                            activeBusinesses7d:
                                              "منشآت نشطة خلال 7 أيام",
                                            invoices7d: "فواتير خلال 7 أيام",
                                            errors24h: "أخطاء خلال 24 ساعة",
                                          } as Row
                                        )[k]
                                      }
                                    </small>
                                    <strong>{String(v)}</strong>
                                  </div>
                                ),
                              )}
                            </div>
                          )}
                          <small className="muted">
                            المصدر:{" "}
                            {r.body.metrics?.source || "سجل غرفة العمليات"} ·{" "}
                            {r.body.metrics?.observedAt || ""}
                          </small>
                        </article>
                      ))
                    ) : (
                      <Empty>
                        لا توجد بيانات كافية. يصدر أول تقرير بعد تشغيل العامل.
                      </Empty>
                    )}
                  </section>
                  <section className="panel">
                    <h2>سجل الإجراءات</h2>
                    {state.audit.map((a: Row) => (
                      <div className="audit" key={a.id}>
                        <code>{a.action}</code>
                        <span>
                          {a.actor === "owner"
                            ? "المالك"
                            : a.actor === "worker"
                              ? "العامل"
                              : "نموذج الدعم"}
                        </span>
                        <small>{date(a.created_at)}</small>
                      </div>
                    ))}
                  </section>
                </>
              )}
              {tab === "settings" && (
                <>
                  <div className="two-col">
                    <section className="panel">
                      <h2>ميزانية النماذج والإرسال</h2>
                      <p className="muted">
                        يُحجز الحد الأعلى لتكلفة الطلب قبل إرساله. الطلب ذو
                        النتيجة المجهولة يحتفظ بالحجز حتى المراجعة.
                      </p>
                      <form
                        key={state.settings.updated_at}
                        onSubmit={(e) => {
                          const d = forms(e);
                          void act("settings.save", {
                            capSar: Number(d.capSar),
                            paidEnabled: d.enabled === "on",
                          });
                        }}
                      >
                        <Field label="السقف الشهري بالريال">
                          <input
                            name="capSar"
                            type="number"
                            min={0}
                            max={100000}
                            step="0.01"
                            defaultValue={cap}
                            required
                          />
                        </Field>
                        <label className="check">
                          <input
                            name="enabled"
                            type="checkbox"
                            defaultChecked={state.settings.paid_enabled}
                          />
                          أعتمد تشغيل الخدمات المتصلة ضمن الإعدادات والميزانية
                        </label>
                        <button disabled={busy} className="primary">
                          حفظ الاعتماد
                        </button>
                      </form>
                      <p className="small muted">
                        الاستضافة واشتراك البريد الأساسي والوسائط لها تكاليف
                        منفصلة؛ السقف يشمل استدعاءات النماذج وحجز تكلفة كل
                        رسالة.
                      </p>
                    </section>
                    <section className="panel">
                      <h2>حالة الاتصال</h2>
                      {Object.entries(state.connectors).map(([k, v]) => (
                        <div className="connection" key={k}>
                          <span>
                            {
                              (
                                {
                                  model: "النموذج",
                                  email: "البريد",
                                  metrics: "المؤشرات",
                                  engineering: "التطوير",
                                  social: "التواصل الاجتماعي",
                                } as Row
                              )[k]
                            }
                          </span>
                          <Badge status={v ? "approved" : "blocked"} />
                        </div>
                      ))}
                      <p className="small muted">
                        تُضبط المفاتيح والأسعار على الخادم، ولا تُرسل إلى
                        المتصفح. وجود الإعدادات لا يؤكد نجاح الاتصال.
                      </p>
                    </section>
                  </div>
                  <section className="panel">
                    <h2>تشغيل يحتاج متابعة</h2>
                    {state.jobs.length ? (
                      state.jobs.map((j: Row) => (
                        <div className="item" key={j.id}>
                          <Badge status={j.status} />
                          <p>
                            {j.error ||
                              "قيد التنفيذ؛ قد يكتمل الإجراء الجاري بعد الإيقاف."}
                          </p>
                          <small>
                            {j.kind} · {j.attempts} محاولات
                          </small>
                        </div>
                      ))
                    ) : (
                      <Empty>
                        لا توجد عمليات متعثرة أو نتائج إرسال مجهولة.
                      </Empty>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </main>
        <footer className="main-footer">
          دفتر · غرفة العمليات الخاصة <span>الوضوح قبل الأتمتة</span>
        </footer>
      </div>
      {detail && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="تفاصيل المهمة"
            className="drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setSelected(null)}>
              إغلاق ×
            </button>
            <Badge status={detail.status} />
            <h2>{detail.title}</h2>
            <p className="muted">
              المنفذ: {detail.agent} · المراجع: {detail.reviewer}
            </p>
            <h3>معيار القبول</h3>
            <p>{detail.acceptance}</p>
            <details>
              <summary>السياق</summary>
              <pre className="output">
                {detail.context || "لا يوجد سياق إضافي"}
              </pre>
            </details>
            {detail.error && <p className="error">{detail.error}</p>}
            {["proposed", "blocked"].includes(detail.status) && (
              <details>
                <summary>تعديل المهمة والسياق قبل التنفيذ</summary>
                <form
                  key={detail.id + detail.context}
                  onSubmit={(e) => {
                    void act("task.update", { id: detail.id, ...forms(e) });
                  }}
                >
                  <Field label="عنوان المهمة">
                    <input
                      name="title"
                      defaultValue={detail.title}
                      required
                      minLength={3}
                      maxLength={200}
                    />
                  </Field>
                  <Field label="معيار القبول">
                    <textarea
                      name="acceptance"
                      defaultValue={detail.acceptance}
                      required
                      minLength={10}
                      maxLength={2000}
                    />
                  </Field>
                  <Field label="السياق ومسارات الملفات المطلوبة">
                    <textarea
                      name="context"
                      defaultValue={detail.context}
                      maxLength={10000}
                    />
                  </Field>
                  <button disabled={busy}>حفظ المهمة</button>
                </form>
              </details>
            )}

            {["proposed", "blocked"].includes(detail.status) && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void act("task.queue", { id: detail.id })}
              >
                تشغيل المهمة
              </button>
            )}
            {detail.evidence && (
              <>
                <h3>المخرج</h3>
                <pre className="output">{detail.evidence.summary}</pre>
                <h3>الأدلة</h3>
                <ul>
                  {detail.evidence.evidence?.map((v: string, i: number) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
                {detail.evidence.engineering && (
                  <>
                    <h3>اختبار التغيير</h3>
                    <Badge
                      status={
                        detail.evidence.engineering.passed ? "done" : "blocked"
                      }
                    />
                    <details>
                      <summary>فرق الكود</summary>
                      <pre dir="ltr" className="code">
                        {detail.evidence.engineering.patch}
                      </pre>
                    </details>
                    <details>
                      <summary>سجل الاختبار</summary>
                      <pre dir="ltr" className="code">
                        {detail.evidence.engineering.log}
                      </pre>
                    </details>
                  </>
                )}
                {detail.review_evidence && (
                  <>
                    <h3>المراجعة المستقلة</h3>
                    <p>{detail.review_evidence}</p>
                    {["review", "approval"].includes(detail.status) && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void act("task.complete", { id: detail.id })
                        }
                      >
                        اعتماد اكتمال المهمة
                      </button>
                    )}
                    <details>
                      <summary>تجهيز إجراء للموافقة</summary>
                      <form
                        onSubmit={(e) => {
                          const d = forms(e);
                          void act("action.save", {
                            taskId: detail.id,
                            kind: actionKind,
                            payload:
                              actionKind === "email"
                                ? {
                                    ticketId: d.ticketId,
                                    subject: d.subject,
                                    text: d.text,
                                  }
                                : {
                                    destination: d.destination,
                                    content: d.content,
                                  },
                          });
                        }}
                      >
                        <Field label="الإجراء">
                          <select
                            value={actionKind}
                            onChange={(e) => setActionKind(e.target.value)}
                          >
                            {Object.entries(actionNames).map(([k, v]) => (
                              <option value={k} key={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </Field>
                        {actionKind === "email" ? (
                          <>
                            <Field label="طلب الدعم المستلم">
                              <select name="ticketId" required>
                                <option value="">اختر الطلب</option>
                                {tickets.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.email} · {t.id.slice(0, 8)}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="الموضوع">
                              <input name="subject" required maxLength={200} />
                            </Field>
                            <Field label="الرد النهائي">
                              <textarea
                                name="text"
                                required
                                maxLength={16000}
                                defaultValue={detail.evidence.summary}
                              />
                            </Field>
                          </>
                        ) : (
                          <>
                            <Field label="الوجهة">
                              <input
                                name="destination"
                                required
                                maxLength={1000}
                              />
                            </Field>
                            <Field label="المحتوى / التغيير المحدد">
                              <textarea
                                name="content"
                                required
                                maxLength={20000}
                                defaultValue={detail.evidence.summary}
                              />
                            </Field>
                          </>
                        )}
                        <button disabled={busy} className="primary">
                          إضافة إلى صندوق الموافقات
                        </button>
                      </form>
                    </details>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
