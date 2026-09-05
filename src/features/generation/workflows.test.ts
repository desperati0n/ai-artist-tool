import {beforeEach, describe, expect, it, vi} from 'vitest';
import {state, createInitialState} from '../../app/store';
import {actions} from '../../app/actions';
import {db} from '../../storage/images';
import {local} from './session';
import {DEFAULTS, PLUGIN_ID} from './config';
import {render, refreshGenerationUi} from './view';
import {run} from './queue';
import {settleReview, settleAllReviews} from './review';
import {generateOne} from '../../services/novelai';
import {convertGeneratedImageToJpeg} from './images';
import {renderAll} from '../../app/render';
import {addLog} from './logs';

vi.mock('../../services/novelai', () => ({generateOne: vi.fn()}));
vi.mock('./images', () => ({convertGeneratedImageToJpeg: vi.fn(), loadImageFlags: vi.fn()}));
vi.mock('../../app/render', () => ({renderAll: vi.fn()}));

const image = 'data:image/png;base64,AA==';
const $ = (selector: string) => document.querySelector<HTMLElement>(`#${PLUGIN_ID} ${selector}`)!;
function resultFor(index: number) {
  const result = {artist: state.artists[index], status: 'done', approved: false, dataUrl: image};
  local.results.set(result.artist.id, result);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(state, createInitialState());
  state.artists = Array.from({length: 80}, (_, i) => ({id: `a${i}`, name: `Artist ${i}`, tag: `artist_${i}`, categories: ['Test']}));
  Object.assign(local, {selected: new Set(['a0', 'a1']), results: new Map(), imageIds: new Set(), imageFlagsReady: true,
    settings: {...DEFAULTS}, search: '', category: '全部', logs: [], key: 'test-key', running: false, paused: false,
    reviewingBatch: false, approvedCount: 0, status: '', progress: 0, abort: null});
  const root = document.createElement('div');
  root.id = PLUGIN_ID;
  document.body.append(root);
  vi.mocked(generateOne).mockReset().mockResolvedValue(image);
  vi.mocked(convertGeneratedImageToJpeg).mockReset().mockResolvedValue('data:image/jpeg;base64,AA==');
  vi.spyOn(db, 'put').mockResolvedValue('/api/image/saved');
  vi.spyOn(actions, 'saveMeta').mockImplementation(() => {});
  render();
});

describe('generation scrolling and review', () => {
  it('appends logs without collapsing open details or pulling the reader to the bottom', () => {
    addLog('info', 'first', {elapsedMs: 20});
    const list = $('[data-nb-log-list]');
    const details = list.querySelector('details')!;
    details.open = true;
    Object.defineProperties(list, {scrollHeight: {value: 1000}, clientHeight: {value: 200}});
    list.scrollTop = 300;
    addLog('info', 'second');
    expect(list.querySelector('details')).toBe(details);
    expect(details.open).toBe(true);
    expect(list.scrollTop).toBe(300);
  });
  it('keeps artist, settings and review containers mounted through generation completion', async () => {
    const artistList = $('[data-nb-artist-list-scroll]');
    const settings = $('.nb-pad');
    const reviewList = $('[data-nb-review-scroll]');
    artistList.scrollTop = 760;
    settings.scrollTop = 90;
    reviewList.scrollTop = 120;
    await run(['a0', 'a1']);
    expect($('[data-nb-artist-list-scroll]')).toBe(artistList);
    expect($('.nb-pad')).toBe(settings);
    expect($('[data-nb-review-scroll]')).toBe(reviewList);
    expect([artistList.scrollTop, settings.scrollTop, reviewList.scrollTop]).toEqual([760, 90, 120]);
    expect(local.results.get('a0').status).toBe('done');
    expect(local.selected.has('a0')).toBe(true);
    expect(db.put).not.toHaveBeenCalled();
  });

  it('keeps a saving card in place and preserves the remaining image DOM on approval', async () => {
    const first = resultFor(0);
    resultFor(1);
    refreshGenerationUi();
    const list = $('[data-nb-artist-list-scroll]');
    list.scrollTop = 640;
    const card = $('[data-nb-review-id="a0"]');
    const remainingImage = $('[data-nb-review-id="a1"] img');
    let finishSave!: (url: string) => void;
    vi.mocked(db.put).mockImplementationOnce(() => new Promise(resolve => {finishSave = resolve;}));
    const pending = settleReview(first, true);
    await vi.waitFor(() => expect(db.put).toHaveBeenCalledOnce());
    expect($('[data-nb-review-id="a0"]')).toBe(card);
    expect(card.querySelector('.nb-review-state')).toHaveTextContent('正在保存');
    expect(card.querySelector('[data-nb-review-action]')).toBeDisabled();
    expect($('[data-nb-artist-list-scroll]')).toBe(list);
    await settleReview(first, true);
    expect(db.put).toHaveBeenCalledOnce();
    finishSave('/api/image/a0');
    await pending;
    expect(list.scrollTop).toBe(640);
    expect($('[data-nb-review-id="a1"] img')).toBe(remainingImage);
    expect(local.selected.has('a0')).toBe(false);
    expect(local.imageIds.has('a0')).toBe(true);
    expect($('.nb-count')).toHaveTextContent('通过 1');
  });

  it('preserves failed saves for retry and reuses the converted image', async () => {
    const result = resultFor(0);
    refreshGenerationUi();
    vi.mocked(db.put).mockRejectedValueOnce(new Error('disk full'));
    expect(await settleReview(result, true)).toBe(false);
    expect(local.results.get('a0')).toBe(result);
    expect(local.selected.has('a0')).toBe(true);
    expect($('[data-nb-review-id="a0"] [data-nb-review-action]')).toBeEnabled();
    expect(await settleReview(result, true)).toBe(true);
    expect(convertGeneratedImageToJpeg).toHaveBeenCalledOnce();
    expect(db.put).toHaveBeenCalledTimes(2);
  });

  it('approves all with one metadata save and one background gallery refresh', async () => {
    for (let i = 0; i < 12; i++) resultFor(i);
    refreshGenerationUi();
    const list = $('[data-nb-artist-list-scroll]');
    list.scrollTop = 1200;
    await settleAllReviews(true);
    expect(db.put).toHaveBeenCalledTimes(12);
    expect(actions.saveMeta).toHaveBeenCalledOnce();
    expect(renderAll).toHaveBeenCalledOnce();
    expect(local.results.size).toBe(0);
    expect(local.approvedCount).toBe(12);
    expect(list.scrollTop).toBe(1200);
    expect($('[data-nb-artist-list-scroll]')).toBe(list);
  });

  it('keeps rejected artists selected and never writes their images', async () => {
    resultFor(0);
    resultFor(1);
    refreshGenerationUi();
    await settleAllReviews(false);
    expect(local.selected).toEqual(new Set(['a0', 'a1']));
    expect(db.put).not.toHaveBeenCalled();
    expect(actions.saveMeta).not.toHaveBeenCalled();
  });

  it('preserves all scroll positions and edited settings on a full filter redraw', () => {
    $('.nb-body').scrollTop = 520;
    $('.nb-pad').scrollTop = 140;
    $('[data-nb-artist-list-scroll]').scrollTop = 800;
    ($('[data-nb-positive]') as HTMLTextAreaElement).value = 'edited draft {artist}';
    render({resetArtistScroll: true});
    expect($('.nb-body').scrollTop).toBe(520);
    expect($('.nb-pad').scrollTop).toBe(140);
    expect($('[data-nb-artist-list-scroll]').scrollTop).toBe(0);
    expect($('[data-nb-positive]')).toHaveValue('edited draft {artist}');
  });
});

describe('sequential queue scheduling', () => {
  it('starts the next request immediately after success, without overlap or a 350ms gap', async () => {
    vi.useFakeTimers();
    let active = 0;
    let maximum = 0;
    const starts: number[] = [];
    vi.mocked(generateOne).mockImplementation(() => {
      starts.push(Date.now());
      maximum = Math.max(maximum, ++active);
      return new Promise(resolve => setTimeout(() => {active--; resolve(image);}, 200));
    });
    const pending = run(['a0', 'a1', 'a2']);
    await vi.advanceTimersByTimeAsync(600);
    await pending;
    expect(starts.map(time => time - starts[0])).toEqual([0, 200, 400]);
    expect(maximum).toBe(1);
  });

  it('pauses after the current request and stops without submitting another', async () => {
    vi.useFakeTimers();
    vi.mocked(generateOne).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(image), 100)));
    const pending = run(['a0', 'a1']);
    local.paused = true;
    await vi.advanceTimersByTimeAsync(1000);
    expect(generateOne).toHaveBeenCalledOnce();
    local.abort!.abort();
    await pending;
    expect(local.running).toBe(false);
    expect(local.status).toContain('已停止');
  });

  it('continues a paused queue without waiting for image approval', async () => {
    vi.useFakeTimers();
    vi.mocked(generateOne).mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(image), 100)));
    const pending = run(['a0', 'a1']);
    local.paused = true;
    await vi.advanceTimersByTimeAsync(100);
    local.paused = false;
    await vi.advanceTimersByTimeAsync(350);
    await pending;
    expect(generateOne).toHaveBeenCalledTimes(2);
    expect(db.put).not.toHaveBeenCalled();
  });

  it('honors a rate-limit cooldown and allows immediate cancellation', async () => {
    vi.useFakeTimers();
    vi.mocked(generateOne).mockRejectedValueOnce(Object.assign(new Error('rate limit'), {status: 429, retryAfterMs: 5000}));
    const pending = run(['a0', 'a1']);
    await vi.advanceTimersByTimeAsync(4999);
    expect(generateOne).toHaveBeenCalledOnce();
    local.abort!.abort();
    await pending;
    expect(generateOne).toHaveBeenCalledOnce();
  });

  it('stops on authentication errors instead of sending the rest of the queue', async () => {
    vi.mocked(generateOne).mockRejectedValueOnce(Object.assign(new Error('unauthorized'), {status: 401}));
    await run(['a0', 'a1']);
    expect(generateOne).toHaveBeenCalledOnce();
    expect(local.status).toContain('认证或权限错误');
  });
});
