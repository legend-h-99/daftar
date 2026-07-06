import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { ProductsModule } from '../products/products.module';
import { OCR_PROVIDER } from './ocr/ocr.provider';
import { MockOcrProvider } from './ocr/mock-ocr.provider';

@Module({
  imports: [ProductsModule],
  controllers: [PurchasesController],
  providers: [
    PurchasesService,
    // Swap MockOcrProvider for a real implementation here when going live.
    { provide: OCR_PROVIDER, useClass: MockOcrProvider },
  ],
})
export class PurchasesModule {}
