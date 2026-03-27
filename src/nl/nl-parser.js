/**
 * Natural language parser that converts user route descriptions
 * into structured weight adjustments for the RouteScorer.
 *
 * Uses Claude Haiku 4.5 via ClaudeClient to interpret vibes like
 * "shady waterfront trail" or "fast road run" into scoring weights
 * and boolean feature preferences.
 *
 * Graceful degradation: returns null on any error, allowing the
 * scoring pipeline to continue with default/region weights.
 */
import { NL_PARSER_SYSTEM_PROMPT, WEIGHT_SCHEMA } from './prompt-templates.js';

export class NLParser {
  /**
   * Create an NLParser instance.
   * @param {import('./claude-client.js').ClaudeClient} claudeClient - Claude API client instance
   */
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
  }

  /**
   * Parse a natural language route description into weight adjustments.
   *
   * @param {string|null|undefined} userText - Free-text route description
   * @returns {Promise<{weights: Object, preferences: Object, vibeKeywords: string[]}|null>}
   *   Parsed result or null if input is empty or API call fails
   */
  async parse(userText) {
    // Guard: falsy input returns null without calling the API
    if (!userText || typeof userText !== 'string' || userText.trim() === '') {
      return null;
    }

    try {
      const result = await this.claudeClient.complete(
        NL_PARSER_SYSTEM_PROMPT,
        userText,
        WEIGHT_SCHEMA,
        { maxTokens: 512 }
      );

      // Validate result has required fields
      if (!result || !result.weights || !result.preferences || !result.vibeKeywords) {
        console.warn('NLParser: Claude returned incomplete result', result);
        return null;
      }

      // Clamp each weight value to [0, 1] range
      for (const key of Object.keys(result.weights)) {
        const val = result.weights[key];
        if (typeof val === 'number') {
          result.weights[key] = Math.max(0, Math.min(1, val));
        }
      }

      return {
        weights: result.weights,
        preferences: result.preferences,
        vibeKeywords: result.vibeKeywords
      };
    } catch (error) {
      console.warn('NLParser: Failed to parse natural language input', error.message);
      return null;
    }
  }
}
