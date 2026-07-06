import { existsSync } from 'fs';
import { join } from 'path';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceStatusDto } from './dto/update-invoice-status.dto';
import { FindInvoicesQueryDto } from './dto/find-invoices-query.dto';

const VAT_RATE = 0.15;
const MAX_NUMBER_ASSIGN_RETRIES = 5;

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(businessId: string, dto: CreateInvoiceDto) {
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const items = dto.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.unitPrice * i.quantity,
    }));
    const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
    const vatAmount = business.vatEnabled ? subtotal * VAT_RATE : 0;
    const total = subtotal + vatAmount;

    // Sequential per-business invoice numbering. We derive next number inside
    // a Serializable transaction (protects against concurrent races) and
    // additionally retry on a unique-constraint conflict (@@unique([businessId, number]))
    // as a defense-in-depth safety net for databases/drivers where true
    // serializable isolation still allows a narrow race window.
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_NUMBER_ASSIGN_RETRIES; attempt++) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const agg = await tx.invoice.aggregate({
              where: { businessId },
              _max: { number: true },
            });
            const nextNumber = (agg._max.number ?? 0) + 1;

            const invoice = await tx.invoice.create({
              data: {
                businessId,
                customerId: dto.customerId,
                number: nextNumber,
                status: dto.status ?? 'UNPAID',
                dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
                notes: dto.notes,
                subtotal,
                vatAmount,
                total,
                paidAmount: 0,
                items: { create: items },
              },
              include: { items: true, customer: true },
            });

            await this.consumeStockForSale(tx, businessId, invoice.id, items);

            return invoice;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        lastError = error;
        // P2002 = unique constraint violation on [businessId, number]; retry.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  /**
   * Sales ↔ inventory integration: selling a product consumes the materials
   * in its recipe (raw + packaging). Runs inside the invoice-creation
   * transaction so the invoice, the stock levels, and the movement ledger
   * can never drift apart. Stock may go negative (we warn, not block —
   * the seller at a bazaar shouldn't be stopped by a data-entry backlog).
   */
  private async consumeStockForSale(
    tx: Prisma.TransactionClient,
    businessId: string,
    invoiceId: string,
    items: { productId?: string | null; quantity: number }[],
  ) {
    const productIds = [
      ...new Set(items.filter((i) => i.productId).map((i) => i.productId as string)),
    ];
    if (productIds.length === 0) return;

    const recipeLines = await tx.recipeItem.findMany({
      where: {
        productId: { in: productIds },
        materialId: { not: null },
        product: { businessId },
      },
      select: { productId: true, materialId: true, quantityUsed: true },
    });
    if (recipeLines.length === 0) return;

    // Aggregate total consumption per material across all invoice lines.
    const consumedByMaterial = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) continue;
      for (const line of recipeLines) {
        if (line.productId !== item.productId || !line.materialId) continue;
        const used = line.quantityUsed * item.quantity;
        consumedByMaterial.set(
          line.materialId,
          (consumedByMaterial.get(line.materialId) ?? 0) + used,
        );
      }
    }

    for (const [materialId, qty] of consumedByMaterial) {
      if (qty <= 0) continue;
      const updated = await tx.material.update({
        where: { id: materialId },
        data: { stockQty: { decrement: qty } },
      });
      await tx.stockMovement.create({
        data: {
          businessId,
          materialId,
          type: 'SALE',
          qty: -qty,
          balanceAfter: updated.stockQty,
          refType: 'invoice',
          refId: invoiceId,
        },
      });
    }
  }

  findAll(businessId: string, query: FindInvoicesQueryDto) {
    return this.prisma.invoice.findMany({
      where: { businessId, status: query.status },
      include: { customer: true },
      orderBy: { number: 'desc' },
    });
  }

  async findOne(businessId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: { items: true, customer: true },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  async updateStatus(businessId: string, id: string, dto: UpdateInvoiceStatusDto) {
    await this.findOne(businessId, id);
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: dto.status,
        paidAmount: dto.paidAmount,
      },
      include: { items: true, customer: true },
    });
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    await this.prisma.invoice.delete({ where: { id } });
    return { deleted: true };
  }

  async generatePdf(businessId: string, id: string): Promise<{ buffer: Buffer; filename: string }> {
    const invoice = await this.findOne(businessId, id);
    const business = await this.prisma.business.findUnique({ where: { id: businessId } });

    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    const done = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // Amiri renders/shapes Arabic; pdfkit needs the 'rtla' OpenType feature
    // to lay the shaped glyphs out right-to-left. Falls back to Helvetica
    // (Latin-only) if the font file is missing.
    const fontPath = join(process.cwd(), 'assets', 'fonts', 'Amiri-Regular.ttf');
    const hasArabicFont = existsSync(fontPath);
    if (hasArabicFont) doc.font(fontPath);
    const ar = hasArabicFont ? { features: ['rtla' as const] } : {};

    const statusLabel =
      invoice.status === 'PAID' ? 'مدفوعة' : invoice.status === 'PARTIAL' ? 'مدفوعة جزئيًا' : 'غير مدفوعة';
    const pageLeft = 50;
    const pageRight = 545;
    const contentWidth = pageRight - pageLeft;

    // The 'rtla' feature reverses the WHOLE glyph run, which is correct for
    // Arabic but garbles embedded Latin digits (2026 -> 6202). So mixed lines
    // are drawn as two runs at the same y: the Arabic label (with rtla,
    // right-aligned) and the plain-LTR value just to its left.
    const rtlLine = (label: string, value?: string, size = 12) => {
      doc.fontSize(size);
      const yy = doc.y;
      doc.text(label, pageLeft, yy, { width: contentWidth, align: 'right', ...ar });
      if (value !== undefined) {
        const labelWidth = doc.widthOfString(label);
        doc.text(value, pageLeft, yy, {
          width: contentWidth - labelWidth - 6,
          align: 'right',
        });
        doc.y = yy + doc.currentLineHeight() * 1.2;
      }
    };

    // RTL header block: business name and invoice meta, right-aligned.
    doc.fontSize(18).text(business?.name ?? 'دفتر', pageLeft, doc.y, { width: contentWidth, align: 'right', ...ar });
    doc.moveDown(0.5);
    rtlLine('فاتورة رقم', String(invoice.number));
    rtlLine('التاريخ:', invoice.issueDate.toISOString().slice(0, 10));
    if (invoice.dueDate) {
      rtlLine('تاريخ الاستحقاق:', invoice.dueDate.toISOString().slice(0, 10));
    }
    rtlLine(`الحالة: ${statusLabel}`);
    rtlLine(`الزبون: ${invoice.customer?.name ?? '-'}`);
    doc.moveDown();

    // Table, mirrored for RTL: item name column on the right, totals on the left.
    const tableTop = doc.y;
    const col = { total: 50, price: 150, qty: 260, name: 320 };
    const nameWidth = pageRight - col.name;
    doc.fontSize(11);
    doc.text('الصنف', col.name, tableTop, { width: nameWidth, align: 'right', ...ar });
    doc.text('الكمية', col.qty, tableTop, { width: 50, align: 'center', ...ar });
    doc.text('سعر الوحدة', col.price, tableTop, { width: 90, align: 'center', ...ar });
    doc.text('الإجمالي', col.total, tableTop, { width: 90, align: 'center', ...ar });
    doc.moveTo(pageLeft, tableTop + 20).lineTo(pageRight, tableTop + 20).stroke();

    let y = tableTop + 28;
    for (const item of invoice.items) {
      doc.fontSize(10);
      doc.text(item.name, col.name, y, { width: nameWidth, align: 'right', ...ar });
      doc.text(String(item.quantity), col.qty, y, { width: 50, align: 'center' });
      doc.text(item.unitPrice.toFixed(2), col.price, y, { width: 90, align: 'center' });
      doc.text(item.lineTotal.toFixed(2), col.total, y, { width: 90, align: 'center' });
      y += 22;
    }

    doc.moveTo(pageLeft, y + 4).lineTo(pageRight, y + 4).stroke();
    y += 16;

    doc.y = y;
    rtlLine('المجموع الفرعي بالريال:', invoice.subtotal.toFixed(2), 11);
    if (invoice.vatAmount > 0) {
      rtlLine('ضريبة القيمة المضافة بالريال:', invoice.vatAmount.toFixed(2), 11);
    }
    rtlLine('الإجمالي بالريال:', invoice.total.toFixed(2), 13);

    if (invoice.notes) {
      doc.moveDown(1.5);
      rtlLine(`ملاحظات: ${invoice.notes}`, undefined, 10);
    }

    doc.end();

    const buffer = await done;
    return { buffer, filename: `invoice-${invoice.number}.pdf` };
  }
}
