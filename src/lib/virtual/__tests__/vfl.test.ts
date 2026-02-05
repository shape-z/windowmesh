import { describe, it, expect } from 'vitest';
import { normalizeLayout, assignScreenForWindow } from '@/lib/virtual/utils/vfl';
import type { Rect, VflScreen } from '@/lib/virtual/types/types';

describe('VFL Core Logic (vfl.ts)', () => {

  describe('normalizeLayout', () => {
    it('sets v=1 if missing', () => {
      // Provide at least one screen to satisfy Zod schema
      const input: any = { 
        screens: [{ id: 'S1', x: 0, y: 0, w: 100, h: 100 }] 
      };
      const out = normalizeLayout(input);
      expect(out.v).toBe(1);
    });

    it('calculates bounding frame from screens automatically', () => {
      const input: any = {
        screens: [
          { id: 'S1', x: 0, y: 0, w: 1000, h: 1000 },
          { id: 'S2', x: 1000, y: 0, w: 1000, h: 1000 }
        ]
      };
      const out = normalizeLayout(input);
      expect(out.frame).toEqual({ x: 0, y: 0, w: 2000, h: 1000 });
    });
  });

  describe('assignScreenForWindow', () => {
    const screens: VflScreen[] = [
      { id: 'S1', x: 0, y: 0, w: 1920, h: 1080 },
      { id: 'S2', x: 1920, y: 0, w: 1920, h: 1080 },
    ];

    it('defaults to first screen if no overlap', () => {
      // Window way out in boonies
      const win: Rect = { x: 9999, y: 9999, w: 100, h: 100 };
      const { screenId } = assignScreenForWindow({ windowId: 'w', winRect: win, screens });
      expect(screenId).toBe('S1');
    });
  });
});
