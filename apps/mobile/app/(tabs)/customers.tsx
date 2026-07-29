/**
 * الزباين — Customers screen ("لي عند")
 *
 * Shows each customer with avatar, name, phone, and total outstanding debt.
 * Debt amount is the most prominent element — styled box on the left side (RTL).
 * Sorted by debt descending so the biggest owed amount is first.
 */
import React from 'react';
import { Feather } from '@expo/vector-icons';
import {
  View,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { customersService, Customer } from '../../src/lib/services/customers.service';
import { Colors, Spacing, Radius, FontFamily } from '../../src/constants';
import { Text, EmptyState } from '../../src/components/ui';
import { formatSAR } from '../../src/lib/format';

function CustomerRow({ customer }: { customer: Customer }) {
  const hasDebt = (customer.totalDebt ?? 0) > 0;

  return (
    <View style={styles.row}>
      {/* Avatar — far right in RTL */}
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {customer.name.charAt(0)}
        </Text>
      </View>

      {/* Info — center */}
      <View style={styles.info}>
        <Text variant="headline" style={styles.name}>{customer.name}</Text>
        {customer.phone ? (
          <Text variant="label" color="inkTertiary" style={styles.phone}>
            {customer.phone}
          </Text>
        ) : null}
      </View>

      {/* Debt box — far left in RTL */}
      {hasDebt ? (
        <View style={styles.debtBox}>
          <Text style={styles.debtLabel}>لي عند</Text>
          <Text style={styles.debtAmount}>{formatSAR(customer.totalDebt)}</Text>
        </View>
      ) : (
        <View style={styles.settledBox}>
          <Feather name="check" size={18} color={Colors.success} />
          <Text style={styles.settledLabel}>مسوّى</Text>
        </View>
      )}
    </View>
  );
}

export default function CustomersScreen() {
  const insets = useSafeAreaInsets();

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.list(),
    select: (res) =>
      [...res.data].sort((a, b) => b.totalDebt - a.totalDebt),
  });

  const totalOwed = (data ?? []).reduce((acc, c) => acc + c.totalDebt, 0);

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.titleBar}>
        <Text variant="title">الزباين</Text>
        {totalOwed > 0 ? (
          <View style={styles.totalBadge}>
            <Text style={styles.totalLabel}>إجمالي لي عند </Text>
            <Text style={styles.totalAmount}>{formatSAR(totalOwed)}</Text>
          </View>
        ) : null}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CustomerRow customer={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onRefresh={refetch}
        refreshing={isRefetching}
        ListEmptyComponent={
          isLoading ? (
            <Text variant="body" color="inkSecondary" style={styles.loading}>
              جاري التحميل…
            </Text>
          ) : (
            <EmptyState
              icon={<Feather name="users" size={28} color={Colors.brandDeep} />}
              title="لا يوجد زباين بعد"
              subtitle="أضف أول زبون عند إنشاء الفاتورة"
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surfaceApp },

  titleBar: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignItems: 'flex-end',
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceApp,
  },

  totalBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.dangerWash,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  totalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  totalAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: 120,
  },

  /* Customer row */
  row: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    minHeight: 68,
  },

  avatar: {
    width: 46,
    height: 46,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandWash,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.brandLight,
  },
  avatarText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.brandDeep,
  },

  info: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  name: {
    textAlign: 'right',
    color: Colors.inkPrimary,
  },
  phone: {
    textAlign: 'right',
    fontFamily: FontFamily.regular,
  },

  /* Debt box */
  debtBox: {
    backgroundColor: Colors.dangerWash,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 80,
  },
  debtLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 10,
    color: Colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: 2,
  },
  debtAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  /* Settled box */
  settledBox: {
    backgroundColor: Colors.successWash,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 68,
    gap: 2,
  },
  settledText: {
    fontFamily: FontFamily.bold,
    fontSize: 14,
    color: Colors.success,
    textAlign: 'center',
  },
  settledLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.success,
    textAlign: 'center',
    writingDirection: 'rtl',
  },

  separator: { height: Spacing.sm },
  loading: { textAlign: 'center', marginTop: Spacing.xl },
  emptyIcon: { fontSize: 24 },
});
