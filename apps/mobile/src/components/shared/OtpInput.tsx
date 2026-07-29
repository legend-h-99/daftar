/**
 * OtpInput — six individual digit boxes for OTP entry.
 * Handles backspace, paste, and auto-advance focus between cells.
 */
import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { Colors, Radius, FontFamily } from '../../constants';

const OTP_LENGTH = 6;

interface OtpInputProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}

export function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const [focused, setFocused] = useState(-1);

  const digits = value.split('').concat(Array(OTP_LENGTH).fill('')).slice(0, OTP_LENGTH);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const next = digits.map((d, i) => (i === index ? digit : d));
    onChange(next.join(''));

    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => { inputs.current[index] = ref; }}
          value={digit}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => setFocused(index)}
          onBlur={() => setFocused(-1)}
          style={[
            styles.cell,
            focused === index && styles.cellFocused,
            digit ? styles.cellFilled : null,
          ]}
          keyboardType="number-pad"
          maxLength={1}
          textAlign="center"
          editable={!disabled}
          accessibilityLabel={`الرقم ${index + 1} من 6`}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse', // RTL: first cell on the right
    gap: 8,
    justifyContent: 'center',
  },
  cell: {
    width: 48,
    height: 56,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    backgroundColor: '#f9fafb',
    fontSize: 22,
    fontFamily: FontFamily.bold,
    color: Colors.inkPrimary,
    textAlign: 'center',
  },
  cellFocused: {
    borderColor: Colors.brandMid,
    borderWidth: 2,
    backgroundColor: Colors.surfaceCard,
  },
  cellFilled: {
    borderColor: Colors.brandDeep,
    backgroundColor: Colors.surfaceCard,
  },
});
