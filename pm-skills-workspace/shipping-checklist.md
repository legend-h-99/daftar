# Shipping Checklist

استخدم هذه القائمة قبل إطلاق تطبيق أو ميزة، خصوصًا لو كان التنفيذ تم بمساعدة AI.

## Core Documentation

- [ ] `documentation/architecture.md`: ما النظام؟ ما حدوده؟ ما المخاطر المعروفة؟
- [ ] `documentation/flows.md`: ما الرحلات التي تغيّر بيانات أو صلاحيات أو تسبب آثارًا جانبية؟
- [ ] `documentation/permissions.md`: من يستطيع فعل ماذا؟
- [ ] `documentation/variables.md`: ما الإعدادات والأسرار؟ أين تستخدم؟ كيف تدوّر؟
- [ ] `documentation/tests.md`: ما القواعد التي تغطيها الاختبارات؟ وما الفجوات؟

## Conditional Documentation

- [ ] `documentation/emails.md`: إذا كان النظام يرسل بريدًا.
- [ ] `documentation/cron.md`: إذا كان هناك مهام مجدولة أو jobs.
- [ ] `documentation/seo.md`: إذا كان هناك صفحات عامة أو قابلة للفهرسة.
- [ ] `documentation/automation.md`: إذا كان هناك agents أو webhooks أو LLM workflows.

## Intended Vs Implemented

راجع كل قاعدة موثقة واسأل:

- [ ] هل توجد نقطة تنفيذ واضحة في الكود؟
- [ ] هل يتم التحقق على الخادم، وليس الواجهة فقط؟
- [ ] هل توجد حالة رفض واضحة؟
- [ ] هل توجد اختبارات تثبت السلوك؟
- [ ] هل أي فجوة تعبر حدود بيانات أو صلاحيات أو تكلفة أو tenant؟

## Release Readiness

- [ ] تم تعريف North Star وinput metrics.
- [ ] توجد سيناريوهات اختبار أساسية وسلبية.
- [ ] توجد خطة rollback أو إيقاف.
- [ ] توجد release notes.
- [ ] توجد قائمة مخاطر pre-mortem.
- [ ] توجد خطة متابعة بعد الإطلاق.

