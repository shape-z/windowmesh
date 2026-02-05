import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeManager } from '../extensions/timeManager';
import type { VirtualEngine } from '../engine/VirtualEngine';

describe('TimeManager', () => {
  let timeManager: TimeManager;
  let mockEngine: VirtualEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    mockEngine = {
      setSharedData: vi.fn()
    } as any;
    timeManager = new TimeManager(mockEngine);
  });

  afterEach(() => {
    vi.useRealTimers();
    timeManager.destroy();
  });

  describe('startTimer()', () => {
    it('starts timer and broadcasts', () => {
      timeManager.startTimer('test-timer', 1000);
      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'timer_test-timer',
        expect.objectContaining({ t: 'timer_start', id: 'test-timer', duration: 1000 })
      );
    });

    it('calls onTimeEvent if provided', () => {
      const onTimeEvent = vi.fn();
      const tm = new TimeManager(mockEngine, onTimeEvent);
      tm.startTimer('test', 1000);
      expect(onTimeEvent).toHaveBeenCalledWith(
        expect.objectContaining({ t: 'timer_start' })
      );
      tm.destroy();
    });

    it('ends timer after duration', () => {
      timeManager.startTimer('test-timer', 1000);
      vi.advanceTimersByTime(1000);
      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'timer_test-timer',
        expect.objectContaining({ t: 'timer_end', id: 'test-timer' })
      );
    });
  });

  describe('endTimer()', () => {
    it('ends timer manually', () => {
      timeManager.startTimer('test-timer', 10000);
      timeManager.endTimer('test-timer');
      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'timer_test-timer',
        expect.objectContaining({ t: 'timer_end', id: 'test-timer' })
      );
    });
  });

  describe('setTimestamp()', () => {
    it('sets timestamp and broadcasts', () => {
      timeManager.setTimestamp('test-key', 123456);
      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'timestamp_test-key',
        expect.objectContaining({ t: 'timestamp_update', key: 'test-key', value: 123456 })
      );
    });

    it('uses current time if no value provided', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      timeManager.setTimestamp('test-key');
      expect(mockEngine.setSharedData).toHaveBeenCalledWith(
        'timestamp_test-key',
        expect.objectContaining({ value: now })
      );
    });
  });

  describe('getTimestamp()', () => {
    it('returns stored timestamp', () => {
      timeManager.setTimestamp('test-key', 123456);
      expect(timeManager.getTimestamp('test-key')).toBe(123456);
    });

    it('returns undefined for unknown key', () => {
      expect(timeManager.getTimestamp('unknown')).toBeUndefined();
    });
  });

  describe('getAllTimestamps()', () => {
    it('returns all timestamps', () => {
      timeManager.setTimestamp('key1', 1);
      timeManager.setTimestamp('key2', 2);
      expect(timeManager.getAllTimestamps()).toEqual({ key1: 1, key2: 2 });
    });
  });
});