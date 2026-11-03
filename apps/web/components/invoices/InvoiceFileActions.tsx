"use client";

import { useEffect, useState } from 'react';
import { Download, Share2, Printer, Copy } from 'lucide-react';
import type { Business, Invoice } from '@/lib/types';
import { createInvoicePdf, downloadInvoicePdf } from '@/lib/invoice-pdf';

export default function InvoiceFileActions({ invoice, business, language, text, textLink }: {
  invoice: Invoice; business: Business; language: 'ar' | 'en'; text: string; textLink: string;
}) {
  const en = language === 'en';
  const key = JSON.stringify([invoice, business, language]);
  const [prepared, setPrepared] = useState<{key: string; file: File} | null>(null);
  const file = prepared?.key === key ? prepared.file : null;
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setPrepared(null); setFailed(false); setNotice('');
    createInvoicePdf(invoice, business, language).then(result => {
      if (active) setPrepared({key, file: result});
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [invoice, business, language, key, retry]);

  async function share() {
    if (!file || sharing) return;
    setNotice('');
    if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
      downloadInvoicePdf(file);
      setNotice(en ? 'PDF downloaded. Attach it in WhatsApp and copy the message below.' : 'تم تنزيل PDF. أرفقه في واتساب، ويمكنك نسخ نص الرسالة من الزر أدناه.');
      return;
    }
    setSharing(true);
    try {
      // The file is prepared before this tap to preserve iPhone user activation.
      await navigator.share({ files: [file], text, title: en ? `Invoice ${invoice.number}` : `فاتورة رقم ${invoice.number}` });
    } catch (error) {
      if (!(typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')) {
        setNotice(en ? 'Could not share. Download the PDF and attach it manually.' : 'تعذرت المشاركة. نزّل PDF وأرفقه في واتساب؛ يمكنك نسخ نص الرسالة أدناه.');
      }
    } finally { setSharing(false); }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(en ? 'Message copied. Paste it with the PDF in WhatsApp.' : 'نُسخ النص. الصقه مع ملف PDF في واتساب.');
    } catch { setNotice(en ? 'Select and copy the message below.' : 'حدد نص الرسالة أدناه وانسخه.'); }
  }
  const button = 'flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold disabled:opacity-50';
  return <section className="flex flex-col gap-3 print:hidden" aria-label={en ? 'Export and share invoice' : 'تصدير ومشاركة الفاتورة'}>
    <div className="grid grid-cols-2 gap-3">
      <button type="button" disabled={!file || sharing} onClick={() => file && downloadInvoicePdf(file)} className={`${button} border border-gray-200 bg-white text-gray-800`}>
        <Download className="h-4 w-4 shrink-0" />{en ? 'Download PDF' : 'تنزيل PDF'}
      </button>
      <button type="button" disabled={!file || sharing} onClick={share} className={`${button} bg-green-600 text-white`}>
        <Share2 className="h-4 w-4 shrink-0" />{sharing ? (en ? 'Sharing…' : 'جاري المشاركة…') : (en ? 'Share PDF + message' : 'مشاركة PDF مع نص')}
      </button>
    </div>
    {!file && !failed && <p role="status" className="text-sm text-gray-500">{en ? 'Preparing invoice PDF…' : 'جاري تجهيز ملف الفاتورة…'}</p>}
    {failed && <div role="alert" className="text-sm text-red-700">
      <p>{en ? 'PDF preparation failed. Retry or use printing.' : 'تعذر تجهيز PDF. أعد المحاولة أو استخدم الطباعة.'}</p>
      <button type="button" onClick={() => setRetry(n => n + 1)} className="min-h-11 underline">{en ? 'Retry' : 'إعادة المحاولة'}</button>
    </div>}
    <p className="text-xs text-gray-500">{en ? 'Choose WhatsApp in the share sheet, then choose the customer. If the message is omitted, copy it below.' : 'اختر واتساب من قائمة المشاركة ثم العميل. إذا لم ينتقل النص مع الملف، انسخه من الأسفل.'}</p>
    {notice && <p role="status" className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
    <details className="rounded-lg border border-gray-100 bg-white p-3 text-sm">
      <summary className="cursor-pointer font-semibold">{en ? 'Message and other options' : 'نص الرسالة وخيارات أخرى'}</summary>
      <p className="my-3 select-text whitespace-pre-wrap text-gray-700">{text}</p>
      <button type="button" onClick={copy} className={`${button} border border-gray-200 text-gray-700`}><Copy className="h-4 w-4" />{en ? 'Copy message' : 'نسخ نص الرسالة'}</button>
      <div className="mt-2 flex flex-wrap gap-3">
        <a href={textLink} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline">{en ? 'WhatsApp text only' : 'واتساب: نص فقط'}</a>
        <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-1 underline"><Printer className="h-4 w-4" />{en ? 'Print' : 'طباعة'}</button>
      </div>
    </details>
  </section>;
}
