import { apiClient } from '../api';

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  totalDebt: number; // "لي عند" amount
  createdAt: string;
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
}

export const customersService = {
  list: () =>
    apiClient.get<Customer[]>('/customers'),

  get: (id: string) =>
    apiClient.get<Customer>(`/customers/${id}`),

  create: (payload: CreateCustomerPayload) =>
    apiClient.post<Customer>('/customers', payload),
};
