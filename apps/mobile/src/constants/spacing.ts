export const Spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  full: 9999,
  '2xl': 16,
  xl: 12,
  lg: 8,
} as const;

/** Consistent shadow across all cards — shadow-sm equivalent */
export const CardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.05,
  shadowRadius: 2,
  elevation: 1,
};
