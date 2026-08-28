import { existsSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { IPdfGenerator, GeneratedPdf } from '../../application/ports/services/pdf-generator.port';
import { InvoiceWithDetails } from '../../domain/entities/invoice.entity';
import { Business } from '../../domain/entities/business.entity';

/**
 * PDFKit adapter for IPdfGenerator.
 * All Arabic RTL layout, font handling, and PDFKit calls are confined here.
 * The application layer only ever calls generateInvoicePdf().
 */
@Injectable()
export class PdfKitInvoiceGenerator implements IPdfGenerator {
  async generateInvoicePdf(invoice: InvoiceWithDetails, business: Business): Promise<GeneratedPdf> {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    const fontPath = join(process.cwd(), 'assets', 'fonts', 'Amiri-Regular.ttf');
    const hasArabicFont = existsSync(fontPath);
    if (hasArabicFont) doc.font(fontPath);
    const ar = hasArabicFont ? { features: ['rtla' as const] } : {};

    const statusLabel =
      invoice.status === 'PAID' ? 'مدفوعة' : invoice.status === 'PARTIAL' ? 'مدفوعة جزئيًا' : 'غير مدفوعة';
    const pageLeft = 50;
    const pageRight = 545;
    const contentWidth = pageRight - pageLeft;

    const rtlLine = (label: string, value?: string, size = 12) => {
      doc.fontSize(size);
      const yy = doc.y;
      doc.text(label, pageLeft, yy, { width: contentWidth, align: 'right', ...ar });
      if (value !== undefined) {
        const labelWidth = doc.widthOfString(label);
        doc.text(value, pageLeft, yy, { width: contentWidth - labelWidth - 6, align: 'right' });
        doc.y = yy + doc.currentLineHeight() * 1.2;
      }
    };

    doc.fontSize(18).text(business.name, pageLeft, doc.y, { width: contentWidth, align: 'right', ...ar });
    doc.moveDown(0.5);
    rtlLine('فاتورة رقم', String(invoice.number));
    rtlLine('التاريخ:', invoice.issueDate.toISOString().slice(0, 10));
    if (invoice.dueDate) rtlLine('تاريخ الاستحقاق:', invoice.dueDate.toISOString().slice(0, 10));
    rtlLine(`الحالة: ${statusLabel}`);
    rtlLine(`الزبون: ${invoice.customer?.name ?? '-'}`);
    doc.moveDown();

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
    if (invoice.vatAmount > 0) rtlLine('ضريبة القيمة المضافة بالريال:', invoice.vatAmount.toFixed(2), 11);
    rtlLine('الإجمالي بالريال:', invoice.total.toFixed(2), 13);
    if (invoice.notes) { doc.moveDown(1.5); rtlLine(`ملاحظات: ${invoice.notes}`, undefined, 10); }

    doc.end();
    const buffer = await done;
    return { buffer, filename: `invoice-${invoice.number}.pdf` };
  }
}
