import { describe, it, expect } from 'vitest';
import { RouteScorer } from '../../src/scoring/scorer.js';
import { DEFAULT_WEIGHTS } from '../../src/scoring/weights.js';
import { featureCollection, lineString } from '@turf/helpers';

// Helper: create trail data with specific properties
function makeTrailData(features) {
  return featureCollection(
    features.map(({ coords, ...props }) =>
      lineString(coords || [[-122.03, 37.38], [-122.025, 37.38]], props)
    )
  );
}

// Trail-heavy route: path trails with fine_gravel surface
const trailCoords = [
  [-122.05, 37.38],
  [-122.04, 37.38],
  [-122.03, 37.38],
  [-122.02, 37.38],
  [-122.01, 37.38]
];

const trailHeavyRoute = featureCollection([lineString(trailCoords)]);
const trailHeavyData = makeTrailData([
  { coords: [[-122.05, 37.38], [-122.03, 37.38]], highway: 'path', surface: 'fine_gravel', routeType: 'hiking' },
  { coords: [[-122.03, 37.38], [-122.01, 37.38]], highway: 'footway', surface: 'compacted', natural: 'wood' }
]);

// Road-heavy route: residential roads with asphalt
const roadCoords = [
  [-122.05, 37.38],
  [-122.04, 37.38],
  [-122.03, 37.38],
  [-122.02, 37.38],
  [-122.01, 37.38]
];

const roadHeavyRoute = featureCollection([lineString(roadCoords)]);
const roadHeavyData = makeTrailData([
  { coords: [[-122.05, 37.38], [-122.03, 37.38]], highway: 'residential', surface: 'asphalt' },
  { coords: [[-122.03, 37.38], [-122.01, 37.38]], highway: 'tertiary', surface: 'concrete' }
]);

const startPoint = [-122.05, 37.38];

describe('RouteScorer', () => {
  it('new RouteScorer() uses DEFAULT_WEIGHTS', () => {
    const scorer = new RouteScorer();
    expect(scorer.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it('new RouteScorer(customWeights) uses provided weights', () => {
    const custom = { surface: 0.4, continuity: 0.15, trailPreference: 0.2, scenic: 0.1, greenSpace: 0.15 };
    const scorer = new RouteScorer(custom);
    expect(scorer.weights).toEqual(custom);
  });

  it('scoreRoute returns { total, breakdown }', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('breakdown');
  });

  it('total is a number between 0 and 1', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    expect(typeof result.total).toBe('number');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(1);
  });

  it('breakdown has keys: surfaceScore, continuityScore, trailPrefScore, scenicScore, greenSpaceScore', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    expect(result.breakdown).toHaveProperty('surfaceScore');
    expect(result.breakdown).toHaveProperty('continuityScore');
    expect(result.breakdown).toHaveProperty('trailPrefScore');
    expect(result.breakdown).toHaveProperty('scenicScore');
    expect(result.breakdown).toHaveProperty('greenSpaceScore');
  });

  it('each breakdown value is between 0 and 1', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    for (const value of Object.values(result.breakdown)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('total equals weighted sum of all 5 breakdown values', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    const expectedTotal =
      scorer.weights.surface * result.breakdown.surfaceScore +
      scorer.weights.continuity * result.breakdown.continuityScore +
      scorer.weights.trailPreference * result.breakdown.trailPrefScore +
      scorer.weights.scenic * result.breakdown.scenicScore +
      scorer.weights.greenSpace * result.breakdown.greenSpaceScore;
    expect(result.total).toBeCloseTo(expectedTotal, 10);
  });

  it('scoreRoute accepts optional landUseData parameter', () => {
    const scorer = new RouteScorer();
    // Should not throw when called with 4 args
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint, null);
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('breakdown');
  });

  it('when landUseData is not provided, greenSpace uses neutral base score', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    // Neutral base is 0.4 when no land-use data
    expect(result.breakdown.greenSpaceScore).toBe(0.4);
  });

  it('scoreRoute total includes greenSpace weighted contribution', () => {
    const scorer = new RouteScorer();
    const result = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    // greenSpaceScore is 0.4 (neutral) * greenSpace weight should be part of total
    const greenContribution = scorer.weights.greenSpace * result.breakdown.greenSpaceScore;
    expect(greenContribution).toBeGreaterThan(0);
    // Total must be positive (all factor contributions)
    expect(result.total).toBeGreaterThan(0);
  });

  it('trail-heavy route scores higher than road-heavy route (ROUTE-04 validation)', () => {
    const scorer = new RouteScorer();
    const trailScore = scorer.scoreRoute(trailHeavyRoute, trailHeavyData, startPoint);
    const roadScore = scorer.scoreRoute(roadHeavyRoute, roadHeavyData, startPoint);
    expect(trailScore.total).toBeGreaterThan(roadScore.total);
  });
});

describe('RouteScorer.scoreAndRank', () => {
  it('returns array sorted by total descending', () => {
    const scorer = new RouteScorer();
    const candidates = [roadHeavyRoute, trailHeavyRoute];
    const trailDataSets = [roadHeavyData, trailHeavyData];

    // Score each route with its corresponding trail data
    const ranked = scorer.scoreAndRank(
      candidates.map((route, i) => ({ route, trailData: trailDataSets[i] })),
      startPoint
    );

    expect(Array.isArray(ranked)).toBe(true);
    expect(ranked.length).toBe(2);

    // Should be sorted by total descending
    expect(ranked[0].score.total).toBeGreaterThanOrEqual(ranked[1].score.total);
  });

  it('each ranked item has route and score properties', () => {
    const scorer = new RouteScorer();
    const candidates = [{ route: trailHeavyRoute, trailData: trailHeavyData }];
    const ranked = scorer.scoreAndRank(candidates, startPoint);

    expect(ranked[0]).toHaveProperty('route');
    expect(ranked[0]).toHaveProperty('score');
    expect(ranked[0].score).toHaveProperty('total');
    expect(ranked[0].score).toHaveProperty('breakdown');
  });
});
