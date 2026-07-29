/**
 * دفتر API Client
 *
 * Connects to the NestJS backend at EXPO_PUBLIC_API_URL (default: http://localhost:3001).
 * JWT is stored in SecureStore and injected as a Bearer header automatically.
 * On 401 the token is cleared and the app navigates to the auth flow.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001') + '/api';

export const TOKEN_KEY = 'daftar_jwt';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Request interceptor — attach JWT ────────────────────────────────────────
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor — handle 401 ───────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      router.replace('/(auth)/login');
    }
    return Promise.reject(error);
  },
);

// ── Auth helpers ─────────────────────────────────────────────────────────────
export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}
