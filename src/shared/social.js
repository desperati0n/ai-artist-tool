

const getSocialIcon = (url) => {
            const u = url.toLowerCase();
            if (u.includes('pixiv.net')) return 'Px';
            if (u.includes('twitter.com') || u.includes('x.com')) return 'X';
            if (u.includes('skeb.jp')) return 'Sk';
            if (u.includes('fanbox.cc') || u.includes('pixiv.net/fanbox')) return 'Fb';
            if (u.includes('patreon.com')) return 'Pa';
            if (u.includes('deviantart.com')) return 'DA';
            if (u.includes('tumblr.com')) return 'Tu';
            if (u.includes('instagram.com')) return 'Ig';
            if (u.includes('artstation.com')) return 'AS';
            if (u.includes('furaffinity.net')) return 'FA';
            if (u.includes('nicovideo.jp') || u.includes('nico.ms')) return 'Nc';
            if (u.includes('youtube.com') || u.includes('youtu.be')) return 'Yt';
            if (u.includes('reddit.com')) return 'Re';
            if (u.includes('github.com')) return 'Gh';
            if (u.includes('lofter.com')) return 'Lo';
            if (u.includes('weibo.com') || u.includes('weibo.cn')) return 'Wb';
            if (u.includes('bilibili.com')) return 'Bi';
            if (u.includes('booth.pm')) return 'Bo';
            if (u.includes('misskey') || u.includes('mastodon')) return 'Ms';
            if (u.includes('bsky.app')) return 'Bs';
            if (u.includes('newgrounds.com')) return 'NG';
            if (u.includes('ko-fi.com')) return 'Ko';
            if (u.includes('lit.link') || u.includes('linktr.ee')) return 'Lk';
            try { const h = new URL(url).hostname.replace('www.',''); return h.slice(0,2).toUpperCase(); } catch(e) { return '🔗'; }
        };

export { getSocialIcon };
