export const PURCHASE_SUMMARY_QUERY = Symbol('PURCHASE_SUMMARY_QUERY');

export interface PurchaseBySupplier {
  name: string;
  count: number;
  total: number;
}

export interface PurchaseByMonth {
  month: string;
  count: number;
  total: number;
}

export interface PurchaseSummary {
  bySupplier: PurchaseBySupplier[];
  byMonth: PurchaseByMonth[];
}

export interface IPurchaseSummaryQuery {
  summary(businessId: string): Promise<PurchaseSummary>;
}
