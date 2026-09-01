const test = require('node:test');
const assert = require('node:assert/strict');

const {
    canonicalArtistKey,
    deduplicateArtists,
    findEquivalentArtist
} = require('../artist_identity.js');

test('space and underscore variants share one artist identity', () => {
    const variants = ['A(apple)', 'A_(apple)', 'A (apple)', 'Ａ＿（apple）'];
    const keys = new Set(variants.map(canonicalArtistKey));
    assert.equal(keys.size, 1);
});

test('asterisk remains significant', () => {
    assert.notEqual(canonicalArtistKey('A*(apple)'), canonicalArtistKey('A(apple)'));
});

test('deduplication keeps the first id and merges useful metadata', () => {
    const result = deduplicateArtists([
        {
            id: 'first',
            name: 'A (apple)',
            tag: 'A (apple)',
            categories: ['收藏'],
            socialLinks: ['https://example.com/a'],
            danbooruCount: 12,
            createdAt: 20
        },
        {
            id: 'second',
            name: 'A_(apple)',
            tag: 'A_(apple)',
            categories: ['厚涂'],
            socialLinks: ['https://example.com/b'],
            danbooruCount: 30,
            createdAt: 10
        },
        { id: 'third', name: 'A*(apple)', tag: 'A*(apple)', categories: [] }
    ]);

    assert.equal(result.duplicateCount, 1);
    assert.equal(result.artists.length, 2);
    assert.equal(result.artists[0].id, 'first');
    assert.deepEqual(result.artists[0].categories, ['收藏', '厚涂']);
    assert.deepEqual(result.artists[0].socialLinks, ['https://example.com/a', 'https://example.com/b']);
    assert.equal(result.artists[0].danbooruCount, 30);
    assert.equal(result.artists[0].createdAt, 10);
    assert.equal(result.idMap.get('second'), 'first');
});

test('equivalent lookup is used to enforce set semantics', () => {
    const artists = [{ id: '1', name: 'A (apple)', tag: 'A (apple)' }];
    assert.equal(findEquivalentArtist(artists, { tag: 'a_(apple)' }).id, '1');
    assert.equal(findEquivalentArtist(artists, { tag: 'A*(apple)' }), undefined);
    assert.equal(findEquivalentArtist(artists, { tag: 'A(apple)' }, '1'), undefined);
});
