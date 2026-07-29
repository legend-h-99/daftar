/**
 * تفاصيل الفاتورة — Invoice detail screen (placeholder)
 * Shows invoice number, customer, items, total, and payment status.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { invoicesService } from '../../../src/lib/services/invoices.service';
import { Colors, Spacing } from '../../../src/constants';
import { Text, Card, Badge, Button, ScreenContainer } from '../../../src/components/ui';
import { formatSAR, formatDate } from '../../../src/lib/format';

function formatAmount(n: number) {
  return formatSAR(n, 2);
}

const STATUS_MAP = {
  PAID: 'paid',
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
} as const;

export default function InvoiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesService.get(id!),
    select: (res) => res.data,
    enabled: !!id,
  });

  return (
    <ScreenContainer>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Button
          title="رجوع"
          onPress={() => router.back()}
          style={styles.backBtn}
        />
        <Text variant="title">
          {invoice ? `فاتورة #${invoice.invoiceNumber}` : 'تفاصيل الفاتورة'}
        </Text>
      </View>

      {isLoading ? (
        <Text variant="body" color="inkSecondary" style={styles.loading}>
          جاري التحميل…
        </Text>
      ) : invoice ? (
        <>
          {/* Status + customer */}
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Badge variant={STATUS_MAP[invoice.status]} />
              <Text variant="headline">{invoice.customerName}</Text>
            </View>
            <Text variant="label" color="inkSecondary">
              {formatDate(invoice.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          </Card>

          {/* Items */}
          <Card style={styles.itemsCard}>
            <Text variant="headline" style={styles.sectionTitle}>المنتجات</Text>
            {invoice.items.map((item) => (
              <View key={item.id} style={styles.itemRow}>
                <Text variant="body" style={styles.itemTotal}>
                  {formatAmount(item.total)}
                </Text>
                <View style={styles.itemMeta}>
                  <Text variant="body">{item.productName}</Text>
                  <Text variant="label" color="inkSecondary">
                    {item.quantity} × {formatAmount(item.unitPrice)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Totals */}
          <Card>
            <View style={styles.totalRow}>
              <Text variant="headline">الإجمالي</Text>
              <Text variant="headline" style={styles.totalAmount}>
                {formatAmount(invoice.total)}
              </Text>
            </View>
            {invoice.status !== 'PAID' && (
              <View style={styles.totalRow}>
                <Text variant="body" color="danger">المتبقي</Text>
                <Text variant="body" color="danger">
                  {formatAmount(invoice.remainingAmount)}
                </Text>
              </View>
            )}
          </Card>
        </>
      ) : (
        <Text variant="body" color="inkSecondary" style={styles.loading}>
          الفاتورة غير موجودة
        </Text>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 40,
    backgroundColor: Colors.surfaceCard,
  },
  infoCard: { marginBottom: Spacing.sm, gap: Spacing.xs },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemsCard: { marginBottom: Spacing.sm, gap: Spacing.sm },
  sectionTitle: { textAlign: 'right', marginBottom: 4 },
  itemRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemMeta: { flex: 1, alignItems: 'flex-end', gap: 2 },
  itemTotal: { color: Colors.inkPrimary },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  totalAmount: { color: Colors.brandDeep },
  loading: { textAlign: 'center', marginTop: Spacing.xl },
});
