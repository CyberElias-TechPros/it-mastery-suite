import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiFetch, errorMessage, getAccessToken, setAccessToken } from '@/lib/api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('api client', () => {
  beforeEach(() => {
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('sends the bearer token and unwraps the envelope', async () => {
    setAccessToken('token-123');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: { id: 'abc' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.get<{ id: string }>('/tickets/abc');

    expect(result).toEqual({ id: 'abc' });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Headers).get('authorization')).toBe('Bearer token-123');
    expect(init.credentials).toBe('include');
  });

  it('drops empty query parameters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await api.get('/tickets', { status: 'open', search: '', priority: undefined, page: 2 });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('status=open');
    expect(url).toContain('page=2');
    expect(url).not.toContain('search=');
    expect(url).not.toContain('priority');
  });

  it('throws a typed ApiError carrying the first field error', async () => {
    // A fresh Response per call: bodies can only be read once.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        jsonResponse(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Validation failed',
              details: { title: ['Title is too short'] },
              requestId: 'req-1',
            },
          },
          422,
        ),
      ),
    );

    await expect(api.post('/tickets', {})).rejects.toBeInstanceOf(ApiError);

    try {
      await api.post('/tickets', {});
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(422);
      expect((error as ApiError).firstFieldError).toBe('Title is too short');
      expect(errorMessage(error)).toBe('Title is too short');
    }
  });

  it('refreshes once on a 401 and replays the original request', async () => {
    const fetchMock = vi
      .fn()
      // original request → unauthorised
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401))
      // refresh call
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh-token', expiresIn: 900 } }))
      // replayed request
      .mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ ok: boolean }>('/dashboard');

    expect(result.data).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getAccessToken()).toBe('fresh-token');
  });

  it('gives up when the refresh itself fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'Expired' } }, 401))
      .mockResolvedValueOnce(jsonResponse({ error: { code: 'UNAUTHORIZED', message: 'No session' } }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/dashboard')).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });
});
