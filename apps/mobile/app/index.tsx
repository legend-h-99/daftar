import React, { useEffect, useRef, useState } from 'react';
import { Redirect, router } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, BIOMETRIC_KEY } from '../src/store/auth.store';
import { apiClient, getToken, clearToken } from '../src/lib/api';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const biometricAttempted = useRef(false);
  const [biometricPending, setBiometricPending] = useState(false);

  useEffect(() => {
    if (isLoading || biometricAttempted.current) return;

    async function tryBiometric() {
      biometricAttempted.current = true;

      const token = await getToken();
      if (!token) return;

      const enrolled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (enrolled !== 'true') return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      if (!hasHardware) return;

      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!isEnrolled) return;

      let attempts = 0;
      while (attempts < 3) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'الدخول إلى دفتر',
          cancelLabel: 'إلغاء',
          fallbackLabel: '',
          disableDeviceFallback: true,
        });

        if (result.success) {
          // Validate token is still accepted by the server before navigating
          try {
            await apiClient.get('/auth/me');
            router.replace('/(tabs)/dashboard');
          } catch {
            // Token expired or revoked — clear and go to login
            await clearToken();
            await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
            router.replace('/(auth)/login');
          }
          return;
        }

        if (result.error === 'user_cancel' || result.error === 'system_cancel') {
          router.replace('/(auth)/login');
          return;
        }

        attempts++;
      }

      // 3 failures — fall back silently
      router.replace('/(auth)/login');
    }

    if (!isAuthenticated) {
      setBiometricPending(true);
      (async () => {
        await tryBiometric();
        setBiometricPending(false);
      })();
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || biometricPending) return null;

  return isAuthenticated
    ? <Redirect href="/(tabs)/dashboard" />
    : <Redirect href="/(auth)/login" />;
}
