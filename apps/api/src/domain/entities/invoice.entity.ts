export type InvoiceStatus = 'PAID' | 'UNPAID' | 'PARTIAL';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Invoice {
  id: string;
  businessId: string;
  customerId: string | null;
  number: number;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  createdAt: Date;
}

export interface InvoiceWithDetails extends Invoice {
  items: InvoiceItem[];
  customer: { id: string; name: string } | null;
}

export interface CreateInvoiceData {
  businessId: string;
  customerId?: string;
  number: number;
  status: InvoiceStatus;
  dueDate?: Date;
  notes?: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  paidAmount: number;
  items: Array<{
    productId?: string;
    name: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }>;
}

export interface InvoiceFilter {
  status?: InvoiceStatus;
  month?: string;
}
