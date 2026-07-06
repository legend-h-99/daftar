"use client";

import { createContext, useContext } from "react";
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

export function useBusiness() {
  return useContext(BusinessContext);
}
