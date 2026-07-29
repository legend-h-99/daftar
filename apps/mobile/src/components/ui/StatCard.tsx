/**
 * دفتر StatCard — summary number card on dashboard.
 * Clean card with colored left-border accent, large bold number, and label.
 * No emoji chip — professional and scannable.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing, CardShadow, FontFamily } from '../../constants';
import { Text } from './Text';

type StatVariant = 'brand' | 'danger' | 'warning' | 'success';

interface StatCardProps {
  label: string;
  value: string;
  variant?: StatVariant;
  style?: object;
}

const ACCENT_COLOR: Record<StatVariant, string> = {
  brand: Colors.brandDeep,
  danger: Colors.danger,
  warning: Colors.warning,
  success: Colors.success,
};

const ACCENT_BG: Record<StatVariant, string> = {
  brand: Colors.brandWash,
  danger: Colors.dangerWash,
  warning: Colors.warningWash,
  success: Colors.successWash,
};

const VALUE_COLOR: Record<StatVariant, string> = {
  brand: Colors.brandDeep,
  danger: Colors.danger,
  warning: Colors.warning,
  success: Colors.success,
};

export function StatCard({
  label,
  value,
  variant = 'brand',
  style,
}: StatCardProps) {
  const accentColor = ACCENT_COLOR[variant];
  const accentBg = ACCENT_BG[variant];
  const valueColor = VALUE_COLOR[variant];

  return (
    <View style={[styles.card, { backgroundColor: accentBg }, style]}>
      {/* RTL accent bar on the right side */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        <Text variant="label" color="inkSecondary" style={styles.label}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    overflow: 'hidden',
    flexDirection: 'row',
    ...CardShadow,
  },
  accentBar: {
    width: 4,
    borderTopRightRadius: Radius['2xl'],
    borderBottomRightRadius: Radius['2xl'],
    // RTL: right-side bar appears visually on the right (leading edge in Arabic)
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    paddingRight: Spacing.md + 4,
    gap: 4,
    alignItems: 'flex-end',
  },
  value: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'right',
  },
  label: {
    textAlign: 'right',
  },
});
