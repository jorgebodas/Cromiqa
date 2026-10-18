import { describe, expect, it } from 'vitest';
import { byZone, countSince, matches, perDay, toCsv } from './lib';

describe('admin lib', () => {
  it('builds Excel-friendly, injection-safe CSV', () => {
    const csv = toCsv(
      [{ email: 'a@b.com', zone: 'Rivas, Madrid', note: 'dice "hola"' }, { email: '=HYPERLINK("x")', zone: null, note: '' }],
      [
        { key: 'email', label: 'Email' },
        { key: 'zone', label: 'Zona' },
        { key: 'note', label: 'Nota' },
      ],
    );
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Email,Zona,Nota');
    expect(lines[1]).toBe('a@b.com,"Rivas, Madrid","dice ""hola"""');
    expect(lines[2]).toBe(`"'=HYPERLINK(""x"")",,`);
  });

  it('zero-fills registrations per day', () => {
    const now = new Date('2026-10-18T10:00:00');
    const series = perDay([{ created_at: '2026-10-18T09:00:00' }, { created_at: '2026-10-18T08:00:00' }, { created_at: '2026-10-16T20:00:00' }], 3, now);
    expect(series).toEqual([
      { day: '2026-10-16', count: 1 },
      { day: '2026-10-17', count: 0 },
      { day: '2026-10-18', count: 2 },
    ]);
  });

  it('groups by zone and counts recent items', () => {
    expect(byZone([{ zone: 'Rivas' }, { zone: null }, { zone: 'Rivas' }, { zone: ' ' }])).toEqual([
      { zone: 'Rivas', count: 2 },
      { zone: 'Sin indicar', count: 2 },
    ]);
    const now = new Date('2026-10-18T10:00:00Z');
    expect(countSince([{ created_at: '2026-10-17T10:00:00Z' }, { created_at: '2026-10-01T10:00:00Z' }], 7, now)).toBe(1);
    expect(matches('ros', 'Rosa Gil', null)).toBe(true);
    expect(matches('xyz', 'Rosa Gil')).toBe(false);
  });
});
