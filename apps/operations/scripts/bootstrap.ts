// Proposed launch work only; never approves a goal, budget or external action.
import { database } from "../src/db";
import { command } from "../src/service";
import { departments, riyadh } from "../src/domain";
const target = new URL(process.env.OPS_DATABASE_URL || "");
if (
  process.env.NODE_ENV === "production" ||
  !["127.0.0.1", "localhost"].includes(target.hostname)
)
  throw Error("This bootstrap is for the local operations database only.");
const db = database();
if ((await db.query("SELECT id FROM ops_goals LIMIT 1")).rows.length) {
  console.log("Existing goals preserved.");
  process.exit(0);
}
const now = new Date(riyadh().day + "T00:00:00Z");
now.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
const goal = await command(db, {
  command: "goal.create",
  data: {
    title: "تجهيز دفتر لاستقبال أول 10 مستخدمين تجريبيين",
    week: now.toISOString().slice(0, 10),
  },
});
const titles: Record<string, string> = {
  management: "خطة الأسبوع ومسؤوليات الفريق",
  product: "تعريف رحلة الاستفادة الأولى من دفتر",
  engineering: "التحقق من رحلة إنشاء أول فاتورة",
  marketing: "مسودات محتوى التعريف بدفتر",
  growth: "تجربة الوصول لأول مستخدمين",
  customers: "دليل استقبال وتهيئة أول عميل",
  data: "تعريف التفعيل ومصادر القياس",
  operations: "مراجعة جاهزية الموصلات والتكلفة",
};
for (const dept of departments) {
  await command(db, {
    command: "task.create",
    data: {
      goalId: goal.id,
      title: titles[dept.id],
      department: dept.id,
      agent: dept.agents[0],
      reviewer: dept.id === "management" ? "مدير منتج" : "مدير مشاريع",
      acceptance:
        dept.mission + "؛ مخرج محدد مع المصادر وحدود الثقة والخطوة التالية",
      context:
        "دفتر موجه للأسر المنتجة والمشاريع الصغيرة. الدفع غير مفعل، والوصول إلى 10 مستخدمين هدف وليس نتيجة محققة. المرجع PRODUCT.md. " +
        (dept.id === "engineering"
          ? "حدد مسارات ملفات المصدر المطلوبة في سياق المهمة قبل التشغيل؛ لا تدع نجاح اختبار لم ينفذ."
          : "كل المخرجات للمراجعة، والنشر والإرسال يحتاجان موافقة محددة."),
    },
  });
}
console.log(
  "Created one proposed launch goal and eight proposed department tasks. No approvals or spending enabled.",
);
process.exit(0);
