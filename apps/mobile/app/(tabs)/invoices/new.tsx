import React, { useState, useMemo, useCallback } from 'react';
import { Feather } from '@expo/vector-icons';
import {
  View,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  Switch,
  Alert,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Colors, Spacing, Radius, FontFamily, CardShadow } from '../../../src/constants';
import { Text, Button, Card, TextInput } from '../../../src/components/ui';
import { customersService, Customer } from '../../../src/lib/services/customers.service';
import { productsService, Product } from '../../../src/lib/services/products.service';
import { invoicesService } from '../../../src/lib/services/invoices.service';
import { formatSAR as _formatSAR } from '../../../src/lib/format';
const formatSAR = (n: number) => _formatSAR(n, 2);

interface LineItem {
  key: string;
  productId: string;
  name: string;
  unitPrice: number;
  quantity: string;
}

const VAT_RATE = 0.15;

export default function NewInvoiceScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [notes, setNotes] = useState('');

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.list().then((r) => r.data),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => productsService.list().then((r) => r.data),
  });

  const filteredCustomers = useMemo(
    () =>
      customerSearch.trim()
        ? customers.filter(
            (c) =>
              c.name.includes(customerSearch) ||
              (c.phone ?? '').includes(customerSearch),
          )
        : customers,
    [customers, customerSearch],
  );

  const filteredProducts = useMemo(
    () =>
      productSearch.trim()
        ? products.filter((p) => p.name.includes(productSearch))
        : products,
    [products, productSearch],
  );

  const subtotal = useMemo(
    () =>
      lineItems.reduce((sum, item) => {
        const qty = parseFloat(item.quantity) || 0;
        return sum + qty * item.unitPrice;
      }, 0),
    [lineItems],
  );

  const vatAmount = vatEnabled ? subtotal * VAT_RATE : 0;
  const grandTotal = subtotal + vatAmount;

  const addProduct = useCallback((product: Product) => {
    setLineItems((prev) => [
      ...prev,
      {
        key: `${product.id}-${Date.now()}`,
        productId: product.id,
        name: product.name,
        unitPrice: product.sellingPrice,
        quantity: '1',
      },
    ]);
    setProductModalOpen(false);
    setProductSearch('');
  }, []);

  const updateQty = useCallback((key: string, qty: string) => {
    setLineItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, quantity: qty } : item)),
    );
  }, []);

  const updatePrice = useCallback((key: string, price: string) => {
    const parsed = parseFloat(price);
    if (!isNaN(parsed) && parsed >= 0) {
      setLineItems((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, unitPrice: parsed } : item,
        ),
      );
    }
  }, []);

  const removeItem = useCallback((key: string) => {
    setLineItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const createMutation = useMutation({
    mutationFn: () =>
      invoicesService.create({
        customerId: selectedCustomer?.id ?? '',
        items: lineItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: parseFloat(item.quantity) || 1,
          unitPrice: item.unitPrice,
        })),
        notes: notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] });
      router.back();
    },
    onError: () => {
      Alert.alert('خطأ', 'تعذّر حفظ الفاتورة، حاول مرة أخرى');
    },
  });

  const canSubmit =
    selectedCustomer !== null &&
    lineItems.length > 0 &&
    lineItems.every((item) => parseFloat(item.quantity) > 0);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text variant="body" color="brandDeep">رجوع</Text>
        </Pressable>
        <Text variant="title" style={styles.headerTitle}>فاتورة جديدة</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Customer picker */}
        <Text variant="label" color="inkSecondary" style={styles.sectionLabel}>الزبون</Text>
        <Pressable
          onPress={() => setCustomerModalOpen(true)}
          style={({ pressed }) => [styles.pickerBtn, pressed && styles.pickerBtnPressed]}
          accessibilityRole="button"
        >
          {selectedCustomer ? (
            <View style={styles.pickerContent}>
              <Text variant="body" color="inkSecondary">{selectedCustomer.phone ?? ''}</Text>
              <Text variant="body">{selectedCustomer.name}</Text>
            </View>
          ) : (
            <Text variant="body" color="inkTertiary" style={styles.pickerPlaceholder}>
              اختر زبوناً...
            </Text>
          )}
        </Pressable>

        {/* Product lines */}
        <View style={styles.sectionRow}>
          <Pressable
            onPress={() => setProductModalOpen(true)}
            style={({ pressed }) => [styles.addProductBtn, pressed && styles.addProductBtnPressed]}
            accessibilityRole="button"
          >
            <Text variant="label" color="brandDeep">+ إضافة منتج</Text>
          </Pressable>
          <Text variant="label" color="inkSecondary" style={styles.sectionLabel}>المنتجات</Text>
        </View>

        {lineItems.length === 0 ? (
          <Card style={styles.emptyItems}>
            <Text variant="body" color="inkTertiary" style={{ textAlign: 'center' }}>
              لم تُضَف منتجات بعد
            </Text>
          </Card>
        ) : null}

        {lineItems.map((item) => {
          const qty = parseFloat(item.quantity) || 0;
          const lineTotal = qty * item.unitPrice;
          return (
            <Card key={item.key} style={styles.lineCard}>
              <View style={styles.lineHeader}>
                <Pressable
                  onPress={() => removeItem(item.key)}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel="حذف السطر"
                >
                  <Feather name="x" size={16} color={Colors.danger} />
                </Pressable>
                <Text variant="body" style={styles.lineName}>{item.name}</Text>
              </View>
              <View style={styles.lineInputRow}>
                <View style={styles.lineInputGroup}>
                  <Text variant="label" color="inkSecondary" style={styles.lineInputLabel}>
                    الإجمالي
                  </Text>
                  <Text variant="headline" style={styles.lineTotal}>
                    {formatSAR(lineTotal)}
                  </Text>
                </View>
                <View style={styles.lineInputGroup}>
                  <Text variant="label" color="inkSecondary" style={styles.lineInputLabel}>
                    السعر
                  </Text>
                  <RNTextInput
                    style={styles.lineInput}
                    value={String(item.unitPrice)}
                    onChangeText={(v) => updatePrice(item.key, v)}
                    keyboardType="decimal-pad"
                    textAlign="center"
                    placeholderTextColor={Colors.inkTertiary}
                    accessibilityLabel="سعر الوحدة"
                  />
                </View>
                <View style={styles.lineInputGroup}>
                  <Text variant="label" color="inkSecondary" style={styles.lineInputLabel}>
                    الكمية
                  </Text>
                  <RNTextInput
                    style={styles.lineInput}
                    value={item.quantity}
                    onChangeText={(v) => updateQty(item.key, v)}
                    keyboardType="decimal-pad"
                    textAlign="center"
                    placeholderTextColor={Colors.inkTertiary}
                    accessibilityLabel="الكمية"
                  />
                </View>
              </View>
            </Card>
          );
        })}

        {/* Notes */}
        <Text variant="label" color="inkSecondary" style={[styles.sectionLabel, { marginTop: Spacing.md }]}>
          ملاحظات (اختياري)
        </Text>
        <TextInput
          placeholder="أي تفاصيل إضافية للزبون..."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          style={styles.notesInput}
        />

        {/* Totals card */}
        <Card style={styles.totalsCard}>
          <View style={styles.totalRow}>
            <Text variant="body">{formatSAR(subtotal)}</Text>
            <Text variant="body" color="inkSecondary">المجموع الفرعي</Text>
          </View>

          <View style={styles.vatRow}>
            <Switch
              value={vatEnabled}
              onValueChange={setVatEnabled}
              trackColor={{ false: Colors.borderMedium, true: Colors.brandMid }}
              thumbColor={vatEnabled ? Colors.brandDeep : Colors.inkTertiary}
              accessibilityLabel="تفعيل ضريبة القيمة المضافة"
            />
            <Text variant="body" color="inkSecondary">ضريبة القيمة المضافة 15%</Text>
          </View>

          {vatEnabled ? (
            <View style={styles.totalRow}>
              <Text variant="body" color="inkSecondary">{formatSAR(vatAmount)}</Text>
              <Text variant="body" color="inkSecondary">الضريبة</Text>
            </View>
          ) : null}

          <View style={[styles.totalRow, styles.grandTotalRow]}>
            <Text variant="headline" style={{ color: Colors.brandDeep }}>{formatSAR(grandTotal)}</Text>
            <Text variant="headline">الإجمالي</Text>
          </View>
        </Card>
      </ScrollView>

      {/* Submit button — fixed at bottom */}
      <View style={[styles.submitBar, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <Button
          title={createMutation.isPending ? 'جارٍ الحفظ...' : 'حفظ الفاتورة'}
          onPress={() => createMutation.mutate()}
          disabled={!canSubmit || createMutation.isPending}
          loading={createMutation.isPending}
        />
      </View>

      {/* Customer picker modal */}
      <Modal
        visible={customerModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCustomerModalOpen(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setCustomerModalOpen(false)} style={styles.modalCloseBtn}>
              <Text variant="body" color="brandDeep">إغلاق</Text>
            </Pressable>
            <Text variant="title" style={styles.modalTitle}>اختر زبوناً</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.searchWrapper}>
            <RNTextInput
              style={styles.searchInput}
              placeholder="بحث بالاسم أو الجوال..."
              placeholderTextColor={Colors.inkTertiary}
              value={customerSearch}
              onChangeText={setCustomerSearch}
              textAlign="right"
              autoFocus
            />
          </View>

          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setSelectedCustomer(item);
                  setCustomerModalOpen(false);
                  setCustomerSearch('');
                }}
                style={({ pressed }) => [styles.modalItem, pressed && styles.modalItemPressed]}
                accessibilityRole="button"
              >
                <Text variant="body" color="inkSecondary">{item.phone ?? ''}</Text>
                <Text variant="body">{item.name}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text variant="body" color="inkTertiary" style={styles.emptyModal}>
                لا يوجد زباين
              </Text>
            }
          />
        </View>
      </Modal>

      {/* Product picker modal */}
      <Modal
        visible={productModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProductModalOpen(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top + Spacing.sm }]}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setProductModalOpen(false)} style={styles.modalCloseBtn}>
              <Text variant="body" color="brandDeep">إغلاق</Text>
            </Pressable>
            <Text variant="title" style={styles.modalTitle}>اختر منتجاً</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.searchWrapper}>
            <RNTextInput
              style={styles.searchInput}
              placeholder="بحث في المنتجات..."
              placeholderTextColor={Colors.inkTertiary}
              value={productSearch}
              onChangeText={setProductSearch}
              textAlign="right"
              autoFocus
            />
          </View>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => addProduct(item)}
                style={({ pressed }) => [styles.modalItem, pressed && styles.modalItemPressed]}
                accessibilityRole="button"
              >
                <Text variant="body" color="brandDeep">
                  {formatSAR(item.sellingPrice)}
                </Text>
                <Text variant="body">{item.name}</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <Text variant="body" color="inkTertiary" style={styles.emptyModal}>
                لا توجد منتجات
              </Text>
            }
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.surfaceApp },

  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surfaceApp,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  headerTitle: { flex: 1, textAlign: 'center' },
  headerSpacer: { width: 48 },
  backBtn: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },

  scrollContent: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },

  sectionLabel: {
    textAlign: 'right',
    marginBottom: 4,
  },
  sectionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: 4,
  },

  pickerBtn: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius['2xl'],
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
    justifyContent: 'center',
  },
  pickerBtnPressed: { backgroundColor: Colors.surfaceApp },
  pickerContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerPlaceholder: { textAlign: 'right' },

  addProductBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.brandDeep,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addProductBtnPressed: { backgroundColor: Colors.brandWash },

  emptyItems: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },

  lineCard: {
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  lineHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineName: { flex: 1, textAlign: 'right' },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dangerWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 12,
    color: Colors.danger,
    fontFamily: FontFamily.bold,
  },
  lineInputRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.xs,
  },
  lineInputGroup: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  lineInputLabel: { textAlign: 'center' },
  lineInput: {
    backgroundColor: Colors.surfaceApp,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius.lg,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.inkPrimary,
    width: '100%',
    minHeight: 48,
    textAlign: 'center',
  },
  lineTotal: { color: Colors.inkPrimary, textAlign: 'center' },

  notesInput: {
    textAlignVertical: 'top',
    minHeight: 80,
    paddingTop: 14,
  },

  totalsCard: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  totalRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vatRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  grandTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingTop: Spacing.sm,
    marginTop: 4,
  },

  submitBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceApp,
    borderTopWidth: 1,
    borderTopColor: Colors.borderSubtle,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    ...CardShadow,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.surfaceApp,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  modalTitle: { flex: 1, textAlign: 'center' },
  modalCloseBtn: {
    minHeight: 48,
    minWidth: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  searchWrapper: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSubtle,
  },
  searchInput: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1,
    borderColor: Colors.borderMedium,
    borderRadius: Radius['2xl'],
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.inkPrimary,
    minHeight: 48,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  modalList: { padding: Spacing.md, gap: 0 },
  modalItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 56,
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.xl,
  },
  modalItemPressed: { backgroundColor: Colors.brandWash },
  separator: { height: 4 },
  emptyModal: { textAlign: 'center', marginTop: Spacing.xl },
});
