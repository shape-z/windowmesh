import { describe, it, expect } from 'vitest';
import { generateSessionId, isValidRect } from '../engine/EngineSessionUtils';
import type { Rect } from '../types/types';

describe('sessionUtils', () => {
  describe('generateSessionId()', () => {
    it('returns "default" for empty string', async () => {
      const id = await generateSessionId('');
      expect(id).toBe('default');
    });

    it('generates consistent hash for same input', async () => {
      const id1 = await generateSessionId('test');
      const id2 = await generateSessionId('test');
      expect(id1).toBe(id2);
    });

    it('generates different hashes for different inputs', async () => {
      const id1 = await generateSessionId('test1');
      const id2 = await generateSessionId('test2');
      expect(id1).not.toBe(id2);
    });

    it('starts with "vwin:"', async () => {
      const id = await generateSessionId('test');
      expect(id.startsWith('vwin:')).toBe(true);
    });
  });

  describe('isValidRect()', () => {
    it('returns true for valid rect', () => {
      const rect: Rect = { x: 0, y: 0, w: 100, h: 100 };
      expect(isValidRect(rect)).toBe(true);
    });

    it('returns false for zero width', () => {
      const rect: Rect = { x: 0, y: 0, w: 0, h: 100 };
      expect(isValidRect(rect)).toBe(false);
    });

    it('returns false for zero height', () => {
      const rect: Rect = { x: 0, y: 0, w: 100, h: 0 };
      expect(isValidRect(rect)).toBe(false);
    });

    it('returns false for negative width', () => {
      const rect: Rect = { x: 0, y: 0, w: -10, h: 100 };
      expect(isValidRect(rect)).toBe(false);
    });

    it('returns false for negative height', () => {
      const rect: Rect = { x: 0, y: 0, w: 100, h: -10 };
      expect(isValidRect(rect)).toBe(false);
    });
  });
});