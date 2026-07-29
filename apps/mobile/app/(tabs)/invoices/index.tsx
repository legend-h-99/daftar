/**
 * الفواتير — Invoices list screen
 *
 * Lists all invoices with status badge, customer name, total, and date.
 * Filter tabs: الكل | غير مدفوعة | مدفوعة | جزئي
 *
 * Row layout (RTL):
 *   Right: customer name (bold) + badge below
 *   Left:  amount (large, brandDeep) + date below
 */
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  invoicesService,
  InvoiceStatus,
  Invoice,
} from '../../../src/lib/services/invoices.service';
import { Colors, Spacing, Radius, FontFamily } from '../../../src/constants';
import {
  Text,
  Badge,
  EmptyState,
} from '../../../src/components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatSAR, formatDate } from '../../../src/lib/format';

type FilterTab = 'ALL' | InvoiceStatus;

const TABS: Array<{ key: FilterTab; label: string }> = [
  { key: 'ALL', label: 'الكل' },
  { key: 'UNPAID', label: 'غير مدفوعة' },
  { key: 'PAID', label: 'مدفوعة' },
  { key: 'PARTIAL', label: 'جزئي' },
];

const formatAmount = (n: number) => formatSAR(n);

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  const statusMap: Record<InvoiceStatus, 'paid' | 'unpaid' | 'partial'> = {
    PAID: 'paid',
    UNPAID: 'unpaid',
    PARTIAL: 'partial',
  };

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/invoices/${invoice.id}` as never)}
      accessibilityRole="button"
      accessibilityLabel={`فاتورة ${invoice.customerName} بقيمة ${formatAmount(invoice.total)}`}
    >
      {({ pressed }) => (
        <View style={[styles.row, pressed && styles.rowPressed]}>
          {/* Right block: customer + badge */}
          <View style={styles.rowRight}>
            <Text variant="headline" style={styles.customerName}>
              {invoice.customerName}
            </Text>
            <Badge variant={statusMap[invoice.status]} />
          </View>

          {/* Left block: amount + date */}
          <View style={styles.rowLeft}>
            <Text style={styles.rowAmount}>{formatAmount(invoice.total)}</Text>
            <Text variant="label" color="inkTertiary" style={styles.rowDate}>
              {formatDate(invoice.createdAt)}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function InvoicesScreen() {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<FilterTab>('ALL');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['invoices', filter],
    queryFn: () =>
      invoicesService.list(
        filter === 'ALL' ? {} : { status: filter as InvoiceStatus },
      ),
    select: (res) => res.data.data,
  });

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      {/* Screen title */}
      <View style={styles.titleBar}>
        <Text variant="title">الفواتير</Text>
      </View>

      {/* Filter tabs */}
      <View style={styles.tabsScroll}>
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <Pressable
              key={tab.key}
              onPress={() => setFilter(tab.key)}
              style={[styles.tab, filter === tab.key && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === tab.key }}
            >
              <Text
                variant="label"
                style={[
                  styles.tabLabel,
                  filter === tab.key && styles.tabLabelActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* List */}
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <InvoiceRow invoice={item} />}
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
              icon={<Feather name="file-text" size={28} color={Colors.brandDeep} />}
              title="لا توجد فواتير"
              subtitle="ابدأ بإضافة أول فاتورة"
              actionLabel="+ فاتورة جديدة"
              onAction={() => router.push('/(tabs)/invoices/new' as never)}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fabBtn, { bottom: 96 + insets.bottom }]}
        onPress={() => router.push('/(tabs)/invoices/new' as never)}
        accessibilityRole="button"
        accessibilityLabel="فاتورة جديدة"
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
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
    backgroundColor: Colors.surfaceApp,
  },

  tabsScroll: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  tabs: {
    flexDirection: 'row-reverse',
    gap: Spacing.xs,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    minHeight: 36,
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: Colors.brandDeep,
    borderColor: Colors.brandDeep,
  },
  tabLabel: {
    color: Colors.inkSecondary,
    fontFamily: FontFamily.medium,
  },
  tabLabelActive: {
    color: '#fff',
  },

  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 140,
  },

  /* Invoice row */
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
  },
  rowPressed: {
    opacity: 0.85,
    backgroundColor: Colors.brandWash,
  },
  rowRight: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 6,
  },
  customerName: {
    textAlign: 'right',
    color: Colors.inkPrimary,
  },
  rowLeft: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rowAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: 18,
    color: Colors.brandDeep,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  rowDate: {
    textAlign: 'right',
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },

  separator: { height: Spacing.sm },
  loading: { textAlign: 'center', marginTop: Spacing.xl },
  emptyIcon: { fontSize: 24 },

  /* FAB */
  fabBtn: {
    position: 'absolute',
    left: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: Radius.full,
    backgroundColor: Colors.brandDeep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontFamily: FontFamily.bold,
    lineHeight: 32,
  },
});
