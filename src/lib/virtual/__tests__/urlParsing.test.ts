import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  getScreenPositionFromUrl, 
  getScreenIdFromUrl, 
  getLayoutFromUrl,
  // We might need to export encodeScreenPositionToUrlParam if it exists or test the decoder robustly
} from '@/lib/virtual/utils/screenUtils';
import { encodeVflToUrlParam } from '@/lib/virtual/utils/vfl';
import type { VflLayout } from '@/lib/virtual/types/types';

describe('URL Parser & Serializer (screenUtils)', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      value: {
        href: 'http://localhost:3000/',
        searchParams: new URLSearchParams(),
        origin: 'http://localhost:3000',
        pathname: '/'
      },
      writable: true
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });

  describe('getScreenPositionFromUrl', () => {
    it('should parse "pos1." prefixed JSON (Standard Case)', () => {
      // ?screenPosition=pos1.%7B%22x%22%3A100%2C%22y%22%3A200%7D
      const json = JSON.stringify({ x: 100, y: 200 });
      const param = `pos1.${encodeURIComponent(json)}`;
      window.location.href = `http://localhost:3000/?screenPosition=${param}`;
      
      expect(getScreenPositionFromUrl()).toEqual({ x: 100, y: 200 });
    });

    it('should parse "pos1." with UN-encoded JSON (Edge Case)', () => {
      // Sometimes browsers or manual entry might leave it raw
      const param = `pos1.{"x":50,"y":50}`;
      // Note: Setting href via JS usually encodes it, so we manually construct the search param behavior roughly
      // But here we rely on the function reading window.location.href
      // To simulate raw params in href, we should encode the whole thing or carefuly construct
      window.location.href = `http://localhost:3000/?screenPosition=${encodeURIComponent(param)}`;
      expect(getScreenPositionFromUrl()).toEqual({ x: 50, y: 50 });
    });

    it('should parse Direct JSON (No prefix)', () => {
      // ?screenPosition={"x":10,"y":20}
      const json = JSON.stringify({ x: 10, y: 20 });
      const param = encodeURIComponent(json);
      window.location.href = `http://localhost:3000/?screenPosition=${param}`;
      expect(getScreenPositionFromUrl()).toEqual({ x: 10, y: 20 });
    });

    it('should parse Comma Separated "x,y"', () => {
      // ?screenPosition=123,456
      window.location.href = `http://localhost:3000/?screenPosition=123,456`;
      expect(getScreenPositionFromUrl()).toEqual({ x: 123, y: 456 });
    });

    it('should parse Comma Separated with spaces "x, y"', () => {
      window.location.href = `http://localhost:3000/?screenPosition=123,%20456`;
      expect(getScreenPositionFromUrl()).toEqual({ x: 123, y: 456 });
    });

    it('should return null for malformed JSON', () => {
      window.location.href = `http://localhost:3000/?screenPosition={bad:json`;
      expect(getScreenPositionFromUrl()).toBeNull();
    });

    it('should return null for non-numeric comma values', () => {
      window.location.href = `http://localhost:3000/?screenPosition=abc,def`;
      expect(getScreenPositionFromUrl()).toBeNull();
    });

    it('should return null for incomplete parameters', () => {
      window.location.href = `http://localhost:3000/`;
      expect(getScreenPositionFromUrl()).toBeNull();
    });
  });

  describe('getScreenIdFromUrl', () => {
    it('should parse simple screen ID', () => {
      window.location.href = `http://localhost:3000/?screenId=S1`;
      expect(getScreenIdFromUrl()).toBe('S1');
    });

    it('should parse encoded screen ID', () => {
      window.location.href = `http://localhost:3000/?screenId=${encodeURIComponent('Screen A')}`;
      expect(getScreenIdFromUrl()).toBe('Screen A');
    });
  });

  describe('getLayoutFromUrl', () => {
    it('should parse a valid VFL param', () => {
      const vfl: VflLayout = {
        v: 1,
        frame: { x: 0, y: 0, w: 1920, h: 1080 },
        screens: [{ id: 'S1', x: 0, y: 0, w: 1920, h: 1080 }]
      };
      const param = encodeVflToUrlParam(vfl);
      window.location.href = `http://localhost:3000/?layout=${param}`;
      
      const result = getLayoutFromUrl();
      expect(result).toBeTruthy();
      expect(result?.screens[0].id).toBe('S1');
    });

    it('should return null for invalid VFL param', () => {
      window.location.href = `http://localhost:3000/?layout=invalidbase64`;
      expect(getLayoutFromUrl()).toBeNull();
    });
  });
});
