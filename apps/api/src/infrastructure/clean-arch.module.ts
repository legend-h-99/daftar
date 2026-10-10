import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

// Port tokens
import { UNIT_OF_WORK } from '../application/ports/unit-of-work.port';
import { BUSINESS_REPOSITORY } from '../application/ports/repositories/business.repository.port';
import { MATERIAL_REPOSITORY } from '../application/ports/repositories/material.repository.port';
import { PRODUCT_REPOSITORY } from '../application/ports/repositories/product.repository.port';
import { INVOICE_REPOSITORY } from '../application/ports/repositories/invoice.repository.port';
import { PURCHASE_REPOSITORY } from '../application/ports/repositories/purchase.repository.port';
import { CUSTOMER_REPOSITORY } from '../application/ports/repositories/customer.repository.port';
import { SUPPLIER_REPOSITORY } from '../application/ports/repositories/supplier.repository.port';
import { EXPENSE_REPOSITORY } from '../application/ports/repositories/expense.repository.port';
import { PDF_GENERATOR } from '../application/ports/services/pdf-generator.port';
import { OCR_SERVICE } from '../application/ports/services/ocr.port';
import { DASHBOARD_QUERY } from '../application/ports/queries/dashboard.query.port';
import { INVENTORY_QUERY } from '../application/ports/queries/inventory.query.port';
import { PURCHASE_SUMMARY_QUERY } from '../application/ports/queries/purchase-summary.query.port';

// Infrastructure adapters
import { PrismaUnitOfWork } from './persistence/prisma-unit-of-work';
import { PrismaBusinessRepository } from './persistence/prisma-business.repository';
import { PrismaMaterialStandaloneRepository } from './persistence/prisma-material-standalone.repository';
import { PrismaProductStandaloneRepository } from './persistence/prisma-product-standalone.repository';
import { PrismaInvoiceStandaloneRepository } from './persistence/prisma-invoice-standalone.repository';
import { PrismaPurchaseStandaloneRepository } from './persistence/prisma-purchase-standalone.repository';
import { PrismaCustomerRepository } from './persistence/prisma-customer.repository';
import { PrismaSupplierRepository } from './persistence/prisma-supplier.repository';
import { PrismaExpenseRepository } from './persistence/prisma-expense.repository';
import { PdfKitInvoiceGenerator } from './pdf/pdfkit-invoice-generator';
import { PrismaDashboardQuery } from './queries/prisma-dashboard.query';
import { PrismaInventoryQuery } from './queries/prisma-inventory.query';
import { PrismaPurchaseSummaryQuery } from './queries/prisma-purchase-summary.query';
import { MockOcrAdapter } from './services/mock-ocr.adapter';

// Use Cases — invoices
import { CreateInvoiceUseCase } from '../application/use-cases/invoices/create-invoice.use-case';
import { UpdateInvoiceStatusUseCase } from '../application/use-cases/invoices/update-invoice-status.use-case';
import { GenerateInvoicePdfUseCase } from '../application/use-cases/invoices/generate-invoice-pdf.use-case';
import { DeleteInvoiceUseCase } from '../application/use-cases/invoices/delete-invoice.use-case';

// Use Cases — products
import { CreateProductUseCase } from '../application/use-cases/products/create-product.use-case';
import { UpdateProductUseCase } from '../application/use-cases/products/update-product.use-case';
import { DeleteProductUseCase } from '../application/use-cases/products/delete-product.use-case';
import { RecostProductsUseCase } from '../application/use-cases/products/recost-products.use-case';

// Use Cases — purchases
import { CreatePurchaseUseCase } from '../application/use-cases/purchases/create-purchase.use-case';
import { DeletePurchaseUseCase } from '../application/use-cases/purchases/delete-purchase.use-case';
import { ScanPurchaseUseCase } from '../application/use-cases/purchases/scan-purchase.use-case';

// Use Cases — inventory
import { AdjustStockUseCase } from '../application/use-cases/inventory/adjust-stock.use-case';

// Use Cases — materials
import { CreateMaterialUseCase } from '../application/use-cases/materials/create-material.use-case';
import { UpdateMaterialUseCase } from '../application/use-cases/materials/update-material.use-case';
import { DeleteMaterialUseCase } from '../application/use-cases/materials/delete-material.use-case';

// Application Services — simple CRUD
import { CustomerCrudService } from '../application/use-cases/customers/customer-crud.service';
import { SupplierCrudService } from '../application/use-cases/suppliers/supplier-crud.service';
import { ExpenseCrudService } from '../application/use-cases/expenses/expense-crud.service';

// Use Cases — dashboard
import { GetDashboardSummaryUseCase } from '../application/use-cases/dashboard/get-dashboard-summary.use-case';

const repositoryProviders = [
  { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
  { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
  { provide: MATERIAL_REPOSITORY, useClass: PrismaMaterialStandaloneRepository },
  { provide: PRODUCT_REPOSITORY, useClass: PrismaProductStandaloneRepository },
  { provide: INVOICE_REPOSITORY, useClass: PrismaInvoiceStandaloneRepository },
  { provide: PURCHASE_REPOSITORY, useClass: PrismaPurchaseStandaloneRepository },
  { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
  { provide: SUPPLIER_REPOSITORY, useClass: PrismaSupplierRepository },
  { provide: EXPENSE_REPOSITORY, useClass: PrismaExpenseRepository },
  { provide: PDF_GENERATOR, useClass: PdfKitInvoiceGenerator },
  { provide: OCR_SERVICE, useClass: MockOcrAdapter },
  { provide: DASHBOARD_QUERY, useClass: PrismaDashboardQuery },
  { provide: INVENTORY_QUERY, useClass: PrismaInventoryQuery },
  { provide: PURCHASE_SUMMARY_QUERY, useClass: PrismaPurchaseSummaryQuery },
];

const useCases = [
  CreateInvoiceUseCase,
  UpdateInvoiceStatusUseCase,
  GenerateInvoicePdfUseCase,
  DeleteInvoiceUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  RecostProductsUseCase,
  CreatePurchaseUseCase,
  DeletePurchaseUseCase,
  ScanPurchaseUseCase,
  AdjustStockUseCase,
  CreateMaterialUseCase,
  UpdateMaterialUseCase,
  DeleteMaterialUseCase,
  CustomerCrudService,
  SupplierCrudService,
  ExpenseCrudService,
  GetDashboardSummaryUseCase,
];

@Module({
  imports: [PrismaModule],
  providers: [...repositoryProviders, ...useCases],
  exports: [
    UNIT_OF_WORK,
    BUSINESS_REPOSITORY,
    MATERIAL_REPOSITORY,
    PRODUCT_REPOSITORY,
    INVOICE_REPOSITORY,
    PURCHASE_REPOSITORY,
    CUSTOMER_REPOSITORY,
    SUPPLIER_REPOSITORY,
    EXPENSE_REPOSITORY,
    PDF_GENERATOR,
    OCR_SERVICE,
    DASHBOARD_QUERY,
    INVENTORY_QUERY,
    PURCHASE_SUMMARY_QUERY,
    ...useCases,
  ],
})
export class CleanArchModule {}
