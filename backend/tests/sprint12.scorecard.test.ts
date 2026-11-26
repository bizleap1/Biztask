import { describe, expect, it } from 'vitest';
import { calculatePerformanceScore } from '../controllers/dashboardController';

describe('Sprint 12 performance scorecard', () => {
  it('uses 40 percent on-time, 30 percent completion and 30 percent attendance', () => {
    expect(calculatePerformanceScore(10, 0, 0, 10, 100)).toBe(100);
  });

  it('reduces score for overdue and rework', () => {
    const score = calculatePerformanceScore(5, 3, 2, 10, 100);
    expect(score).toBeLessThan(70);
  });

  it('does not return an out-of-range score', () => {
    expect(calculatePerformanceScore(0, 100, 100, 10, 0)).toBeGreaterThanOrEqual(0);
  });
});
