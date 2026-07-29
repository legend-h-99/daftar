-- Add query-pattern indexes for the hosted PostgreSQL/Supabase path.
-- These are additive and safe for existing data; they support the common
-- per-business monthly lists, dashboard totals, unpaid invoice alerts, and
-- inventory lookups.

CREATE INDEX "Material_businessId_name_idx" ON "Material"("businessId", "name");
CREATE INDEX "Material_businessId_stockQty_idx" ON "Material"("businessId", "stockQty");

CREATE INDEX "Supplier_businessId_createdAt_idx" ON "Supplier"("businessId", "createdAt");
CREATE INDEX "Supplier_businessId_name_idx" ON "Supplier"("businessId", "name");

CREATE INDEX "Purchase_businessId_date_idx" ON "Purchase"("businessId", "date");
CREATE INDEX "Purchase_businessId_number_idx" ON "Purchase"("businessId", "number");
CREATE INDEX "Purchase_businessId_supplierId_idx" ON "Purchase"("businessId", "supplierId");

CREATE INDEX "StockMovement_businessId_materialId_createdAt_idx" ON "StockMovement"("businessId", "materialId", "createdAt");

CREATE INDEX "Product_businessId_createdAt_idx" ON "Product"("businessId", "createdAt");

CREATE INDEX "RecipeItem_materialId_idx" ON "RecipeItem"("materialId");
CREATE INDEX "RecipeItem_productId_materialId_idx" ON "RecipeItem"("productId", "materialId");

CREATE INDEX "Customer_businessId_createdAt_idx" ON "Customer"("businessId", "createdAt");
CREATE INDEX "Customer_businessId_name_idx" ON "Customer"("businessId", "name");

CREATE INDEX "Invoice_businessId_issueDate_idx" ON "Invoice"("businessId", "issueDate");
CREATE INDEX "Invoice_businessId_status_issueDate_idx" ON "Invoice"("businessId", "status", "issueDate");
CREATE INDEX "Invoice_businessId_status_dueDate_idx" ON "Invoice"("businessId", "status", "dueDate");
CREATE INDEX "Invoice_businessId_number_idx" ON "Invoice"("businessId", "number");

CREATE INDEX "InvoiceItem_productId_idx" ON "InvoiceItem"("productId");

CREATE INDEX "Expense_businessId_date_idx" ON "Expense"("businessId", "date");
CREATE INDEX "Expense_businessId_category_idx" ON "Expense"("businessId", "category");
