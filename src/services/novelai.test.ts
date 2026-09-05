import {beforeEach, describe, expect, it, vi} from 'vitest';
import {generateOne} from './novelai';
import {local} from '../features/generation/session';

beforeEach(() => {
  local.key = 'test-only';
  local.abort = new AbortController();
  local.logs = [];
});

describe('NovelAI failure metadata', () => {
  it('passes HTTP status and Retry-After through to the sequential scheduler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 429,
      headers: new Headers({'retry-after': '8', 'content-type': 'text/plain'}), text: async () => 'Slow down'}));
    await expect(generateOne({id: 'a', tag: 'test'})).rejects.toMatchObject({status: 429, retryAfterMs: 8000});
  });

  it('supports HTTP-date cooldown headers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 8, 5, 1, 0, 0));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: false, status: 503,
      headers: new Headers({'retry-after': 'Sat, 05 Sep 2026 01:00:10 GMT'}), text: async () => 'Busy'}));
    await expect(generateOne({id: 'a', tag: 'test'})).rejects.toMatchObject({status: 503, retryAfterMs: 10000});
  });
});
