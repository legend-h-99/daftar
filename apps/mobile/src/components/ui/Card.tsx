/**
 * دفتر Card — white card on #f7f8f7 background.
 * rounded-2xl, border-subtle, shadow-sm only.
 * Optional variant adds a 4px colored accent on the left (RTL: visual right).
 */
import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { Colors, Radius, CardShadow, Spacing } from '../../constants';

type CardVariant = 'default' | 'brand' | 'warning' | 'danger' | 'success';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  variant?: CardVariant;
}

const ACCENT_COLOR: Record<CardVariant, string> = {
  default: 'transparent',
  brand: Colors.brandDeep,
  warning: Colors.warning,
  danger: Colors.danger,
  success: Colors.success,
};

const ACCENT_BG: Record<CardVariant, string> = {
  default: Colors.surfaceCard,
  brand: Colors.brandWash,
  warning: Colors.warningWash,
  danger: Colors.dangerWash,
  success: Colors.successWash,
};

export function Card({
  children,
  style,
  padding = Spacing.md,
  variant = 'default',
}: CardProps) {
  if (variant === 'default') {
    return (
      <View style={[styles.card, { padding }, style]}>
        {children}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: ACCENT_BG[variant],
          borderColor: ACCENT_COLOR[variant],
          borderWidth: 1,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {/* Colored left accent bar (visually right in RTL) */}
      <View
        style={[
          styles.accentBar,
          { backgroundColor: ACCENT_COLOR[variant] },
        ]}
      />
      <View style={{ flex: 1, padding }}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    ...CardShadow,
  },
  accentBar: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopRightRadius: Radius['2xl'],
    borderBottomRightRadius: Radius['2xl'],
  },
});
