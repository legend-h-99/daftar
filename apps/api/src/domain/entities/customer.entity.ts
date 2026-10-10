export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string | null;
  createdAt: Date;
}

export interface CreateCustomerData {
  businessId: string;
  name: string;
  phone?: string | null;
}

export interface UpdateCustomerData {
  name?: string;
  phone?: string | null;
}
