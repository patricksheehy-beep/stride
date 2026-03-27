import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('RouteExplainer', () => {
  let RouteExplainer;
  let mockClaudeClient;

  beforeEach(async () => {
    vi.restoreAllMocks();

    mockClaudeClient = {
      complete: vi.fn()
    };

    const mod = await import('../../src/nl/route-explainer.js');
    RouteExplainer = mod.RouteExplainer;
  });

  describe('explain()', () => {
    it('calls Claude API with score breakdown and trail metadata in user message', async () => {
      mockClaudeClient.complete.mockResolvedValue(
        "You'll run along Bay Trail with great surface quality."
      );

      const explainer = new RouteExplainer(mockClaudeClient);
      const routeData = {
        distanceKm: 5.2,
        score: {
          total: 0.78,
          breakdown: {
            surfaceScore: 0.85,
            continuityScore: 0.9,
            trailPrefScore: 0.7,
            scenicScore: 0.6,
            greenSpaceScore: 0.75
          }
        },
        trailNames: ['Bay Trail', 'Creek Path'],
        surfaces: ['compacted', 'fine_gravel'],
        waterFeatures: ['Stevens Creek'],
        greenSpaces: ['Shoreline Park']
      };

      await explainer.explain(routeData);

      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(1);
      const [systemPrompt, userMessage] = mockClaudeClient.complete.mock.calls[0];
      expect(typeof systemPrompt).toBe('string');
      expect(userMessage).toContain('5.2');
      expect(userMessage).toContain('0.78');
      expect(userMessage).toContain('Bay Trail');
      expect(userMessage).toContain('compacted');
    });

    it('returns a string explanation (the raw text from Claude)', async () => {
      mockClaudeClient.complete.mockResolvedValue(
        "You'll enjoy a scenic 5km run along the Bay Trail."
      );

      const explainer = new RouteExplainer(mockClaudeClient);
      const result = await explainer.explain({
        distanceKm: 5,
        score: { total: 0.8, breakdown: { surfaceScore: 0.9, continuityScore: 0.8, trailPrefScore: 0.7, scenicScore: 0.6, greenSpaceScore: 0.7 } }
      });

      expect(typeof result).toBe('string');
      expect(result).toContain('scenic 5km run');
    });

    it('includes route distance, top scoring factors, trail names, and surface types in the prompt to Claude', async () => {
      mockClaudeClient.complete.mockResolvedValue('An explanation.');

      const explainer = new RouteExplainer(mockClaudeClient);
      await explainer.explain({
        distanceKm: 8.3,
        score: {
          total: 0.72,
          breakdown: {
            surfaceScore: 0.9,
            continuityScore: 0.85,
            trailPrefScore: 0.65,
            scenicScore: 0.5,
            greenSpaceScore: 0.6
          }
        },
        trailNames: ['Lakeside Loop'],
        surfaces: ['asphalt', 'gravel']
      });

      const userMessage = mockClaudeClient.complete.mock.calls[0][1];
      expect(userMessage).toContain('8.3');
      expect(userMessage).toContain('Surface quality');
      expect(userMessage).toContain('Lakeside Loop');
      expect(userMessage).toContain('asphalt');
    });

    it('returns a fallback explanation string (not null) when Claude API fails', async () => {
      mockClaudeClient.complete.mockRejectedValue(new Error('API error'));

      const explainer = new RouteExplainer(mockClaudeClient);
      const result = await explainer.explain({
        distanceKm: 5,
        score: { total: 0.75, breakdown: {} }
      });

      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
      expect(result).toContain('5');
      expect(result).toContain('0.75');
    });

    it('with empty score breakdown returns generic fallback explanation', async () => {
      mockClaudeClient.complete.mockRejectedValue(new Error('API error'));

      const explainer = new RouteExplainer(mockClaudeClient);
      const result = await explainer.explain({
        score: { breakdown: {} }
      });

      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
    });
  });

  describe('explainBatch()', () => {
    it('generates explanations for top N routes (default 3) in a single Claude call', async () => {
      mockClaudeClient.complete.mockResolvedValue(
        'Route 1:\nA great trail run.\n\nRoute 2:\nA scenic waterfront route.\n\nRoute 3:\nA hilly forest run.'
      );

      const explainer = new RouteExplainer(mockClaudeClient);
      const routes = [
        { distanceKm: 5, score: { total: 0.8, breakdown: { surfaceScore: 0.9, continuityScore: 0.8, trailPrefScore: 0.7, scenicScore: 0.6, greenSpaceScore: 0.7 } } },
        { distanceKm: 6, score: { total: 0.7, breakdown: { surfaceScore: 0.8, continuityScore: 0.7, trailPrefScore: 0.6, scenicScore: 0.5, greenSpaceScore: 0.6 } } },
        { distanceKm: 4, score: { total: 0.65, breakdown: { surfaceScore: 0.7, continuityScore: 0.6, trailPrefScore: 0.8, scenicScore: 0.4, greenSpaceScore: 0.5 } } },
        { distanceKm: 7, score: { total: 0.6, breakdown: { surfaceScore: 0.6, continuityScore: 0.5, trailPrefScore: 0.7, scenicScore: 0.3, greenSpaceScore: 0.4 } } }
      ];

      const result = await explainer.explainBatch(routes);

      // Should call Claude exactly once (batched)
      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(1);
      // Should only process first 3 (default maxRoutes)
      const userMessage = mockClaudeClient.complete.mock.calls[0][1];
      expect(userMessage).toContain('Route 1:');
      expect(userMessage).toContain('Route 2:');
      expect(userMessage).toContain('Route 3:');
      expect(userMessage).not.toContain('Route 4:');
    });

    it('returns array of explanation strings matching input order', async () => {
      mockClaudeClient.complete.mockResolvedValue(
        'Route 1:\nFirst route explanation.\n\nRoute 2:\nSecond route explanation.\n\nRoute 3:\nThird route explanation.'
      );

      const explainer = new RouteExplainer(mockClaudeClient);
      const routes = [
        { distanceKm: 5, score: { total: 0.8, breakdown: { surfaceScore: 0.9, continuityScore: 0.8, trailPrefScore: 0.7, scenicScore: 0.6, greenSpaceScore: 0.7 } } },
        { distanceKm: 6, score: { total: 0.7, breakdown: { surfaceScore: 0.8, continuityScore: 0.7, trailPrefScore: 0.6, scenicScore: 0.5, greenSpaceScore: 0.6 } } },
        { distanceKm: 4, score: { total: 0.65, breakdown: { surfaceScore: 0.7, continuityScore: 0.6, trailPrefScore: 0.8, scenicScore: 0.4, greenSpaceScore: 0.5 } } }
      ];

      const result = await explainer.explainBatch(routes);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(3);
      expect(result[0]).toContain('First route');
      expect(result[1]).toContain('Second route');
      expect(result[2]).toContain('Third route');
    });

    it('gracefully returns fallback explanations when Claude API fails', async () => {
      mockClaudeClient.complete.mockRejectedValue(new Error('Network error'));

      const explainer = new RouteExplainer(mockClaudeClient);
      const routes = [
        { distanceKm: 5, score: { total: 0.8, breakdown: {} } },
        { distanceKm: 6, score: { total: 0.7, breakdown: {} } }
      ];

      const result = await explainer.explainBatch(routes);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      for (const explanation of result) {
        expect(typeof explanation).toBe('string');
        expect(explanation.length).toBeGreaterThan(0);
      }
    });
  });

  describe('_extractTrailMetadata()', () => {
    it('extracts trail names, surfaces, water features, and green spaces from GeoJSON', () => {
      const explainer = new RouteExplainer(mockClaudeClient);

      const routeGeoJSON = { type: 'FeatureCollection', features: [] };
      const trailData = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { name: 'Bay Trail', surface: 'compacted' } },
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { name: 'Creek Path', surface: 'fine_gravel', natural: 'water' } },
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { relationName: 'Bay Area Ridge Trail', surface: 'compacted' } },
          { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { waterway: 'stream', name: 'Stevens Creek' } }
        ]
      };
      const landUseData = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { leisure: 'park', name: 'Shoreline Park' } },
          { type: 'Feature', geometry: { type: 'Polygon', coordinates: [] }, properties: { landuse: 'forest', name: 'Rancho Forest' } }
        ]
      };

      const result = explainer._extractTrailMetadata(routeGeoJSON, trailData, landUseData);

      expect(result.trailNames).toContain('Bay Trail');
      expect(result.trailNames).toContain('Creek Path');
      expect(result.trailNames).toContain('Bay Area Ridge Trail');
      expect(result.surfaces).toContain('compacted');
      expect(result.surfaces).toContain('fine_gravel');
      expect(result.waterFeatures).toContain('Stevens Creek');
      expect(result.greenSpaces).toContain('Shoreline Park');
      expect(result.greenSpaces).toContain('Rancho Forest');
    });
  });
});
