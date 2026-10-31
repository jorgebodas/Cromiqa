import { describe, expect, it } from 'vitest';
import { availableModes, canSwitchMode, modeOfPath, resolveMode } from './modes';

describe('account modes', () => {
  it('offers mechanic mode only to accounts with a professional profile', () => {
    expect(availableModes({})).toEqual(['cyclist']);
    expect(availableModes({ mechanicId: 'm-1' })).toEqual(['cyclist', 'mechanic']);
    expect(availableModes(null)).toEqual(['cyclist']);
    expect(canSwitchMode({})).toBe(false);
    expect(canSwitchMode({ mechanicId: 'm-1' })).toBe(true);
  });

  it('keeps the last used mode when still available', () => {
    expect(resolveMode({ mechanicId: 'm-1' }, 'cyclist')).toBe('cyclist');
    expect(resolveMode({ mechanicId: 'm-1' }, 'mechanic')).toBe('mechanic');
  });

  it('never lands a cyclist-only account in mechanic mode', () => {
    expect(resolveMode({}, 'mechanic')).toBe('cyclist');
    expect(resolveMode(null, 'mechanic')).toBe('cyclist');
  });

  it('defaults professionals to mechanic mode and everyone else to cyclist', () => {
    expect(resolveMode({ mechanicId: 'm-1' })).toBe('mechanic');
    expect(resolveMode({})).toBe('cyclist');
  });

  it('maps paths to their mode', () => {
    expect(modeOfPath('/')).toBe('cyclist');
    expect(modeOfPath('/solicitudes/r-1')).toBe('cyclist');
    expect(modeOfPath('/pro/trabajos')).toBe('mechanic');
    expect(modeOfPath('/cuenta')).toBeNull();
    expect(modeOfPath('/profesional')).toBeNull();
  });
});
