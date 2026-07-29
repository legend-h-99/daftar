import { apiClient } from '../api';

export interface RequestOtpPayload {
  phone: string;
}

export interface VerifyOtpPayload {
  phone: string;
  code: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    phone: string;
    businessName?: string;
  };
}

export interface MeResponse {
  id: string;
  phone: string;
  businessName?: string;
  createdAt: string;
}

export const authService = {
  requestOtp: (payload: RequestOtpPayload) =>
    apiClient.post<{ message: string }>('/auth/otp/request', payload),

  verifyOtp: (payload: VerifyOtpPayload) =>
    apiClient.post<AuthResponse>('/auth/otp/verify', payload),

  me: () =>
    apiClient.get<MeResponse>('/auth/me'),

  logout: () =>
    apiClient.post('/auth/logout'),
};
