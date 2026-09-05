

const stripArtistPrefix = (raw) => raw.trim().replace(/^artist:\s*/i, '').trim();

const parsePromptInput = (text) => {
            text = text.trim();
            if (!text) return [];
            const results = []; // { tag, weight }

            // NAI format uses '::' as delimiter.
            // Valid forms per spec:
            //   weight::artist1, artist2::   - weighted group
            //   artist1, artist2             - bare comma-separated (weight = 1.0)
            //   Mixed: 0.8::artistA::, artistB, 1.2::artistD, artistE::
            // Weight MUST be a proper decimal number (≥1 digit before or after dot).
            // This prevents artist names containing digits from being mis-parsed as weights.

            const hasNaiSyntax = text.includes('::');

            if (hasNaiSyntax) {
                // Strict weight pattern: requires at least one digit group.
                // Matches:  0.8::content::   1::content::   1.0::content::
                // Does NOT match: ::content:: (no leading digits → treated as bare text)
                // Does NOT match: 1girl::content:: (1girl has letters, regex can't consume past digit)
                const naiGroupRegex = /(\d+(?:\.\d+)?)\s*::\s*((?:[^:]|:(?!:))+?)\s*::/g;
                const groupMatches = [];
                let match;

                while ((match = naiGroupRegex.exec(text)) !== null) {
                    groupMatches.push({
                        weight: parseFloat(match[1]),
                        content: match[2],
                        start: match.index,
                        end: match.index + match[0].length
                    });
                }

                // Walk through text, collecting bare segments between weighted groups
                let cursor = 0;
                for (const gm of groupMatches) {
                    if (gm.start > cursor) {
                        // Bare text before this weighted group
                        const bareText = text.slice(cursor, gm.start).trim().replace(/^[,\s]+|[,\s]+$/g, '');
                        if (bareText) {
                            bareText.split(',').forEach(t => {
                                const tag = stripArtistPrefix(t);
                                if (tag) results.push({ tag, weight: 1.0 });
                            });
                        }
                    }
                    // Weighted group
                    const weight = (isNaN(gm.weight) || gm.weight <= 0) ? 1.0 : Math.round(gm.weight * 10) / 10;
                    gm.content.split(',').forEach(t => {
                        const tag = stripArtistPrefix(t);
                        if (tag) results.push({ tag, weight });
                    });
                    cursor = gm.end;
                }
                // Trailing bare text after last weighted group
                if (cursor < text.length) {
                    const bareText = text.slice(cursor).trim().replace(/^[,\s]+|[,\s]+$/g, '');
                    if (bareText) {
                        bareText.split(',').forEach(t => {
                            const tag = stripArtistPrefix(t);
                            if (tag) results.push({ tag, weight: 1.0 });
                        });
                    }
                }
            } else {
                // No '::' → try WebUI format or plain comma list
                text.split(',').forEach(token => {
                    token = token.trim();
                    if (!token) return;
                    // WebUI weighted: (tag:1.1)
                    const webuiMatch = token.match(/^\(\s*(.+?)\s*:\s*([\d.]+)\s*\)$/);
                    if (webuiMatch) {
                        const tag = stripArtistPrefix(webuiMatch[1]);
                        let w = parseFloat(webuiMatch[2]);
                        if (isNaN(w) || w <= 0) w = 1.0;
                        if (tag) results.push({ tag, weight: Math.round(w * 10) / 10 });
                    } else {
                        const tag = stripArtistPrefix(token.replace(/^\(+|\)+$/g, ''));
                        if (tag) results.push({ tag, weight: 1.0 });
                    }
                });
            }

            return results;
        };

export { stripArtistPrefix, parsePromptInput };
