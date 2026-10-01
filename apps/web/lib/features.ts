/**
 * Features whose backend is not live yet. Their entry points stay hidden
 * until the API supports them, so users never hit a dead end.
 */

/** Scanning a supplier invoice — the API answers POST /purchases/scan with 501. */
export const SCAN_ENABLED = process.env.NEXT_PUBLIC_SCAN_ENABLED === "true";
