// Provisional Cromiqa wordmark. Self-contained (no app UI dependencies) so it can be
// replaced by final logo assets later. Static SVG versions live in /public/brand.
import type { CSSProperties } from 'react';

const INK = '#171717';
const PAPER = '#FFFFFF';
const LIME = '#C7FF2F';

interface QMarkProps {
  color?: string;
  /** Colour of the check tail. Lime only on dark backgrounds (contrast). */
  tailColor?: string;
  /** Background colour used to cut the tail out of the ring. */
  knockout?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** The "Q" whose tail is a precision check mark — the QA in Cromiqa. */
export function QMark({ color = INK, tailColor, knockout = PAPER, className, style, title }: QMarkProps) {
  return (
    <svg
      viewBox="0 0 124 100"
      className={className}
      style={{ overflow: 'visible', ...style }}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <ellipse cx="52" cy="50" rx="44" ry="41.5" fill="none" stroke={color} strokeWidth="17" />
      <path d="M63 75 L77 89 L114 52" fill="none" stroke={knockout} strokeWidth="29" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M63 75 L77 89 L114 52" fill="none" stroke={tailColor ?? color} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

interface WordmarkProps {
  tone?: 'ink' | 'paper';
  className?: string;
  /** Show the lime check tail (only use on dark backgrounds). */
  accent?: boolean;
}

export function Wordmark({ tone = 'ink', className = '', accent = false }: WordmarkProps) {
  const color = tone === 'ink' ? INK : PAPER;
  const bg = tone === 'ink' ? PAPER : INK;
  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        fontFamily: "'Manrope Variable', 'Manrope', sans-serif",
        fontWeight: 800,
        letterSpacing: '0.02em',
        color,
        lineHeight: 1,
      }}
      aria-label="Cromiqa"
      role="img"
    >
      <span aria-hidden>CROMI</span>
      <QMark
        color={color}
        tailColor={accent ? LIME : color}
        knockout={bg}
        style={{ height: '0.76em', width: 'auto', margin: '0 0.005em 0 0.03em', transform: 'translateY(0.01em)' }}
      />
      <span aria-hidden>A</span>
    </span>
  );
}

/** Square app icon: ink tile, white Q, lime check. */
export function AppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill={INK} />
      <g transform="translate(11 15) scale(0.33)">
        <ellipse cx="52" cy="50" rx="44" ry="41.5" fill="none" stroke={PAPER} strokeWidth="17" />
        <path d="M63 75 L77 89 L114 52" fill="none" stroke={INK} strokeWidth="29" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M63 75 L77 89 L114 52" fill="none" stroke={LIME} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
