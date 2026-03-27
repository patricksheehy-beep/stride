/**
 * System prompts and JSON schemas for NL parsing and route explanation.
 * Used by NLParser to convert user route descriptions
 * into structured weight adjustments and preferences,
 * and by RouteExplainer to generate human-readable route explanations.
 */

/**
 * System prompt for the NL route preference parser.
 * Instructs Claude to parse natural language descriptions
 * into scoring weights and feature preferences.
 */
export const NL_PARSER_SYSTEM_PROMPT = `You are a running route preference parser for the Stride app. The user will describe the kind of run they want in natural language. Parse their description into scoring weights and feature preferences.

Scoring weights control how routes are ranked:
- surface: preference for smooth, well-maintained running surfaces (high = prefer paved/gravel, low = don't care)
- continuity: preference for routes with smooth flow and few sharp turns (high = prefer flowing routes)
- trailPreference: preference for trails and paths over roads (high = off-road, low = roads OK)
- scenic: preference for routes near water features, named trails, and scenic landmarks
- greenSpace: preference for routes through parks, forests, and nature areas

Return relative importance values between 0 and 1 for each weight. They do NOT need to sum to 1 -- normalization happens in code.

Feature preferences are boolean flags indicating specific environmental preferences.

Vibe keywords are 2-5 words that capture the essence of the user's request.`;

/**
 * JSON schema for Claude structured outputs.
 * Defines the expected shape of NL parser responses:
 * weights (5 scoring factors), preferences (7 boolean flags),
 * and vibeKeywords (array of descriptive strings).
 */
export const WEIGHT_SCHEMA = {
  type: 'object',
  properties: {
    weights: {
      type: 'object',
      properties: {
        surface: { type: 'number' },
        continuity: { type: 'number' },
        trailPreference: { type: 'number' },
        scenic: { type: 'number' },
        greenSpace: { type: 'number' }
      },
      required: ['surface', 'continuity', 'trailPreference', 'scenic', 'greenSpace']
    },
    preferences: {
      type: 'object',
      properties: {
        preferWater: { type: 'boolean' },
        preferParks: { type: 'boolean' },
        preferForest: { type: 'boolean' },
        preferHills: { type: 'boolean' },
        preferFlat: { type: 'boolean' },
        preferPaved: { type: 'boolean' },
        preferTrails: { type: 'boolean' }
      },
      required: ['preferWater', 'preferParks', 'preferForest', 'preferHills', 'preferFlat', 'preferPaved', 'preferTrails']
    },
    vibeKeywords: {
      type: 'array',
      items: { type: 'string' }
    }
  },
  required: ['weights', 'preferences', 'vibeKeywords'],
  additionalProperties: false
};

/**
 * System prompt for the route quality explainer.
 * Instructs Claude to generate human-readable explanations
 * of why a route was recommended, referencing specific details.
 */
export const EXPLAINER_SYSTEM_PROMPT = `You are a running route quality explainer for the Stride app. Given a route's scoring breakdown and trail metadata, write a concise 2-3 sentence explanation of why this route was recommended.

Reference specific details: trail names, surface types, parks or water features nearby, and what makes the route good for running. Be enthusiastic but honest. If the route scores poorly on some factor, mention it briefly as a tradeoff.

Write in second person ("You'll run along..."). Keep it under 100 words.`;
