/**
 * المصاريف — Expenses screen
 * List and quick-add expenses. Red semantic color for amounts.
 *
 * Row layout (RTL, row-reverse):
 *   Visual right: description + category + date
 *   Visual left:  amount chip (red, bold, prominent)
 */
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  View,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  expensesService,
  Expense,
} from '../../src/lib/services/expenses.service';
import { Colors, Spacing, Radius, FontFamily } from '../../src/constants';
import { Text, EmptyState, TextInput, Button } from '../../src/components/ui';
import { formatSAR, formatDate } from '../../src/lib/format';

function formatAmount(n: number) { return formatSAR(n); }

function ExpenseRow({ expense }: { expense: Expense }) {
  return (
    <View style={styles.row}>
      {/* Amount chip — visually on the left in RTL (flex-start in row-reverse) */}
      <View style={styles.amountChip}>
        <Text style={styles.amountText}>{formatAmount(expense.amount)}</Text>
      </View>

      {/* Description + category + date — fills remaining space */}
      <View style={styles.rowMid}>
        <Text variant="body" style={styles.desc}>{expense.description}</Text>
        <View style={styles.rowMeta}>
          {expense.category ? (
            <View style={styles.categoryChip}>
              <Text style={styles.categoryText}>{expense.category}</Text>
            </View>
          ) : null}
          <Text variant="label" color="inkTertiary" style={styles.date}>
            {formatDate(expense.createdAt)}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ExpensesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [formError, setFormError] = useState('');

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesService.list(),
    select: (res) => res.data,
  });

  const addMutation = useMutation({
    mutationFn: () =>
      expensesService.create({
        description: desc.trim(),
        amount: parseFloat(amount),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      setShowAdd(false);
      setDesc('');
      setAmount('');
      setFormError('');
    },
    onError: () => {
      setFormError('تعذّر الحفظ، تأكد من البيانات وحاول مرة أخرى');
    },
  });

  const handleAdd = () => {
    setFormError('');
    if (!desc.trim()) { setFormError('أدخل وصف المصروف'); return; }
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) { setFormError('أدخل مبلغًا صحيحًا'); return; }
    addMutation.mutate();
  };

  return (
    <View style={[styles.flex, { paddingTop: insets.top }]}>
      <View style={styles.titleBar}>
        <Text variant="title">المصاريف</Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ExpenseRow expense={item} />}
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
              icon={<Feather name="trending-down" size={28} color={Colors.brandDeep} />}
              title="لا مصاريف مسجّلة"
              subtitle="سجّل أول مصروف الآن"
              actionLabel="+ إضافة مصروف"
              onAction={() => setShowAdd(true)}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fabBtn, { bottom: 96 + insets.bottom }]}
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel="إضافة مصروف"
      >
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>

      {/* Add expense bottom sheet (modal) */}
      <Modal
        visible={showAdd}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAdd(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setShowAdd(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.sheet}
        >
          <View style={styles.sheetHandle} />
          <Text variant="title" style={styles.sheetTitle}>مصروف جديد</Text>

          <TextInput
            label="الوصف"
            placeholder="مثال: مواد خام، توصيل…"
            value={desc}
            onChangeText={setDesc}
          />
          <TextInput
            label="المبلغ (ريال)"
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
          />

          {formError ? (
            <Text variant="label" color="danger">{formError}</Text>
          ) : null}

          <Button
            title="حفظ المصروف"
            onPress={handleAdd}
            loading={addMutation.isPending}
          />
        </KeyboardAvoidingView>
      </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
    backgroundColor: Colors.surfaceApp,
  },

  listContent: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: 140 },

  /* Expense row */
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
    minHeight: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },

  rowMid: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  desc: {
    textAlign: 'right',
    fontFamily: FontFamily.medium,
    color: Colors.inkPrimary,
  },
  rowMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  categoryChip: {
    backgroundColor: Colors.borderSubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryText: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: Colors.inkSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  date: {
    textAlign: 'right',
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },

  /* Amount chip */
  amountChip: {
    backgroundColor: Colors.dangerWash,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    minWidth: 78,
  },
  amountText: {
    fontFamily: FontFamily.extraBold,
    fontSize: 14,
    color: Colors.danger,
    textAlign: 'center',
    writingDirection: 'rtl',
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
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
  },
  fabIcon: {
    color: '#fff',
    fontSize: 28,
    fontFamily: FontFamily.bold,
    lineHeight: 32,
  },

  /* Add expense modal */
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: Colors.surfaceCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderMedium,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: { textAlign: 'right' },
});
