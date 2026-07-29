/**
 * دفتر Badge — invoice status pill.
 * Polished pill with dot indicator and semantic color.
 * Only three semantic variants; no decorative colors.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, FontFamily } from '../../constants';
import { Text } from './Text';

type BadgeVariant = 'paid' | 'unpaid' | 'partial';

interface BadgeProps {
  variant: BadgeVariant;
}

const CONFIG: Record<BadgeVariant, { bg: string; text: string; dot: string; label: string }> = {
  paid: {
    bg: Colors.successWash,
    text: Colors.success,
    dot: Colors.success,
    label: 'مدفوعة',
  },
  unpaid: {
    bg: Colors.dangerWash,
    text: Colors.danger,
    dot: Colors.danger,
    label: 'غير مدفوعة',
  },
  partial: {
    bg: '#fefce8',
    text: '#854d0e',
    dot: '#ca8a04',
    label: 'جزئي',
  },
};

export function Badge({ variant }: BadgeProps) {
  const { bg, text, dot, label } = CONFIG[variant];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row-reverse',
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    textAlign: 'right',
  },
});
