import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Feather } from '@expo/vector-icons';
import { authService } from '../../src/lib/services/auth.service';
import { Colors, Spacing, FontFamily } from '../../src/constants';
import { Text, Button, TextInput } from '../../src/components/ui';
import { getToken } from '../../src/lib/api';
import { BIOMETRIC_KEY } from '../../src/store/auth.store';

function normaliseSaudiPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('05') && digits.length === 10) {
    return '+966' + digits.slice(1);
  }
  if (digits.startsWith('966') && digits.length === 12) {
    return '+' + digits;
  }
  return raw.trim();
}

const IS_DEV = process.env.EXPO_PUBLIC_API_URL?.includes('localhost') ?? true;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    async function checkBiometric() {
      const token = await getToken();
      if (!token) return;

      const enrolled = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      if (enrolled !== 'true') return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && isEnrolled);
    }
    checkBiometric();
  }, []);

  const handleBiometric = useCallback(async () => {
    let attempts = 0;
    while (attempts < 3) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'الدخول إلى دفتر',
        cancelLabel: 'إلغاء',
        fallbackLabel: '',
        disableDeviceFallback: true,
      });

      if (result.success) {
        router.replace('/(tabs)/dashboard');
        return;
      }

      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        return;
      }

      attempts++;
    }
    // 3 failures — stay on login screen silently
  }, []);

  const handleSubmit = async () => {
    setError('');
    const normalised = normaliseSaudiPhone(phone);

    if (!normalised) {
      setError('أدخل رقم الجوال');
      return;
    }

    setLoading(true);
    try {
      await authService.requestOtp({ phone: normalised });
      router.push({ pathname: '/(auth)/otp', params: { phone: normalised } });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'تعذّر الإرسال، حاول مرة أخرى';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Brand mark */}
        <View style={styles.brand}>
          <Text style={styles.logo}>دفتر</Text>
          <Text variant="body" color="inkSecondary" style={styles.tagline}>
            دفتر حسابك الذكي
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text variant="title" style={styles.heading}>أدخل رقم جوالك</Text>
          <Text variant="body" color="inkSecondary" style={styles.subheading}>
            سنرسل لك رمز التحقق
          </Text>

          <TextInput
            label="رقم الجوال"
            placeholder="05xxxxxxxx"
            value={phone}
            onChangeText={(t) => { setPhone(t); setError(''); }}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            error={error}
            style={styles.phoneInput}
          />

          {IS_DEV ? (
            <Text variant="label" style={styles.devHint}>
              وضع التطوير: استخدم 0500000001 — رمز OTP يظهر في لوجز الـ API
            </Text>
          ) : null}

          <Button
            title="إرسال رمز التحقق"
            onPress={handleSubmit}
            loading={loading}
            disabled={!phone.trim()}
            style={styles.submitBtn}
          />

          {biometricAvailable ? (
            <Pressable
              onPress={handleBiometric}
              style={({ pressed }) => [styles.biometricBtn, pressed && styles.biometricBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="الدخول بالبصمة"
            >
              <Feather name="shield" size={20} color={Colors.brandDeep} />
              <Text variant="body" color="brandDeep" style={styles.biometricLabel}>
                الدخول ببصمة الإصبع / وجهك
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.surfaceApp,
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  brand: {
    alignItems: 'center',
    gap: 4,
  },
  logo: {
    fontFamily: FontFamily.extraBold,
    fontSize: 40,
    color: Colors.brandDeep,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
  },
  form: {
    gap: Spacing.md,
  },
  heading: {
    textAlign: 'right',
  },
  subheading: {
    textAlign: 'right',
    marginTop: -8,
  },
  phoneInput: {
    marginTop: 4,
  },
  devHint: {
    color: Colors.warning,
    backgroundColor: Colors.warningWash,
    padding: Spacing.sm,
    borderRadius: 8,
    textAlign: 'right',
  },
  submitBtn: {
    marginTop: 4,
  },
  biometricBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.brandDeep,
    minHeight: 52,
    backgroundColor: Colors.brandWash,
  },
  biometricBtnPressed: {
    backgroundColor: Colors.brandLight,
  },
  biometricLabel: {
    textAlign: 'center',
  },
});
