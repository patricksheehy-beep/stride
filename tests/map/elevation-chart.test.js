import { describe, it, expect } from 'vitest';
import { calculateElevationStats } from '../../src/map/elevation-chart.js';

describe('calculateElevationStats', () => {
  it('with ascending coordinates returns correct totalAscent and zero totalDescent', () => {
    const coords = [
      [-122.4, 37.7, 10],
      [-122.5, 37.8, 20],
      [-122.6, 37.9, 35]
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.totalAscent).toBe(25);
    expect(stats.totalDescent).toBe(0);
  });

  it('with mixed elevation returns correct totalAscent and totalDescent independently', () => {
    const coords = [
      [-122.4, 37.7, 10],
      [-122.5, 37.8, 30],  // +20 ascent
      [-122.6, 37.9, 15],  // -15 descent
      [-122.7, 38.0, 25]   // +10 ascent
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.totalAscent).toBe(30);   // 20 + 10
    expect(stats.totalDescent).toBe(15);  // 15
  });

  it('returns correct minEle and maxEle across all coordinates', () => {
    const coords = [
      [-122.4, 37.7, 100],
      [-122.5, 37.8, 250],
      [-122.6, 37.9, 50],
      [-122.7, 38.0, 180]
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.minEle).toBe(50);
    expect(stats.maxEle).toBe(250);
    expect(stats.elevationRange).toBe(200);
  });

  it('with 2D coordinates (no elevation) returns all zeros gracefully', () => {
    const coords = [
      [-122.4, 37.7],
      [-122.5, 37.8]
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.totalAscent).toBe(0);
    expect(stats.totalDescent).toBe(0);
    expect(stats.minEle).toBe(0);
    expect(stats.maxEle).toBe(0);
    expect(stats.elevationRange).toBe(0);
  });

  it('with single coordinate returns zero ascent/descent', () => {
    const coords = [
      [-122.4, 37.7, 100]
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.totalAscent).toBe(0);
    expect(stats.totalDescent).toBe(0);
    expect(stats.minEle).toBe(100);
    expect(stats.maxEle).toBe(100);
    expect(stats.elevationRange).toBe(0);
  });

  it('with flat elevation returns zero ascent and zero descent', () => {
    const coords = [
      [-122.4, 37.7, 50],
      [-122.5, 37.8, 50],
      [-122.6, 37.9, 50],
      [-122.7, 38.0, 50]
    ];
    const stats = calculateElevationStats(coords);

    expect(stats.totalAscent).toBe(0);
    expect(stats.totalDescent).toBe(0);
    expect(stats.minEle).toBe(50);
    expect(stats.maxEle).toBe(50);
    expect(stats.elevationRange).toBe(0);
  });
});
