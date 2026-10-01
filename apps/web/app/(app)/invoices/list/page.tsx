import InvoicesPage from "../page";

/** Stable list route that avoids stale client-side caches for the legacy URL. */
export default function InvoiceListRoute() {
  return <InvoicesPage />;
}
