import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClaudeClient } from '../../src/nl/claude-client.js';

describe('ClaudeClient', () => {
  let client;
  let fetchSpy;

  beforeEach(() => {
    client = new ClaudeClient('test-api-key-123');
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('constructor stores apiKey and sets endpoint', () => {
    expect(client.apiKey).toBe('test-api-key-123');
    expect(client.endpoint).toBe('https://api.anthropic.com/v1/messages');
  });

  it('complete() sends POST with correct headers', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'hello' }] })
    });

    await client.complete('system prompt', 'user message');

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['x-api-key']).toBe('test-api-key-123');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    expect(options.headers['content-type']).toBe('application/json');
    expect(options.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('complete() sends model defaulting to claude-haiku-4-5-20250514', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'response' }] })
    });

    await client.complete('system', 'user');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('claude-haiku-4-5-20250514');
  });

  it('complete() includes output_config.format when outputSchema is provided', async () => {
    const schema = { type: 'object', properties: { name: { type: 'string' } } };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"name":"test"}' }] })
    });

    await client.complete('system', 'user', schema);

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.output_config).toBeDefined();
    expect(body.output_config.format.type).toBe('json_schema');
    expect(body.output_config.format.schema).toEqual(schema);
  });

  it('complete() omits output_config when no outputSchema', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'plain text' }] })
    });

    await client.complete('system', 'user');

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.output_config).toBeUndefined();
  });

  it('complete() parses JSON from content[0].text when outputSchema is provided', async () => {
    const schema = { type: 'object', properties: { value: { type: 'number' } } };
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: '{"value": 42}' }] })
    });

    const result = await client.complete('system', 'user', schema);
    expect(result).toEqual({ value: 42 });
  });

  it('complete() returns raw text when no outputSchema', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'This is a plain text response.' }] })
    });

    const result = await client.complete('system', 'user');
    expect(result).toBe('This is a plain text response.');
  });

  it('complete() throws on non-ok response with error message from API body', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } })
    });

    await expect(client.complete('system', 'user'))
      .rejects
      .toThrow('Claude API error: 401 - Invalid API key');
  });

  it('complete() respects options.model and options.maxTokens overrides', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ text: 'response' }] })
    });

    await client.complete('system', 'user', null, {
      model: 'claude-sonnet-4-5-20250514',
      maxTokens: 2048
    });

    const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(body.model).toBe('claude-sonnet-4-5-20250514');
    expect(body.max_tokens).toBe(2048);
  });
});
