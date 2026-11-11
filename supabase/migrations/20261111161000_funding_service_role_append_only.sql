-- Supabase may grant default table privileges to service_role. Restrict the ledger explicitly.
REVOKE ALL ON public."FundingEntry" FROM service_role;
GRANT SELECT, INSERT ON public."FundingEntry" TO service_role;
