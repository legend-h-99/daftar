import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { saveToken, clearToken } from '../lib/api';
import { authService } from '../lib/services/auth.service';
import type { MeResponse } from '../lib/services/auth.service';

export const BIOMETRIC_KEY = 'biometric_enrolled';

interface AuthState {
  user: MeResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  login: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  loadMe: () => Promise<void>;
  enrollBiometric: () => Promise<void>;
  unenrollBiometric: () => Promise<void>;
  isBiometricEnrolled: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,

  login: async (phone, code) => {
    set({ isLoading: true });
    try {
      const { data } = await authService.verifyOtp({ phone, code });
      await saveToken(data.accessToken);
      const { data: me } = await authService.me();
      set({ user: me, isAuthenticated: true, isLoading: false });
      // Auto-enroll biometric after successful OTP login
      await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      await clearToken();
      set({ user: null, isAuthenticated: false });
    }
  },

  loadMe: async () => {
    set({ isLoading: true });
    try {
      const { data } = await authService.me();
      set({ user: data, isAuthenticated: true, isLoading: false });
    } catch {
      await clearToken();
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  enrollBiometric: async () => {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
  },

  unenrollBiometric: async () => {
    await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
  },

  isBiometricEnrolled: async () => {
    const val = await SecureStore.getItemAsync(BIOMETRIC_KEY);
    return val === 'true';
  },
}));
