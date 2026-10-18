// Pure helpers for the admin panel (CSV export and metrics). Unit-tested in lib.test.ts.

/** RFC 4180 CSV with a BOM so Excel opens accents correctly; guards against formula injection. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const cell = (v: unknown) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))];
  return '﻿' + lines.join('\r\n');
}

export function downloadFile(name: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Registrations per local day for the last `days` days (oldest first), zero-filled. */
export function perDay(items: { created_at: string }[], days: number, now = new Date()): { day: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const k = dayKey(new Date(it.created_at));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - (days - 1 - i));
    const k = dayKey(d);
    return { day: k, count: counts.get(k) ?? 0 };
  });
}

/** Count per zone, largest first; empty zones grouped as "Sin indicar". */
export function byZone(items: { zone: string | null }[]): { zone: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    const z = it.zone?.trim() || 'Sin indicar';
    counts.set(z, (counts.get(z) ?? 0) + 1);
  }
  return [...counts.entries()].map(([zone, count]) => ({ zone, count })).sort((a, b) => b.count - a.count || a.zone.localeCompare(b.zone));
}

export function countSince(items: { created_at: string }[], days: number, now = new Date()) {
  const since = now.getTime() - days * 86_400_000;
  return items.filter((i) => new Date(i.created_at).getTime() >= since).length;
}

export function matches(text: string, ...fields: (string | null | undefined)[]) {
  const q = text.trim().toLowerCase();
  return !q || fields.some((f) => f?.toLowerCase().includes(q));
}
