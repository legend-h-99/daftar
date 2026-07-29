/**
 * دفتر Typography Tokens
 * Font: Tajawal (Arabic-optimised, loaded via @expo-google-fonts/tajawal)
 * Matches DESIGN.md hierarchy exactly.
 */
export const FontFamily = {
  regular: 'Tajawal_400Regular',
  medium: 'Tajawal_500Medium',
  // Tajawal has no 600 — use 700 as semiBold equivalent
  semiBold: 'Tajawal_700Bold',
  bold: 'Tajawal_700Bold',
  extraBold: 'Tajawal_800ExtraBold',
} as const;

export const TextStyle = {
  /** Login screen hero — use sparingly */
  display: {
    fontFamily: FontFamily.extraBold,
    fontSize: 24,
    lineHeight: 32,
  },
  /** Main screen title (الرئيسية، الفواتير…) */
  title: {
    fontFamily: FontFamily.extraBold,
    fontSize: 20,
    lineHeight: 28,
  },
  /** Section headings, StatCard values */
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 24,
  },
  /** List content, descriptions */
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  /** Badges, small labels */
  label: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    lineHeight: 18,
  },
} as const;
