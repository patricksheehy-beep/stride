/**
 * Claude API client for direct browser access.
 * Wraps fetch() calls to the Claude Messages API with CORS support
 * via the anthropic-dangerous-direct-browser-access header.
 *
 * This is used by NLParser and RouteExplainer to call Claude
 * directly from the PWA without a backend proxy.
 */
export class ClaudeClient {
  /**
   * Create a ClaudeClient instance.
   * @param {string} apiKey - Anthropic API key (from localStorage)
   */
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.endpoint = 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Send a completion request to the Claude Messages API.
   *
   * @param {string} systemPrompt - System-level instructions
   * @param {string} userMessage - User message content
   * @param {Object|null} [outputSchema=null] - JSON schema for structured outputs.
   *   When provided, adds output_config.format to the request body and parses
   *   the response text as JSON.
   * @param {Object} [options={}] - Optional overrides
   * @param {string} [options.model] - Model ID (defaults to 'claude-haiku-4-5-20250514')
   * @param {number} [options.maxTokens] - Max tokens (defaults to 1024)
   * @returns {Promise<Object|string>} Parsed JSON object if outputSchema provided, raw text otherwise
   * @throws {Error} On non-ok HTTP response with status and error message
   */
  async complete(systemPrompt, userMessage, outputSchema = null, options = {}) {
    const body = {
      model: options.model || 'claude-haiku-4-5-20250514',
      max_tokens: options.maxTokens || 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    };

    if (outputSchema) {
      body.output_config = {
        format: {
          type: 'json_schema',
          schema: outputSchema
        }
      };
    }

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Claude API error: ${response.status} - ${err.error?.message || 'Unknown'}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    return outputSchema ? JSON.parse(text) : text;
  }
}
