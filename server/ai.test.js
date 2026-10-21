import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { identifyDish, parseIdentifyResponse, AIError } from './ai.js';

const reply = (content) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

describe('parseIdentifyResponse', () => {
  it('parses plain JSON', () => {
    expect(parseIdentifyResponse('{"dish_guess":"biryani","confidence":0.8}')).toEqual({
      dish_guess: 'biryani',
      confidence: 0.8,
    });
  });

  it('parses JSON inside reasoning and code fences', () => {
    const text =
      '<think>Looks like {rice} dish</think>\nHere you go:\n```json\n{"dish_guess": "nihari", "confidence": 0.65}\n```';
    expect(parseIdentifyResponse(text)).toEqual({ dish_guess: 'nihari', confidence: 0.65 });
  });

  it.each([
    ['no JSON', 'I think it is biryani'],
    ['confidence above 1', '{"dish_guess":"haleem","confidence":1.5}'],
    ['missing dish_guess', '{"confidence":0.5}'],
    ['empty dish_guess', '{"dish_guess":"  ","confidence":0.5}'],
  ])('rejects %s', (_label, text) => {
    expect(() => parseIdentifyResponse(text)).toThrow(AIError);
  });
});

describe('identifyDish', () => {
  beforeEach(() => {
    vi.stubEnv('GROQ_API_KEY', 'test-key');
    vi.stubEnv('GROQ_VISION_MODEL', 'vision-model');
    vi.stubEnv('GROQ_TEXT_MODEL', 'text-model');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses the text model for a typed name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"dish_guess":"chai","confidence":0.9}'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await identifyDish({ name: 'chai' });
    expect(result).toEqual({ dish_guess: 'chai', confidence: 0.9 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('text-model');
  });

  it('sends images as a base64 data URL to the vision model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"dish_guess":"haleem","confidence":0.7}'));
    vi.stubGlobal('fetch', fetchMock);
    await identifyDish({ imageBuffer: Buffer.from('abc'), mimeType: 'image/png' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('vision-model');
    expect(body.messages[1].content[1].image_url.url).toBe('data:image/png;base64,YWJj');
  });

  it('retries once after unusable output', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply('no json here'))
      .mockResolvedValueOnce(reply('{"dish_guess":"biryani","confidence":0.8}'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await identifyDish({ name: 'biryani' });
    expect(result.dish_guess).toBe('biryani');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AIError after two unusable outputs', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"dish_guess":"x","confidence":3}'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(identifyDish({ name: 'x' })).rejects.toBeInstanceOf(AIError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws AIError 503 when the key is missing', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn());
    await expect(identifyDish({ name: 'chai' })).rejects.toMatchObject({ status: 503 });
  });

  it('turns network errors into AIError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom')));
    await expect(identifyDish({ name: 'chai' })).rejects.toMatchObject({ status: 502 });
  });
});
