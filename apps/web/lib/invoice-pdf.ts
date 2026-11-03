import type { Business, Invoice } from './types';
import { formatDate, formatSAR } from './format';
import { zatcaQrPayload } from './zatca';

// Render Arabic with the browser's loaded font, without uploading invoice data.
// Each page gets its own bounded canvas so long invoices fit mobile canvas limits.
export async function createInvoicePdf(invoice: Invoice, business: Business, language: 'ar' | 'en'): Promise<File> {
  const [{ default: html2canvas }, { PDFDocument }, { default: QRCode }] = await Promise.all([
    import('html2canvas'), import('pdf-lib'), import('qrcode'),
  ]);
  await document.fonts.ready;
  const en = language === 'en';
  const host = document.createElement('div');
  const hostId = `invoice-pdf-${crypto.randomUUID()}`;
  host.id = hostId;
  host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;pointer-events:none;';
  host.setAttribute('aria-hidden', 'true');
  host.dataset.invoicePdfHost = 'true';
  const root = document.createElement('div');
  root.dir = en ? 'ltr' : 'rtl';
  root.style.cssText = 'width:720px;box-sizing:border-box;background:#fff;color:#111827;padding:28px;font-size:16px;line-height:1.65;';
  root.style.fontFamily = getComputedStyle(document.body).fontFamily;
  host.append(root);
  const block = (text?: string, css = '') => {
    const el = document.createElement('div');
    el.style.cssText = 'padding:10px 0;overflow-wrap:anywhere;' + css;
    if (text) el.textContent = text;
    el.dataset.pdfBlock = 'true';
    root.append(el);
    return el;
  };
  const money = (n: number) => formatSAR(n, language);
  const row = (parent: HTMLElement, label: string, value: string) => {
    const el = document.createElement('div');
    el.style.cssText = 'display:flex;justify-content:space-between;align-items:start;gap:20px;padding:4px 0;';
    const name = document.createElement('span'); name.textContent = label; name.style.minWidth = '0';
    const amount = document.createElement('span'); amount.textContent = value; amount.style.cssText = 'flex-shrink:0;white-space:nowrap;';
    el.append(name, amount); parent.append(el);
  };
  try {
    const header = block(undefined, 'border-bottom:2px solid #0f7353;margin-bottom:12px;');
    const title = document.createElement('div'); title.style.cssText = 'font-size:23px;font-weight:700;';
    title.textContent = business.vatEnabled ? (en ? 'Simplified Tax Invoice' : 'فاتورة ضريبية مبسطة') : (en ? 'Invoice' : 'فاتورة');
    header.append(title);
    row(header, business.name, en ? `Invoice #${invoice.number}` : `فاتورة رقم ${invoice.number}`);
    if (business.vatEnabled && business.vatNumber) row(header, en ? 'VAT number' : 'الرقم الضريبي', business.vatNumber);
    if (invoice.createdAt) row(header, en ? 'Date' : 'التاريخ', formatDate(invoice.createdAt));
    const status = invoice.voidedAt ? (en ? 'Cancelled' : 'ملغاة') : invoice.status === 'PAID' ? (en ? 'Paid' : 'مدفوعة') : invoice.status === 'PARTIAL' ? (en ? 'Partially paid' : 'مدفوعة جزئيًا') : (en ? 'Unpaid' : 'غير مدفوعة');
    row(header, en ? 'Status' : 'الحالة', status);
    if (invoice.customer) block((en ? 'Customer: ' : 'العميل: ') + invoice.customer.name, 'background:#f8fafc;padding:12px;margin-bottom:8px;');
    invoice.items.forEach(item => {
      const itemBlock = block(undefined, 'border-bottom:1px solid #e5e7eb;');
      row(itemBlock, item.name, money(item.unitPrice * item.quantity));
      const detail = document.createElement('div'); detail.textContent = `${item.quantity} × ${money(item.unitPrice)}`;
      detail.style.cssText = 'font-size:13px;color:#4b5563;'; itemBlock.append(detail);
    });
    const totals = block(undefined, 'margin-top:12px;border-top:2px solid #0f7353;');
    row(totals, en ? 'Subtotal' : 'المجموع الفرعي', money(invoice.subtotal));
    if (invoice.vatAmount > 0) row(totals, en ? 'VAT' : 'ضريبة القيمة المضافة', money(invoice.vatAmount));
    const totalRow = document.createElement('div'); totalRow.style.cssText = 'font-size:22px;font-weight:700;background:#f0fdf4;padding:8px;color:#065f46;';
    row(totalRow, en ? 'Total' : 'الإجمالي', money(invoice.total)); totals.append(totalRow);
    if (invoice.status === 'PARTIAL') {
      row(totals, en ? 'Paid' : 'المدفوع', money(Number(invoice.paidAmount ?? 0)));
      row(totals, en ? 'Remaining' : 'المتبقي', money(Math.max(0, invoice.total - Number(invoice.paidAmount ?? 0))));
    }
    if (invoice.dueDate) block((en ? 'Due date: ' : 'تاريخ الاستحقاق: ') + formatDate(invoice.dueDate));
    if (invoice.notes) block(invoice.notes, 'font-size:14px;background:#f8fafc;padding:12px;');
    if (business.vatEnabled && business.vatNumber) {
      const qr = document.createElement('canvas');
      await QRCode.toCanvas(qr, zatcaQrPayload({sellerName:business.name,vatNumber:business.vatNumber,timestamp:new Date(invoice.issueDate ?? invoice.createdAt ?? Date.now()).toISOString(),total:invoice.total,vatAmount:invoice.vatAmount}), {width:144,margin:1,errorCorrectionLevel:'M'});
      const qrBlock = block(undefined, 'display:flex;justify-content:center;padding-top:16px;'); qrBlock.append(qr);
    }
    document.body.append(host);
    const top = root.getBoundingClientRect().top;
    const boundaries = [...root.children].map(el => el.getBoundingClientRect().bottom - top);
    const height = Math.ceil(root.getBoundingClientRect().height);
    const pdf = await PDFDocument.create();
    const pageWidth = 595.28, pageHeight = 841.89, margin = 28;
    const contentWidth = pageWidth - 2 * margin;
    const pagePixels = Math.floor((pageHeight - 2 * margin - 15) * 720 / contentWidth);
    let start = 0;
    while (start < height) {
      const limit = Math.min(height, start + pagePixels);
      const candidates = boundaries.filter(b => b > start + 1 && b <= limit);
      // Keep item rows, totals and QR together; split only an oversized block.
      const end = limit === height ? height : Math.floor(candidates.at(-1) ?? limit);
      const canvas = await html2canvas(root, {backgroundColor:'#ffffff',scale:2,width:720,height:end-start,y:start,logging:false,windowWidth:800,windowHeight:1200,onclone: cloned => {
        const clonedHost = cloned.getElementById(hostId);
        if (clonedHost) clonedHost.style.cssText = 'position:absolute;left:0;top:0;width:720px;height:auto;overflow:visible;';
        // Isolate the receipt from app theme colors (including unsupported OKLCH).
        for (const ancestor of [cloned.documentElement, cloned.body, ...cloned.querySelectorAll<HTMLElement>('[data-invoice-pdf-host], [data-invoice-pdf-host] *')]) {
          ancestor.style.borderColor = '#e5e7eb';
          ancestor.style.outlineColor = '#e5e7eb';
          ancestor.style.textDecorationColor = '#111827';
        }
        cloned.documentElement.style.color = cloned.body.style.color = '#111827';
        cloned.documentElement.style.backgroundColor = cloned.body.style.backgroundColor = '#ffffff';
      }});
      const image = await pdf.embedPng(canvas.toDataURL('image/png'));
      const page = pdf.addPage([pageWidth,pageHeight]);
      const drawnHeight = (end - start) * contentWidth / 720;
      page.drawImage(image,{x:margin,y:pageHeight-margin-drawnHeight,width:contentWidth,height:drawnHeight});
      page.drawText(String(pdf.getPageCount()),{x:pageWidth/2,y:15,size:9});
      canvas.width = 0; canvas.height = 0;
      start = end;
    }
    pdf.setTitle(`Invoice ${invoice.number}`);
    pdf.setCreator('Daftar');
    const bytes = await pdf.save();
    return new File([new Uint8Array(bytes)], `Daftar-Invoice-${invoice.number}.pdf`, {type:'application/pdf'});
  } finally { host.remove(); }
}

export function downloadInvoicePdf(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a'); link.href = url; link.download = file.name;
  document.body.append(link); link.click(); link.remove();
  // Safari may consume the blob after the click handler returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
