/**
 * دفتر Button — primary action button
 * rounded-2xl, brand-deep background, no gradient.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors, Radius, FontFamily } from '../../constants';
import { Text } from './Text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, loading, disabled, style }: ButtonProps) {
  const handlePress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text style={styles.label}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.brandDeep,
    borderRadius: Radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  pressed: {
    backgroundColor: '#105c44',
  },
  disabled: {
    opacity: 0.6,
  },
  label: {
    color: '#fff',
    fontFamily: FontFamily.bold,
    fontSize: 16,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
});
