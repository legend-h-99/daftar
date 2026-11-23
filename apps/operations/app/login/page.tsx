"use client";
import { useState } from "react";
export default function Login() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <main className="login">
      <div className="login-brand">
        د<span>دفتر / غرفة العمليات</span>
      </div>
      <div className="login-card">
        <p className="eyebrow">مساحة خاصة بالمالك</p>
        <h1>
          أهلًا حسام.
          <br />
          كل العمل، في مكان واحد.
        </h1>
        <p className="muted">ادخل لمتابعة الفريق ومراجعة النتائج والقرارات.</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const form = new FormData(e.currentTarget);
            try {
              const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(Object.fromEntries(form)),
              });
              const data = await res.json();
              if (!res.ok) throw Error(data.error);
              location.href = "/";
            } catch (e) {
              setError(e instanceof Error ? e.message : "تعذر الاتصال");
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            بريد المالك
            <input
              name="email"
              type="email"
              autoComplete="username"
              required
              dir="ltr"
            />
          </label>
          <label>
            كلمة المرور
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={14}
              maxLength={300}
              dir="ltr"
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button disabled={busy} className="primary">
            {busy ? "جارٍ الدخول…" : "دخول غرفة العمليات ←"}
          </button>
        </form>
        <p className="small muted">
          الدخول خاص بالمالك. لا يمكن للأيجنتات اعتماد الإجراءات.
        </p>
      </div>
    </main>
  );
}
