/**
 * ScreenContainer — standard scrollable screen wrapper.
 * Applies surfaceApp background, safe-area padding, and bottom nav clearance.
 */
import React from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  ViewStyle,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing } from '../../constants';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}

export function ScreenContainer({
  children,
  style,
  scrollable = true,
  refreshing,
  onRefresh,
}: ScreenContainerProps) {
  const insets = useSafeAreaInsets();

  const contentStyle: ViewStyle = {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    // Bottom nav is ~80px + safe area — ensure nothing is hidden
    paddingBottom: 96 + insets.bottom,
  };

  if (!scrollable) {
    return (
      <View style={[styles.base, { paddingTop: insets.top }, style]}>
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.base}
      contentContainerStyle={[contentStyle, style]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={onRefresh}
            tintColor={Colors.brandDeep}
            colors={[Colors.brandDeep]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: Colors.surfaceApp,
  },
});
