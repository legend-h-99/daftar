/**
 * دفتر Design System — Color Tokens
 * Source of truth: /DESIGN.md
 */
export const Colors = {
  // Brand
  brandDeep: '#0f7353',   // brand-700 — primary action, active tab
  brandMid: '#1cb27c',    // brand-500 — focus ring
  brandLight: '#b0f1d2',  // brand-200 — text selection
  brandWash: '#eefdf6',   // brand-50  — icon chip background

  // Surface
  surfaceApp: '#f7f8f7',  // app background
  surfaceCard: '#ffffff', // cards, modals

  // Ink
  inkPrimary: '#101914',   // headings, primary numbers
  inkSecondary: '#6b7280', // labels, descriptions, dates
  inkTertiary: '#9ca3af',  // placeholder, inactive

  // Border
  borderSubtle: '#f3f4f6', // card borders
  borderMedium: '#e5e7eb', // input borders

  // Semantic
  danger: '#dc2626',
  dangerWash: '#fef2f2',
  warning: '#b45309',
  warningWash: '#fffbeb',
  success: '#15803d',
  successWash: '#dcfce7',
} as const;

export type ColorKey = keyof typeof Colors;
