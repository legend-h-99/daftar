import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, Business } from '@/lib/types';
const mocks = vi.hoisted(() => ({create:vi.fn(),download:vi.fn()}));
vi.mock('@/lib/invoice-pdf', () => ({createInvoicePdf:mocks.create,downloadInvoicePdf:mocks.download}));
import InvoiceFileActions from '@/components/invoices/InvoiceFileActions';
const invoice: Invoice = {id:'test',number:1,status:'UNPAID',items:[],subtotal:100,vatAmount:0,total:100};
const business: Business = {id:'biz',name:'اختبار',vatEnabled:false};
const file = new File(['%PDF-1.7 test'], 'Daftar-Invoice-1.pdf', {type:'application/pdf'});
const props = {invoice,business,language:'ar' as const,text:'فاتورة رقم 1\nالإجمالي: 100 ريال',textLink:'https://wa.me/?text=test'};
const share = vi.fn();
beforeEach(() => {
  vi.clearAllMocks(); mocks.create.mockResolvedValue(file);
  Object.defineProperty(navigator,'share',{configurable:true,value:share});
  Object.defineProperty(navigator,'canShare',{configurable:true,value:vi.fn(()=>true)});
});
async function ready() { await waitFor(()=>expect(screen.getByRole('button',{name:'مشاركة PDF مع نص'})).toBeEnabled()); }
describe('invoice file delivery', () => {
  it('sends a real PDF file and message in the same native share call', async () => {
    render(<InvoiceFileActions {...props}/>);await ready();
    fireEvent.click(screen.getByRole('button',{name:'مشاركة PDF مع نص'}));
    expect(share).toHaveBeenCalledWith({files:[file],text:props.text,title:'فاتورة رقم 1'});
    expect(mocks.download).not.toHaveBeenCalled();
  });
  it('downloads the file and explains attachment when native file sharing is unavailable', async () => {
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>false});
    render(<InvoiceFileActions {...props}/>);await ready();
    fireEvent.click(screen.getByRole('button',{name:'مشاركة PDF مع نص'}));
    expect(mocks.download).toHaveBeenCalledWith(file);expect(share).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('أرفقه في واتساب');
  });
  it('does not download or report an error after share cancellation', async () => {
    share.mockRejectedValueOnce(new DOMException('Cancelled','AbortError'));
    render(<InvoiceFileActions {...props}/>);await ready();fireEvent.click(screen.getByRole('button',{name:'مشاركة PDF مع نص'}));
    await waitFor(()=>expect(screen.getByRole('button',{name:'مشاركة PDF مع نص'})).toBeEnabled());
    expect(mocks.download).not.toHaveBeenCalled();expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('allows retry when PDF preparation fails', async () => {
    mocks.create.mockRejectedValueOnce(new Error('Rendering failed'));
    render(<InvoiceFileActions {...props}/>);await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button',{name:'إعادة المحاولة'}));await ready();
    expect(mocks.create).toHaveBeenCalledTimes(2);
  });
  it('disables delivery of a stale file after invoice details change', async () => {
    const {rerender}=render(<InvoiceFileActions {...props}/>);await ready();
    mocks.create.mockReturnValueOnce(new Promise(()=>{}));
    rerender(<InvoiceFileActions {...props} invoice={{...invoice,total:120}}/>);
    expect(screen.getByRole('button',{name:'مشاركة PDF مع نص'})).toBeDisabled();
  });
});
