import { useId, useState } from 'react';
import { cx } from '@/components/ui';

// Single-series marks use a dark brand lime validated for contrast on the panel surface
// (dataviz validator: lightness, chroma and 3:1 contrast all pass).
const SERIES = '#5f8a00';

const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(`${d}T12:00:00`).toLocaleDateString('es-ES', opts);

/** Daily bars with a recessive grid, sparse axis labels and a hover tooltip; "Ver tabla" for an accessible view. */
export function DailyBars({ title, data }: { title: string; data: { day: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const id = useId();
  const max = Math.max(1, ...data.map((d) => d.count));
  const niceMax = max <= 4 ? max : Math.ceil(max / 5) * 5;
  const W = 600, H = 160, padL = 28, padB = 22, padT = 8;
  const plotW = W - padL, plotH = H - padB - padT;
  const step = plotW / data.length;
  const barW = Math.max(2, step - 2); // 2px surface gap between bars
  const y = (v: number) => padT + plotH - (v / niceMax) * plotH;
  const ticks = niceMax <= 4 ? Array.from({ length: niceMax + 1 }, (_, i) => i) : [0, niceMax / 2, niceMax];
  const total = data.reduce((a, d) => a + d.count, 0);

  return (
    <figure className="rounded-2xl border border-line bg-paper p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={id} className="font-semibold">{title}</span>
        <span className="text-sm text-muted tabular-nums">{total} en {data.length} días</span>
      </figcaption>
      {table ? (
        <div className="mt-3 max-h-56 overflow-auto">
          <table className="w-full text-sm tabular-nums">
            <thead className="text-left text-muted"><tr><th scope="col" className="py-1 font-medium">Día</th><th scope="col" className="py-1 text-right font-medium">Registros</th></tr></thead>
            <tbody>
              {[...data].reverse().map((d) => (
                <tr key={d.day} className="border-t border-line"><td className="py-1">{fmtDay(d.day, { weekday: 'short', day: 'numeric', month: 'short' })}</td><td className="py-1 text-right">{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-labelledby={id} onMouseLeave={() => setHover(null)}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#E7E5DF" strokeWidth={1} />
                <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#737373">{t}</text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * step + 1;
              const h = Math.max(0, padT + plotH - y(d.count));
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)}>
                  {/* Hit target taller and wider than the mark */}
                  <rect x={padL + i * step} y={padT} width={step} height={plotH} fill="transparent" />
                  {d.count > 0 && (
                    <path
                      d={`M${x},${padT + plotH} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, barW / 2)},${-Math.min(4, h)} h${barW - 2 * Math.min(4, barW / 2)} q${Math.min(4, barW / 2)},0 ${Math.min(4, barW / 2)},${Math.min(4, h)} v${h - Math.min(4, h)} z`}
                      fill={SERIES}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                </g>
              );
            })}
            {data.map((d, i) =>
              (data.length - 1 - i) % 7 === 0 ? (  // weekly ticks anchored on today, never colliding
                <text key={d.day} x={padL + i * step + step / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#737373">{fmtDay(d.day)}</text>
              ) : null,
            )}
          </svg>
          {hover !== null && (
            <div
              role="status"
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-paper shadow-pop"
              style={{ left: `${((padL + hover * step + step / 2) / W) * 100}%` }}
            >
              {fmtDay(data[hover]!.day, { weekday: 'short', day: 'numeric', month: 'short' })} · <b className="tabular-nums">{data[hover]!.count}</b>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={() => setTable((t) => !t)} className="mt-3 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
        {table ? 'Ver gráfico' : 'Ver tabla'}
      </button>
    </figure>
  );
}

/** Horizontal bars, direct-labelled (few categories), sorted by value. */
export function ZoneBars({ title, data }: { title: string; data: { zone: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <figure className="rounded-2xl border border-line bg-paper p-5">
      <figcaption className="font-semibold">{title}</figcaption>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Sin datos todavía.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {data.map((d) => (
            <li key={d.zone} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm" title={`${d.zone}: ${d.count}`}>
              <span className="truncate text-muted">{d.zone}</span>
              <span className="h-3 rounded-r-[4px] bg-[#5f8a00]" style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }} />
              <span className="tabular-nums font-medium">{d.count}</span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

export function StatTile({ label, value, sub, className }: { label: string; value: number | string; sub?: string; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-line bg-paper p-4', className)}>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}
