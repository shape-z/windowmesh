import { describe, it, expect, vi } from 'vitest';
import { localToGlobal, globalToLocal, virtualToWindow, windowToVirtual } from '../extensions/coordinates';

vi.mock('../extensions/virtualContext', () => ({
  VirtualCtx: {
    // Mock context
  }
}));

describe('coordinates', () => {
  describe('localToGlobal()', () => {
    it('converts local to global coordinates', () => {
      const result = localToGlobal(200, 150, { x: 100, y: 50 });
      expect(result).toEqual({ x: 300, y: 200 });
    });
  });

  describe('globalToLocal()', () => {
    it('converts global to local coordinates', () => {
      const result = globalToLocal(300, 200, { x: 100, y: 50 });
      expect(result).toEqual({ x: 200, y: 150 });
    });
  });

  describe('virtualToWindow()', () => {
    it('converts virtual to window coordinates', () => {
      const frame = { x: 10, y: 20 };
      const result = virtualToWindow(100, 150, frame);
      expect(result).toEqual({ x: 110, y: 170 });
    });
  });

  describe('windowToVirtual()', () => {
    it('converts window to virtual coordinates', () => {
      const frame = { x: 10, y: 20 };
      const result = windowToVirtual(110, 170, frame);
      expect(result).toEqual({ x: 100, y: 150 });
    });
  });
});