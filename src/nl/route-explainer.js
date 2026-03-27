/**
 * Route explanation generator using Claude API.
 * Converts score breakdowns and trail metadata into human-readable
 * explanations of why each route was recommended.
 *
 * Supports single and batch explanation generation with graceful
 * fallback to template strings when the API is unavailable.
 */
import { EXPLAINER_SYSTEM_PROMPT } from './prompt-templates.js';

export class RouteExplainer {
  /**
   * Create a RouteExplainer instance.
   * @param {import('./claude-client.js').ClaudeClient} claudeClient - Claude API client instance
   */
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }

  /**
   * Build a structured prompt string describing a route for Claude.
   *
   * @param {Object} routeData - Route data for explanation
   * @param {number} [routeData.distanceKm] - Route distance in kilometers
   * @param {Object} routeData.score - Score object with total and breakdown
   * @param {number} routeData.score.total - Overall score (0-1)
   * @param {Object} routeData.score.breakdown - Individual factor scores
   * @param {string[]} [routeData.trailNames] - Trail names on the route
   * @param {string[]} [routeData.surfaces] - Surface types on the route
   * @param {string[]} [routeData.waterFeatures] - Water features nearby
   * @param {string[]} [routeData.greenSpaces] - Green spaces nearby
   * @param {string[]} [routeData.vibeKeywords] - User's vibe keywords
   * @returns {string} Formatted prompt string
   */
  _buildExplainPrompt(routeData) {
    const { distanceKm, score, trailNames, surfaces, waterFeatures, greenSpaces, vibeKeywords } = routeData;
    const breakdown = score?.breakdown || {};

    return `Route: ${distanceKm || 'unknown'}km loop
Overall score: ${score?.total?.toFixed(2) || 'N/A'}/1.0

Score breakdown:
- Surface quality: ${breakdown.surfaceScore?.toFixed(2) || 'N/A'}/1.0
- Route continuity: ${breakdown.continuityScore?.toFixed(2) || 'N/A'}/1.0
- Trail preference: ${breakdown.trailPrefScore?.toFixed(2) || 'N/A'}/1.0
- Scenic value: ${breakdown.scenicScore?.toFixed(2) || 'N/A'}/1.0
- Green space: ${breakdown.greenSpaceScore?.toFixed(2) || 'N/A'}/1.0

Trail names: ${trailNames?.join(', ') || 'unnamed trails'}
Surfaces: ${surfaces?.join(', ') || 'mixed'}
Water features: ${waterFeatures?.join(', ') || 'none nearby'}
Green spaces: ${greenSpaces?.join(', ') || 'none nearby'}
User vibe: ${vibeKeywords?.join(', ') || 'general run'}`;
  }

  /**
   * Generate a human-readable explanation for a single route.
   * Falls back to a template string if the Claude API call fails.
   *
   * @param {Object} routeData - Route data (see _buildExplainPrompt for shape)
   * @returns {Promise<string>} Explanation text (never null)
   */
  async explain(routeData) {
    try {
      const prompt = this._buildExplainPrompt(routeData);
      const text = await this.claudeClient.complete(
        EXPLAINER_SYSTEM_PROMPT,
        prompt,
        null,
        { maxTokens: 256 }
      );
      return text;
    } catch {
      // Graceful degradation: return a template fallback
      return `A ${routeData.distanceKm || ''}km route scoring ${routeData.score?.total?.toFixed(2) || 'N/A'} overall.`;
    }
  }

  /**
   * Generate explanations for multiple routes in a single Claude API call.
   * Falls back to template explanations for each route if the API call fails.
   *
   * @param {Object[]} routeDataArray - Array of route data objects
   * @param {number} [maxRoutes=3] - Maximum number of routes to explain
   * @returns {Promise<string[]>} Array of explanation strings matching input order
   */
  async explainBatch(routeDataArray, maxRoutes = 3) {
    const toExplain = routeDataArray.slice(0, maxRoutes);

    try {
      // Build a combined prompt with all routes numbered
      const routePrompts = toExplain.map((routeData, i) =>
        `Route ${i + 1}:\n${this._buildExplainPrompt(routeData)}`
      ).join('\n\n');

      const combinedPrompt = `Generate a brief 2-3 sentence explanation for each of the following routes:\n\n${routePrompts}`;
      const systemPrompt = `${EXPLAINER_SYSTEM_PROMPT}\n\nFor each route, write a separate explanation paragraph. Label each "Route 1:", "Route 2:", etc.`;

      const text = await this.claudeClient.complete(
        systemPrompt,
        combinedPrompt,
        null,
        { maxTokens: 512 }
      );

      // Parse response by splitting on "Route N:" patterns
      const explanations = this._parseBatchResponse(text, toExplain.length);
      return explanations;
    } catch {
      // Graceful degradation: return fallback for each route
      return toExplain.map(routeData =>
        `A ${routeData.distanceKm || ''}km route scoring ${routeData.score?.total?.toFixed(2) || 'N/A'} overall.`
      );
    }
  }

  /**
   * Parse a batch response by splitting on "Route N:" labels.
   *
   * @param {string} text - Raw Claude response text
   * @param {number} expectedCount - Expected number of route explanations
   * @returns {string[]} Array of explanation strings
   */
  _parseBatchResponse(text, expectedCount) {
    // Split on "Route N:" patterns (case-insensitive, with optional leading whitespace)
    const parts = text.split(/Route\s+\d+:\s*/i);

    // First element is empty or preamble, skip it
    const explanations = parts.slice(1).map(p => p.trim());

    // If parsing didn't produce enough results, pad with the original text
    while (explanations.length < expectedCount) {
      explanations.push(text.trim());
    }

    return explanations.slice(0, expectedCount);
  }

  /**
   * Extract trail metadata from GeoJSON features for explanation generation.
   * Pulls trail names, surface types, water features, and green spaces
   * from trail data and land-use data.
   *
   * @param {Object} routeGeoJSON - Route GeoJSON FeatureCollection
   * @param {Object} trailData - Trail GeoJSON FeatureCollection
   * @param {Object|null} landUseData - Land-use GeoJSON FeatureCollection
   * @returns {{ trailNames: string[], surfaces: string[], waterFeatures: string[], greenSpaces: string[] }}
   */
  _extractTrailMetadata(routeGeoJSON, trailData, landUseData) {
    const trailNames = new Set();
    const surfaces = new Set();
    const waterFeatures = new Set();
    const greenSpaces = new Set();

    // Extract from trail features
    if (trailData?.features) {
      for (const feature of trailData.features) {
        const props = feature.properties || {};

        // Trail names: unique name or relationName values
        if (props.name) trailNames.add(props.name);
        if (props.relationName) trailNames.add(props.relationName);

        // Surfaces: unique surface values
        if (props.surface) surfaces.add(props.surface);

        // Water features: natural=water or waterway is set
        if (props.natural === 'water' || props.waterway) {
          if (props.name) waterFeatures.add(props.name);
        }
      }
    }

    // Extract green spaces from land-use data
    if (landUseData?.features) {
      for (const feature of landUseData.features) {
        const props = feature.properties || {};

        // Green spaces: features with leisure or landuse tags
        if (props.leisure || props.landuse) {
          if (props.name) greenSpaces.add(props.name);
        }
      }
    }

    return {
      trailNames: [...trailNames],
      surfaces: [...surfaces],
      waterFeatures: [...waterFeatures],
      greenSpaces: [...greenSpaces]
    };
  }
}
