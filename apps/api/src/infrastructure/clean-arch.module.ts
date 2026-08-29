import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

// Port tokens
import { UNIT_OF_WORK } from '../application/ports/unit-of-work.port';
import { BUSINESS_REPOSITORY } from '../application/ports/repositories/business.repository.port';
import { MATERIAL_REPOSITORY } from '../application/ports/repositories/material.repository.port';
import { PRODUCT_REPOSITORY } from '../application/ports/repositories/product.repository.port';
import { PDF_GENERATOR } from '../application/ports/services/pdf-generator.port';

// Infrastructure adapters
import { PrismaUnitOfWork } from './persistence/prisma-unit-of-work';
import { PrismaBusinessRepository } from './persistence/prisma-business.repository';
import { PrismaMaterialStandaloneRepository } from './persistence/prisma-material-standalone.repository';
import { PdfKitInvoiceGenerator } from './pdf/pdfkit-invoice-generator';

// Use Cases
import { CreateInvoiceUseCase } from '../application/use-cases/invoices/create-invoice.use-case';
import { UpdateInvoiceStatusUseCase } from '../application/use-cases/invoices/update-invoice-status.use-case';
import { GenerateInvoicePdfUseCase } from '../application/use-cases/invoices/generate-invoice-pdf.use-case';
import { CreateProductUseCase } from '../application/use-cases/products/create-product.use-case';
import { RecostProductsUseCase } from '../application/use-cases/products/recost-products.use-case';
import { CreatePurchaseUseCase } from '../application/use-cases/purchases/create-purchase.use-case';
import { AdjustStockUseCase } from '../application/use-cases/inventory/adjust-stock.use-case';

// Note: INVOICE_REPOSITORY and PRODUCT_REPOSITORY are only needed by use cases
// that go through the UoW; standalone queries still use existing NestJS services
// until migration is complete.

const useCases = [
  CreateInvoiceUseCase,
  UpdateInvoiceStatusUseCase,
  GenerateInvoicePdfUseCase,
  CreateProductUseCase,
  RecostProductsUseCase,
  CreatePurchaseUseCase,
  AdjustStockUseCase,
];

@Module({
  imports: [PrismaModule],
  providers: [
    // Infrastructure → Port bindings
    { provide: UNIT_OF_WORK, useClass: PrismaUnitOfWork },
    { provide: BUSINESS_REPOSITORY, useClass: PrismaBusinessRepository },
    { provide: MATERIAL_REPOSITORY, useClass: PrismaMaterialStandaloneRepository },
    { provide: PDF_GENERATOR, useClass: PdfKitInvoiceGenerator },

    // Use Cases
    ...useCases,
  ],
  exports: [
    UNIT_OF_WORK,
    BUSINESS_REPOSITORY,
    MATERIAL_REPOSITORY,
    PDF_GENERATOR,
    ...useCases,
  ],
})
export class CleanArchModule {}
