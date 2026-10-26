// Strawberry matcha design tokens. Same names and values as the Figma variables.
export const colors = {
  gradientTop: '#EEF3E2', // matcha cream
  gradientMid: '#FFF8F5', // cream
  gradientBottom: '#FBD0D4', // strawberry milk
  header: '#FFF0F1',
  card: '#FFF8F5',
  white: '#FFFFFF',
  green: '#E6EFD8',
  strawberry: '#E8506A', // icons, selected states (not for small text)
  strawberrySoft: '#F7B8C2',
  strawberryStrong: '#B8324B', // primary buttons, links (5.8:1 with white)
  matcha: '#6E8F4E',
  matchaSoft: '#DCE8C9',
  matchaStrong: '#3F5A2C', // text on matcha surfaces (6:1)
  text: '#3A2A2C',
  textSecondary: '#6B5B5D',
  onAccent: '#FFFFFF',
  border: '#F3D9DC',
  success: '#3F6B2E',
  successSurface: '#E6EFD8',
  warning: '#8A6500',
  warningSurface: '#FFF6DD',
  error: '#B8324B',
  errorSurface: '#FDECEE',
  disabled: '#D9D9D9',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, button: 12, card: 16, pill: 999 } as const;

/** Quicksand (loaded in public/index.html) matches the Figma design; falls back to the system font. */
export const FONT = "Quicksand, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export const type = {
  brand: { fontSize: 36, fontFamily: FONT, fontWeight: '700' as const, letterSpacing: 0.5 },
  welcome: { fontSize: 28, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 36 },
  screenTitle: { fontSize: 20, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 28 },
  section: { fontSize: 18, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 24 },
  cardTitle: { fontSize: 16, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 22 },
  body: { fontSize: 14, fontFamily: FONT, fontWeight: '500' as const, lineHeight: 20 },
  label: { fontSize: 14, fontFamily: FONT, fontWeight: '600' as const, lineHeight: 20 },
  button: { fontSize: 15, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontFamily: FONT, fontWeight: '500' as const, lineHeight: 16 },
  captionStrong: { fontSize: 12, fontFamily: FONT, fontWeight: '700' as const, lineHeight: 16 },
} as const;

/** Minimum touch target on both platforms. */
export const TOUCH = 48;
