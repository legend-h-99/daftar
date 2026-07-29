/**
 * دفتر TextInput — RTL-first input field.
 * Gray background → white on focus, brand ring on focus, red ring on error.
 */
import React, { useState } from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  View,
  StyleSheet,
} from 'react-native';
import { Colors, Radius, FontFamily } from '../../constants';
import { Text } from './Text';

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
}

export function TextInput({ label, error, style, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label ? (
        <Text variant="label" color="inkSecondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <RNTextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
          style,
        ]}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor={Colors.inkTertiary}
        textAlign="right"
        {...props}
      />
      {error ? (
        <Text variant="label" color="danger" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.inkPrimary,
    textAlign: 'right',
    minHeight: 52,
  },
  inputFocused: {
    backgroundColor: Colors.surfaceCard,
    borderColor: Colors.brandMid,
    // React Native doesn't support CSS ring — we approximate with borderWidth
    borderWidth: 2,
  },
  inputError: {
    borderColor: Colors.danger,
    borderWidth: 2,
  },
  errorText: {
    marginTop: 4,
  },
});
