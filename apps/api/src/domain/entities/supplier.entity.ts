export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  createdAt: Date;
}

export interface CreateSupplierData {
  businessId: string;
  name: string;
  phone?: string | null;
}

export interface UpdateSupplierData {
  name?: string;
  phone?: string | null;
}
