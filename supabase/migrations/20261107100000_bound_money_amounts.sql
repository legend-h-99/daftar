-- Bound monetary amounts to finite, non-negative values (double precision).
--
-- Strix finding (hardening): the invoice/purchase money RPCs sum
-- `unitPrice * quantity` per item with no finite/overflow guard, so a crafted
-- UNPAID document can store an `Infinity` (or `NaN`) total that then distorts
-- dashboard sums. Rather than rewrite the large SECURITY DEFINER RPCs, this adds
-- DB-level CHECK constraints as a backstop: any non-finite or negative money
-- value is rejected at write time, rolling back the whole create transaction.
--
-- For `double precision`, the predicate `col >= 0 AND col < 'Infinity'` rejects
-- every bad value and accepts every good one. NOTE the Postgres float semantics
-- this relies on (they differ from IEEE/other languages):
--   * Postgres orders NaN as GREATER than every number including +Infinity, so
--     `NaN >= 0` is TRUE — a naive `>= 0 AND <> 'Infinity'` would WRONGLY accept
--     NaN. But `NaN < 'Infinity'` is FALSE, so `< 'Infinity'` rejects NaN.
--   * `'Infinity' < 'Infinity'` is FALSE          -> +Infinity rejected.
--   * `'-Infinity' >= 0` is FALSE                 -> -Infinity and negatives rejected.
-- NULL passes a CHECK (constraint is only enforced on non-null values).
-- Verified read-only before writing: 0 existing violations; max invoice total 138,
-- max purchase total 4000 -> constraints validate cleanly against current data.
--
-- REVIEW ONLY — NOT YET DEPLOYED. Test on a Supabase branch before merging;
-- merging into the deploy branch will apply it to production.

alter table public."Invoice" drop constraint if exists invoice_subtotal_finite;
alter table public."Invoice" add  constraint invoice_subtotal_finite
  check (subtotal >= 0 and subtotal < 'Infinity'::double precision);

alter table public."Invoice" drop constraint if exists invoice_vatamount_finite;
alter table public."Invoice" add  constraint invoice_vatamount_finite
  check ("vatAmount" >= 0 and "vatAmount" < 'Infinity'::double precision);

alter table public."Invoice" drop constraint if exists invoice_total_finite;
alter table public."Invoice" add  constraint invoice_total_finite
  check (total >= 0 and total < 'Infinity'::double precision);

alter table public."Invoice" drop constraint if exists invoice_paidamount_finite;
alter table public."Invoice" add  constraint invoice_paidamount_finite
  check ("paidAmount" >= 0 and "paidAmount" < 'Infinity'::double precision);

alter table public."Purchase" drop constraint if exists purchase_total_finite;
alter table public."Purchase" add  constraint purchase_total_finite
  check (total >= 0 and total < 'Infinity'::double precision);

alter table public."InvoiceItem" drop constraint if exists invoiceitem_unitprice_finite;
alter table public."InvoiceItem" add  constraint invoiceitem_unitprice_finite
  check ("unitPrice" >= 0 and "unitPrice" < 'Infinity'::double precision);

alter table public."InvoiceItem" drop constraint if exists invoiceitem_quantity_finite;
alter table public."InvoiceItem" add  constraint invoiceitem_quantity_finite
  check (quantity >= 0 and quantity < 'Infinity'::double precision);

alter table public."PurchaseItem" drop constraint if exists purchaseitem_unitprice_finite;
alter table public."PurchaseItem" add  constraint purchaseitem_unitprice_finite
  check ("unitPrice" >= 0 and "unitPrice" < 'Infinity'::double precision);

alter table public."PurchaseItem" drop constraint if exists purchaseitem_quantity_finite;
alter table public."PurchaseItem" add  constraint purchaseitem_quantity_finite
  check (quantity >= 0 and quantity < 'Infinity'::double precision);
