/**
 * OTP verification screen.
 * Receives phone number via route params, submits 6-digit code to the API.
 * On success: navigates to main tabs.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth.store';
import { authService } from '../../src/lib/services/auth.service';
import { Colors, Spacing, FontFamily } from '../../src/constants';
import { Text, Button } from '../../src/components/ui';
import { OtpInput } from '../../src/components/shared/OtpInput';

const RESEND_COOLDOWN = 60; // seconds

export default function OtpScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const insets = useSafeAreaInsets();
  const login = useAuthStore((s) => s.login);

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, []);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError('أدخل الرمز المكوّن من 6 أرقام');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(phone!, code);
      router.replace('/(tabs)/dashboard');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'الرمز غير صحيح أو انتهت صلاحيته';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !phone) return;
    try {
      await authService.requestOtp({ phone });
      setCountdown(RESEND_COOLDOWN);
      setCode('');
      setError('');
      // Restart timer
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current!); return 0; }
          return c - 1;
        });
      }, 1000);
    } catch {
      setError('تعذّر إعادة الإرسال');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Back */}
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text variant="body" color="brandDeep">{'→'} تغيير الرقم</Text>
        </Pressable>

        {/* Header */}
        <View style={styles.header}>
          <Text variant="title" style={styles.title}>أدخل رمز التحقق</Text>
          <Text variant="body" color="inkSecondary" style={styles.subtitle}>
            أُرسل إلى {phone}
          </Text>
        </View>

        {/* OTP boxes */}
        <OtpInput value={code} onChange={setCode} disabled={loading} />

        {error ? (
          <Text variant="label" color="danger" style={styles.error}>
            {error}
          </Text>
        ) : null}

        {/* Verify button */}
        <Button
          title="تحقق"
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
        />

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text variant="label" color="inkSecondary">
              إعادة الإرسال بعد {countdown} ثانية
            </Text>
          ) : (
            <Pressable onPress={handleResend}>
              <Text variant="label" color="brandDeep">إعادة إرسال الرمز</Text>
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surfaceApp },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  back: { alignSelf: 'flex-end' },
  header: { gap: 4 },
  title: { textAlign: 'right' },
  subtitle: { textAlign: 'right' },
  error: { textAlign: 'center', color: Colors.danger },
  resendRow: { alignItems: 'center', marginTop: 4 },
});
