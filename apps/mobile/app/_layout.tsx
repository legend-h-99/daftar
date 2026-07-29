/**
 * Root layout — loads fonts, initialises QueryClient and auth, then routes.
 *
 * RTL is forced at the I18nManager level (React Native's global text direction).
 * This must happen before any render, so it's done at module evaluation time.
 */
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { I18nManager } from 'react-native';
import { Stack } from 'expo-router';
import { SplashScreen } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
  Tajawal_800ExtraBold,
} from '@expo-google-fonts/tajawal';
import { queryClient } from '../src/lib/queryClient';
import { useAuthStore } from '../src/store/auth.store';

// Force RTL globally — affects all TextInput, Text, and layout direction.
// Must run synchronously before first render.
if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
}

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Tajawal_800ExtraBold,
  });

  const loadMe = useAuthStore((s) => s.loadMe);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (fontsLoaded && !isLoading) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, isLoading]);

  if (!fontsLoaded) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
