/**
 * الرئيسية — Dashboard screen
 *
 * Shows the month's profit, total revenue, total expenses, and count of
 * unpaid invoices ("لي عند"). All in Arabic market language.
 * Target: user sees their monthly profit in 10 seconds.
 */
import React from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { dashboardService } from '../../src/lib/services/dashboard.service';
import { Colors, Spacing, FontFamily, Radius, CardShadow } from '../../src/constants';
import {
  Text,
  StatCard,
} from '../../src/components/ui';
import { useAuthStore } from '../../src/store/auth.store';
import { formatSAR, formatDateNow } from '../../src/lib/format';

const formatAmount = (n: number) => formatSAR(n);
const getCurrentMonthLabel = () => formatDateNow({ month: 'long', year: 'numeric' });

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardService.summary(),
    select: (res) => res.data,
  });

  const profit = data?.profit ?? 0;
  const isProfitPositive = profit >= 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor="#fff"
          colors={[Colors.brandDeep]}
        />
      }
    >
      {/* ─── Colored header band ─── */}
      <View style={[styles.headerBand, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={styles.greeting}>
          {user?.businessName ? `مرحباً، ${user.businessName}` : 'الرئيسية'}
        </Text>
        <Text style={styles.monthLabel}>{getCurrentMonthLabel()}</Text>
      </View>

      {/* ─── Profit hero card — overlaps header ─── */}
      <View style={styles.heroWrapper}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>ربحي هذا الشهر</Text>
          <Text
            style={[
              styles.heroValue,
              { color: isProfitPositive ? Colors.success : Colors.danger },
            ]}
          >
            {isLoading ? '—' : formatAmount(profit)}
          </Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroPeriod}>{getCurrentMonthLabel()}</Text>
        </View>
      </View>

      {/* ─── Content area ─── */}
      <View style={styles.content}>
        {/* Stats grid */}
        <View style={styles.grid}>
          <StatCard
            label="إجمالي المبيعات"
            value={isLoading ? '—' : formatAmount(data?.totalRevenue ?? 0)}
            variant="brand"
          />
          <StatCard
            label="إجمالي المصاريف"
            value={isLoading ? '—' : formatAmount(data?.totalExpenses ?? 0)}
            variant="danger"
          />
        </View>

        {/* Unpaid invoices warning */}
        {(data?.unpaidInvoicesCount ?? 0) > 0 ? (
          <Pressable
            onPress={() => router.push('/(tabs)/invoices')}
            accessibilityRole="button"
            accessibilityLabel="عرض الفواتير غير المدفوعة"
          >
            <View style={styles.unpaidCard}>
              {/* Warning accent bar on right */}
              <View style={styles.unpaidAccent} />
              <View style={styles.unpaidInner}>
                <View style={styles.unpaidHeader}>
                  <Text style={styles.unpaidTitle}>لديك مبالغ معلقة</Text>
                  <View style={styles.unpaidCountChip}>
                    <Text style={styles.unpaidCountText}>
                      {data!.unpaidInvoicesCount}
                    </Text>
                  </View>
                </View>
                <Text style={styles.unpaidAmount}>
                  {formatAmount(data!.unpaidInvoicesTotal)}
                </Text>
                <Text style={styles.unpaidCta}>اضغط لعرض الفواتير ←</Text>
              </View>
            </View>
          </Pressable>
        ) : null}

        {/* Error notice */}
        {isError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>
              تعذّر تحميل البيانات — اسحب للأسفل للمحاولة مجددًا
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.surfaceApp,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  /* Header band */
  headerBand: {
    backgroundColor: Colors.brandDeep,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 56, // extra space for hero card overlap
    gap: 4,
    alignItems: 'flex-end',
  },
  greeting: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: '#ffffff',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  monthLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* Hero profit card */
  heroWrapper: {
    paddingHorizontal: Spacing.md,
    marginTop: -44, // pulls card up to overlap header
  },
  heroCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius['2xl'],
    padding: Spacing.lg,
    alignItems: 'flex-end',
    ...CardShadow,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
  },
  heroLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: Colors.inkSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginBottom: 6,
  },
  heroValue: {
    fontFamily: FontFamily.extraBold,
    fontSize: 44,
    lineHeight: 52,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroDivider: {
    height: 1,
    backgroundColor: Colors.borderSubtle,
    alignSelf: 'stretch',
    marginVertical: Spacing.sm,
  },
  heroPeriod: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.inkTertiary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },

  /* Main content */
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },

  /* Stats */
  grid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },

  /* Unpaid card */
  unpaidCard: {
    backgroundColor: Colors.warningWash,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.warning,
    overflow: 'hidden',
    flexDirection: 'row',
    ...CardShadow,
  },
  unpaidAccent: {
    width: 4,
    backgroundColor: Colors.warning,
    borderTopRightRadius: Radius['2xl'],
    borderBottomRightRadius: Radius['2xl'],
  },
  unpaidInner: {
    flex: 1,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'flex-end',
  },
  unpaidHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  unpaidTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    color: Colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  unpaidCountChip: {
    backgroundColor: Colors.warning,
    borderRadius: Radius.full,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unpaidCountText: {
    fontFamily: FontFamily.bold,
    fontSize: 12,
    color: '#fff',
  },
  unpaidAmount: {
    fontFamily: FontFamily.extraBold,
    fontSize: 22,
    color: Colors.inkPrimary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  unpaidCta: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: Colors.warning,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 2,
  },

  /* Error */
  errorCard: {
    backgroundColor: Colors.dangerWash,
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.danger,
    padding: Spacing.md,
    alignItems: 'flex-end',
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.danger,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
