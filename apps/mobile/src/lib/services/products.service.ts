import { apiClient } from '../api';

export interface Product {
  id: string;
  name: string;
  category?: string;
  sellingPrice: number;
  costPrice: number;
  stock: number;
  createdAt: string;
}

export const productsService = {
  list: () => apiClient.get<Product[]>('/products'),
  get: (id: string) => apiClient.get<Product>(`/products/${id}`),
};
