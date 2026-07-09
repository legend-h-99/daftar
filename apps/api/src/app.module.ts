import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AuthModule } from './auth/auth.module';
import { BusinessModule } from './business/business.module';
import { MaterialsModule } from './materials/materials.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { InvoicesModule } from './invoices/invoices.module';
import { ExpensesModule } from './expenses/expenses.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { InventoryModule } from './inventory/inventory.module';
import { PurchasesModule } from './purchases/purchases.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limit (per IP): generous default for normal app traffic;
    // auth and OCR-scan endpoints carry stricter @Throttle overrides.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    BusinessModule,
    MaterialsModule,
    ProductsModule,
    CustomersModule,
    InvoicesModule,
    ExpensesModule,
    DashboardModule,
    SuppliersModule,
    InventoryModule,
    PurchasesModule,
    CleanupModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
