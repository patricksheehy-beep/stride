import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NLParser } from '../../src/nl/nl-parser.js';

describe('NLParser', () => {
  let parser;
  let mockClient;

  beforeEach(() => {
    mockClient = {
      complete: vi.fn()
    };
    parser = new NLParser(mockClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parse("shady waterfront trail") returns weights, preferences, vibeKeywords with elevated greenSpace and scenic', async () => {
    mockClient.complete.mockResolvedValue({
      weights: { surface: 0.2, continuity: 0.15, trailPreference: 0.3, scenic: 0.7, greenSpace: 0.8 },
      preferences: {
        preferWater: true, preferParks: true, preferForest: true,
        preferHills: false, preferFlat: false, preferPaved: false, preferTrails: true
      },
      vibeKeywords: ['shady', 'waterfront', 'nature']
    });

    const result = await parser.parse('shady waterfront trail');

    expect(result).toBeDefined();
    expect(result.weights).toBeDefined();
    expect(result.preferences).toBeDefined();
    expect(result.vibeKeywords).toBeDefined();
    expect(result.weights.greenSpace).toBeGreaterThan(result.weights.surface);
    expect(result.weights.scenic).toBeGreaterThan(result.weights.surface);
  });

  it('parse("fast road run") returns preferences.preferPaved = true, elevated surface weight', async () => {
    mockClient.complete.mockResolvedValue({
      weights: { surface: 0.8, continuity: 0.5, trailPreference: 0.1, scenic: 0.2, greenSpace: 0.1 },
      preferences: {
        preferWater: false, preferParks: false, preferForest: false,
        preferHills: false, preferFlat: true, preferPaved: true, preferTrails: false
      },
      vibeKeywords: ['fast', 'road', 'speed']
    });

    const result = await parser.parse('fast road run');

    expect(result.preferences.preferPaved).toBe(true);
    expect(result.weights.surface).toBeGreaterThan(result.weights.trailPreference);
  });

  it('parse("") returns null (empty input, no API call made)', async () => {
    const result = await parser.parse('');
    expect(result).toBeNull();
    expect(mockClient.complete).not.toHaveBeenCalled();
  });

  it('parse() with null returns null', async () => {
    const result = await parser.parse(null);
    expect(result).toBeNull();
    expect(mockClient.complete).not.toHaveBeenCalled();
  });

  it('parse() gracefully returns null when Claude API throws (network error)', async () => {
    mockClient.complete.mockRejectedValue(new Error('Network error'));

    const result = await parser.parse('shady trail');
    expect(result).toBeNull();
  });

  it('parse() gracefully returns null when Claude API returns 429 (rate limited)', async () => {
    mockClient.complete.mockRejectedValue(new Error('Claude API error: 429 - Rate limited'));

    const result = await parser.parse('forest run');
    expect(result).toBeNull();
  });

  it('returned weights are all numbers between 0 and 1', async () => {
    mockClient.complete.mockResolvedValue({
      weights: { surface: 1.5, continuity: -0.2, trailPreference: 0.5, scenic: 0.8, greenSpace: 2.0 },
      preferences: {
        preferWater: false, preferParks: false, preferForest: false,
        preferHills: false, preferFlat: false, preferPaved: false, preferTrails: false
      },
      vibeKeywords: ['test']
    });

    const result = await parser.parse('any description');

    for (const [key, value] of Object.entries(result.weights)) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('returned preferences are all booleans', async () => {
    mockClient.complete.mockResolvedValue({
      weights: { surface: 0.3, continuity: 0.3, trailPreference: 0.3, scenic: 0.3, greenSpace: 0.3 },
      preferences: {
        preferWater: true, preferParks: false, preferForest: true,
        preferHills: false, preferFlat: true, preferPaved: false, preferTrails: true
      },
      vibeKeywords: ['mixed']
    });

    const result = await parser.parse('mixed terrain run');

    for (const [key, value] of Object.entries(result.preferences)) {
      expect(typeof value).toBe('boolean');
    }
  });
});
