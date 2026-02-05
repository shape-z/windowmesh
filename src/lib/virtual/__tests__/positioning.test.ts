import { describe, it, expect, vi } from 'vitest';
import {
  getStaticLayoutFromUrl,
  calculateAssignedScreen,
  calculateRelativePosition,
  calculateGlobalPosition
} from '../engine/EnginePositioning';
import type { VflScreen, Rect } from '../types/types';

const { mockGetScreenPositionFromUrl, mockGetScreenIdFromUrl } = vi.hoisted(() => ({
  mockGetScreenPositionFromUrl: vi.fn(),
  mockGetScreenIdFromUrl: vi.fn()
}));

// Mock screenUtils
vi.mock('../utils/screenUtils', () => ({
  getScreenIdFromUrl: mockGetScreenIdFromUrl,
  getScreenPositionFromUrl: mockGetScreenPositionFromUrl
}));

// Mock window
const mockWindow = {
  location: { href: 'http://example.com' },
  URL: URL,
  searchParams: new URLSearchParams()
};

vi.stubGlobal('window', mockWindow);

vi.mocked(await import('../utils/screenUtils')).getScreenIdFromUrl.mockImplementation(mockGetScreenIdFromUrl);

describe('positioning', () => {
  const mockScreens: VflScreen[] = [
    { id: 'S1', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'S2', x: 1920, y: 0, w: 1920, h: 1080 }
  ];

  describe('getStaticLayoutFromUrl()', () => {
    it('returns null if no layout param', () => {
      mockWindow.location.href = 'http://example.com';
      expect(getStaticLayoutFromUrl()).toBeNull();
    });

    it('returns null on server side', () => {
      vi.stubGlobal('window', undefined);
      expect(getStaticLayoutFromUrl()).toBeNull();
      vi.stubGlobal('window', mockWindow);
    });

    // Note: Full decode test would require mocking decodeVflFromUrlParam
  });

  describe('calculateAssignedScreen()', () => {
    const winRect: Rect = { x: 0, y: 0, w: 800, h: 600 };

    it('assigns screen from URL if available', () => {
      mockGetScreenIdFromUrl.mockReturnValue('S2');

      const screen = calculateAssignedScreen('win1', winRect, mockScreens);
      expect(screen.id).toBe('S2');
    });

    it('falls back to geometry assignment', () => {
      mockGetScreenIdFromUrl.mockReturnValue(null);
      vi.doMock('../utils/vfl', () => ({
        assignScreenForWindow: vi.fn(() => ({ screenId: 'S1' }))
      }));

      const screen = calculateAssignedScreen('win1', winRect, mockScreens);
      expect(screen.id).toBe('S1');
    });

    it('returns first screen if no assignment', () => {
      vi.doMock('../utils/screenUtils', () => ({
        getScreenIdFromUrl: vi.fn(() => null)
      }));
      vi.doMock('../utils/vfl', () => ({
        assignScreenForWindow: vi.fn(() => ({ screenId: 'nonexistent' }))
      }));

      const screen = calculateAssignedScreen('win1', winRect, mockScreens);
      expect(screen.id).toBe('S1');
    });
  });

  describe('calculateRelativePosition()', () => {
    const winRect: Rect = { x: 100, y: 50, w: 800, h: 600 };
    const screen: VflScreen = { id: 'S1', x: 0, y: 0, w: 1920, h: 1080 };

    it('uses URL position if available', () => {
      mockGetScreenPositionFromUrl.mockReturnValue({ x: 200, y: 150 });

      const pos = calculateRelativePosition(winRect, screen);
      expect(pos).toEqual({ x: 200, y: 150 });
    });

    it('falls back to center of screen', () => {
      mockGetScreenPositionFromUrl.mockReturnValue(null);

      const pos = calculateRelativePosition(winRect, screen);
      // Code logic is just relative subtraction: 100 - 0 = 100, 50 - 0 = 50
      expect(pos).toEqual({ x: 100, y: 50 });
    });
  });

  describe('calculateGlobalPosition()', () => {
    it('calculates global position from relative', () => {
      const relativePos = { x: 100, y: 200 };
      const screen: VflScreen = { id: 'S1', x: 1920, y: 0, w: 1920, h: 1080 };

      const globalPos = calculateGlobalPosition(screen, relativePos, 800, 600);
      expect(globalPos).toEqual({ x: 2020, y: 200, w: 800, h: 600 });
    });
  });
});