/**
 * دفتر EmptyState — encouraging empty list placeholder.
 * Dashed border, icon in brand-wash circle, supportive Arabic copy.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Radius, Spacing } from '../../constants';
import { Text } from './Text';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>{icon}</View>
      <Text variant="headline" style={styles.title}>{title}</Text>
      {subtitle ? (
        <Text variant="body" color="inkSecondary" style={styles.subtitle}>
          {subtitle}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button
          title={actionLabel}
          onPress={onAction}
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.borderMedium,
    borderRadius: Radius['2xl'],
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    color: Colors.inkPrimary,
  },
  subtitle: {
    textAlign: 'center',
  },
  action: {
    marginTop: Spacing.xs,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
  },
});
