    const canonicalArtistKey = (value) => String(value ?? '')
        .normalize('NFKC')
        .trim()
        .toLowerCase()
        .replace(/^artist:\s*/, '')
        .replace(/[\s_]+/gu, '');

    const normalizeStringList = (values) => [...new Set(
        (Array.isArray(values) ? values : [])
            .filter(value => typeof value === 'string')
            .map(value => value.trim())
            .filter(Boolean)
    )];

    const normalizeArtist = (artist) => {
        const categories = normalizeStringList(
            Array.isArray(artist.categories) ? artist.categories : [artist.category || '未分类']
        );
        return {
            ...artist,
            id: String(artist.id),
            name: artist.name || artist.tag || 'Unknown',
            tag: artist.tag || artist.name || '',
            categories: categories.length ? categories : ['未分类'],
            socialLinks: normalizeStringList(artist.socialLinks)
        };
    };

    const artistKey = (artist) => canonicalArtistKey(artist?.tag || artist?.name || '');

    const mergeArtists = (primary, duplicate) => {
        const primaryCount = Number.parseInt(primary.danbooruCount, 10) || 0;
        const duplicateCount = Number.parseInt(duplicate.danbooruCount, 10) || 0;
        const timestamps = [primary.createdAt, duplicate.createdAt]
            .map(Number)
            .filter(Number.isFinite);
        return {
            ...duplicate,
            ...primary,
            id: String(primary.id),
            name: primary.name || duplicate.name || primary.tag || duplicate.tag || 'Unknown',
            tag: primary.tag || duplicate.tag || primary.name || duplicate.name || '',
            categories: normalizeStringList([...(primary.categories || []), ...(duplicate.categories || [])]),
            socialLinks: normalizeStringList([...(primary.socialLinks || []), ...(duplicate.socialLinks || [])]),
            danbooruCount: Math.max(primaryCount, duplicateCount),
            createdAt: timestamps.length ? Math.min(...timestamps) : Date.now()
        };
    };

    const deduplicateArtists = (items) => {
        const artists = [];
        const keyIndexes = new Map();
        const idMap = new Map();
        let duplicateCount = 0;

        for (const rawArtist of Array.isArray(items) ? items : []) {
            if (!rawArtist || typeof rawArtist !== 'object') continue;
            const artist = normalizeArtist(rawArtist);
            const key = artistKey(artist);
            const existingIndex = key ? keyIndexes.get(key) : undefined;
            if (existingIndex === undefined) {
                const index = artists.push(artist) - 1;
                if (key) keyIndexes.set(key, index);
                idMap.set(String(artist.id), String(artist.id));
                continue;
            }

            const primary = artists[existingIndex];
            artists[existingIndex] = mergeArtists(primary, artist);
            idMap.set(String(artist.id), String(primary.id));
            duplicateCount++;
        }

        return { artists, idMap, duplicateCount };
    };

    const findEquivalentArtist = (items, candidate, excludedId = null) => {
        const key = artistKey(candidate);
        if (!key) return undefined;
        return (Array.isArray(items) ? items : []).find(artist => (
            String(artist.id) !== String(excludedId) && artistKey(artist) === key
        ));
    };


export { canonicalArtistKey, normalizeArtist, mergeArtists, deduplicateArtists, findEquivalentArtist };
