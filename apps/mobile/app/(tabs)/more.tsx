import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Alert,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore, BIOMETRIC_KEY } from '../../src/store/auth.store';
import { Colors, Spacing, Radius, FontFamily } from '../../src/constants';
import { Text, Card, ScreenContainer } from '../../src/components/ui';

interface MenuItemProps {
  label: string;
  onPress: () => void;
  danger?: boolean;
}

function MenuItem({ label, onPress, danger }: MenuItemProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      accessibilityRole="button"
    >
      <Text
        variant="body"
        style={[styles.menuLabel, danger && styles.dangerLabel]}
      >
        {label}
      </Text>
      <Text style={[styles.chevron, danger && styles.dangerLabel]}>‹</Text>
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(false);

  useEffect(() => {
    async function checkBiometric() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !isEnrolled) return;

      setBiometricSupported(true);
      const stored = await SecureStore.getItemAsync(BIOMETRIC_KEY);
      setBiometricEnabled(stored === 'true');
    }
    checkBiometric();
  }, []);

  const handleBiometricToggle = async (value: boolean) => {
    if (!value) {
      await SecureStore.deleteItemAsync(BIOMETRIC_KEY);
      setBiometricEnabled(false);
    } else {
      // Verify the user can actually authenticate before enabling
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'تفعيل الدخول بالبصمة',
        cancelLabel: 'إلغاء',
        fallbackLabel: '',
        disableDeviceFallback: true,
      });
      if (result.success) {
        await SecureStore.setItemAsync(BIOMETRIC_KEY, 'true');
        setBiometricEnabled(true);
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Text variant="title">المزيد</Text>
      </View>

      <Card style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.businessName ?? user?.phone ?? '?').charAt(0)}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          {user?.businessName ? (
            <Text variant="headline">{user.businessName}</Text>
          ) : null}
          <Text variant="body" color="inkSecondary">{user?.phone ?? ''}</Text>
        </View>
      </Card>

      <Card style={styles.menuCard}>
        <MenuItem label="المنتجات والمخزون" onPress={() => {}} />
        <View style={styles.divider} />
        <MenuItem label="الموردون" onPress={() => {}} />
        <View style={styles.divider} />
        <MenuItem label="المشتريات" onPress={() => {}} />
        <View style={styles.divider} />
        <MenuItem label="التقارير" onPress={() => {}} />
      </Card>

      <Card style={styles.menuCard}>
        <MenuItem label="إعدادات الحساب" onPress={() => {}} />

        {biometricSupported ? (
          <>
            <View style={styles.divider} />
            <View style={styles.toggleRow}>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: Colors.borderMedium, true: Colors.brandMid }}
                thumbColor={biometricEnabled ? Colors.brandDeep : Colors.inkTertiary}
                accessibilityLabel="تسجيل الدخول بالبصمة"
              />
              <Text variant="body" style={styles.menuLabel}>تسجيل الدخول بالبصمة</Text>
            </View>
          </>
        ) : null}

        <View style={styles.divider} />
        <MenuItem label="تسجيل الخروج" onPress={handleLogout} danger />
      </Card>

      <Text variant="label" color="inkTertiary" style={styles.version}>
        دفتر v0.1.0
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
  },
  profileCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: Colors.brandDeep,
  },
  profileInfo: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  menuCard: {
    marginBottom: Spacing.md,
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  menuItemPressed: {
    backgroundColor: Colors.surfaceApp,
  },
  menuLabel: {
    textAlign: 'right',
  },
  dangerLabel: {
    color: Colors.danger,
  },
  chevron: {
    fontSize: 20,
    color: Colors.inkTertiary,
    lineHeight: 24,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    marginHorizontal: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    minHeight: 52,
  },
  version: {
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});
