// Brand tokens for use in TS (SVG fills, inline styles). Source of truth: styles/index.css @theme.
export const tokens = {
  color: {
    paper: '#FFFFFF',
    sand: '#F6F4EF',
    ink: '#171717',
    muted: '#737373',
    line: '#E7E5DF',
    lime: '#C7FF2F',
  },
  font: {
    display: "'Manrope Variable', sans-serif",
    sans: "'Inter Variable', sans-serif",
  },
} as const;
