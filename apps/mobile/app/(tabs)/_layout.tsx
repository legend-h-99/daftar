import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Colors, FontFamily } from '../../src/constants';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.brandDeep,
        tabBarInactiveTintColor: Colors.inkTertiary,
        tabBarLabelStyle: {
          fontFamily: FontFamily.medium,
          fontSize: 11,
        },
        tabBarStyle: {
          backgroundColor: 'rgba(255,255,255,0.95)',
          borderTopWidth: 1,
          borderTopColor: Colors.borderMedium,
          paddingBottom: insets.bottom,
          height: 64 + insets.bottom,
          ...(Platform.OS === 'ios' && { backdropBlur: 20 }),
        },
        tabBarIconStyle: { marginTop: 4 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: 'الفواتير',
          tabBarIcon: ({ color }) => <Feather name="file-text" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="customers"
        options={{
          title: 'الزباين',
          tabBarIcon: ({ color }) => <Feather name="users" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'المصاريف',
          tabBarIcon: ({ color }) => <Feather name="trending-down" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'المزيد',
          tabBarIcon: ({ color }) => <Feather name="more-horizontal" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
