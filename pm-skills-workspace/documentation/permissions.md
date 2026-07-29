# Permissions — دفتر

## Roles And Claims

| Role | Claim Source | Notes |
|---|---|---|
| Anonymous | none | يستطيع طلب/تحقق OTP فقط |
| Authenticated user | JWT `sub`, `phone`, `businessId` | يستطيع قراءة `me` وإنشاء business |
| Business owner/member | JWT with `businessId` | يستطيع موارد النشاط scoped by businessId |

لا يوجد حاليًا تعدد أدوار أو صلاحيات فريق. كل مستخدم مرتبط بـBusiness واحد اختياريًا.

## Resource Matrix

| Resource | Operation | Anonymous | Auth User No Business | Business User | Enforcement |
|---|---|---|---|---|---|
| OTP | request/verify | Yes | Yes | Yes | DTO + throttling |
| Me | read | No | Yes | Yes | JwtAuthGuard |
| Business | create/read/update | No | create | read/update own | JwtAuthGuard |
| Materials | CRUD | No | No | own business | BusinessGuard + filters |
| Products/Recipes | CRUD | No | No | own business | BusinessGuard + filters |
| Customers/Suppliers | CRUD | No | No | own business | BusinessGuard + filters |
| Invoices | CRUD/status/payments | No | No | own business | BusinessGuard + filters |
| Expenses/Purchases | CRUD | No | No | own business | BusinessGuard + filters |
| Dashboard | read | No | No | own business | BusinessGuard + filters |

## Row-Level Security

لا يوجد RLS موثق في Prisma أو migrations. العزل الحالي يعتمد على `businessId` وفلاتر الكود. هذا مقبول للـMVP فقط إذا غطته اختبارات tenant isolation.

| Table | RLS? | Policy / Code Check | Notes |
|---|---|---|---|
| Business/User | No | owner relation | مراجعة endpoints |
| Material/Product/Customer/Invoice/Expense/Supplier/Purchase | No | businessId filter | يجب اختبارها |
| TokenBlacklist/OtpCode | No | auth service only | لا تعرض مباشرة |

