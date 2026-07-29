/**
 * دفتر Text — RTL-aware text with Tajawal variants.
 * Always renders right-to-left; never overrides writingDirection.
 */
import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
} from 'react-native';
import { Colors, TextStyle, FontFamily } from '../../constants';

type Variant = keyof typeof TextStyle;
type ColorKey = keyof typeof Colors;

interface TextProps extends RNTextProps {
  variant?: Variant;
  color?: ColorKey;
}

export function Text({
  variant = 'body',
  color = 'inkPrimary',
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      style={[styles.base, TextStyle[variant], { color: Colors[color] }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    writingDirection: 'rtl',
    textAlign: 'right',
    fontFamily: FontFamily.regular,
  },
});
