# النسخ الاحتياطي وإبقاء قاعدة الإنتاج نشطة

مهمة `DB keep-alive and backup` تعمل يومياً في 03:17 UTC، وتعمل يدوياً من تبويب Actions.
تنفّذ المهمة خطوتين:

1. ترسل استعلام `select 1` إلى قاعدة الإنتاج حتى لا يتوقف مشروع Supabase المجاني.
2. تأخذ نسخة `pg_dump` من مخططي `public` و`auth`، وتشفّرها بـ `age`، وترفعها كـ artifact لمدة 30 يوماً.

المستودع عام. لذلك لا يُرفع إلا الملف المشفّر، ولا يُكتب الملف غير المشفّر على القرص.

## الإعداد لأول مرة

### 1. أنشئ مفتاح التشفير على جهازك

```bash
brew install age
```

```bash
age-keygen -o ~/daftar-backup.key
```

يطبع الأمر المفتاح العام، ويبدأ بـ `age1`.
احفظ الملف `~/daftar-backup.key` في مكان آمن خارج GitHub، مثل مدير كلمات المرور.
إذا ضاع المفتاح الخاص فلن تُقرأ أي نسخة.

### 2. خذ رابط Session pooler

في لوحة Supabase افتح المشروع، ثم اضغط **Connect**، واختر **Session pooler**.
الرابط يبدأ بـ `postgresql://postgres.<ref>:` وينتهي بـ `pooler.supabase.com:5432/postgres`.
لا تستخدم الرابط المباشر `db.<ref>.supabase.co`، لأنه يعمل على IPv6 فقط وأجهزة GitHub لا تدعمه.

### 3. أضف السرّين إلى المستودع

```bash
gh secret set SUPABASE_DB_URL --repo legend-h-99/daftar
```

```bash
gh secret set BACKUP_AGE_RECIPIENT --repo legend-h-99/daftar
```

كل أمر يطلب القيمة. الصق الرابط في الأول، والمفتاح العام `age1...` في الثاني.

### 4. شغّل المهمة يدوياً مرة واحدة

```bash
gh workflow run db-keepalive-backup.yml --repo legend-h-99/daftar
```

تأكد من نجاح التشغيل، ومن وجود artifact باسم `db-backup-<run id>`.

## الاستعادة في قاعدة محلية منفصلة

لا تستعد أي نسخة على قاعدة الإنتاج.

### 1. نزّل النسخة

```bash
gh run download <run-id> --repo legend-h-99/daftar --dir ./restore
```

### 2. فك التشفير

```bash
age --decrypt --identity ~/daftar-backup.key --output ./restore/daftar.dump ./restore/db-backup-*/daftar-*.dump.age
```

### 3. شغّل Postgres 17 محلياً

```bash
docker run --name daftar-restore -e POSTGRES_PASSWORD=restore -p 55432:5432 -d postgres:17
```

### 4. استعد البيانات

انتظر حتى تقبل قاعدة البيانات الاتصالات:

```bash
until docker exec daftar-restore pg_isready -U postgres -h localhost; do sleep 1; done
```

ثم استعد النسخة:

```bash
docker exec -i daftar-restore psql -U postgres -c "create schema if not exists auth"
```

```bash
docker exec -i daftar-restore pg_restore -U postgres -d postgres --no-owner --no-privileges < ./restore/daftar.dump
```

قد تظهر تحذيرات عن أدوار وإضافات خاصة بـ Supabase غير موجودة محلياً. هذا متوقع.
تحقق بعد ذلك من أعداد السجلات في الجداول الرئيسية، وقارنها بالإنتاج باستعلامات SELECT فقط.

### 5. احذف البيانات المحلية بعد التحقق

الملفات تحوي بيانات شخصية. احذف حاوية `daftar-restore` ومجلد `./restore` بعد الانتهاء.

## الحدود

- ملفات Supabase Storage غير مشمولة. النسخة تحوي الجداول فقط.
- مدة الاحتفاظ 30 يوماً.
- لم يُتحقق بعد من أن استعلاماً يومياً يمنع توقف المشروع. راقب حالته أسبوعين.
- في المستودعات العامة يعطّل GitHub المهام المجدولة بعد 60 يوماً بلا نشاط في المستودع، ويرسل بريداً بذلك. إذا تعطلت المهمة يتوقف المشروع مرة أخرى. أعد تفعيلها من تبويب Actions، أو ادفع أي commit قبل انقضاء المدة.
