"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Business, User } from "./types";

export interface BusinessContextValue {
  user: User | null;
  business: Business | null;
  refresh: () => Promise<void>;
}

export const BusinessContext = createContext<BusinessContextValue>({
  user: null,
  business: null,
  refresh: async () => {},
});

const Provider = BusinessContext.Provider as any;

export function BusinessProvider({
  value,
  children,
}: {
  value: BusinessContextValue;
  children: ReactNode;
}) {
  return (
    <Provider value={value}>
      {children}
    </Provider>
  );
}

export function useBusiness() {
  return useContext(BusinessContext);
}
