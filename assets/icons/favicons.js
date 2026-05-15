(function (global) {
  const FAVICONS = {
    'index.html': '🧰',
    'tools/clipboard.html': '🔗',
    'tools/video-compare.html': '🎬',
    'tools/image-compare.html': '🖼️',
    'tools/pdf-compare.html': '📄',
    'tools/pdf-to-image.html': '🧾',
    'tools/icons.html': '🎨',
  };

  function buildFaviconHref(emoji) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${emoji}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function resolvePageKey(pathname) {
    const normalized = (pathname || '').replace(/\/+$/, '');
    const candidates = Object.keys(FAVICONS).sort((a, b) => b.length - a.length);
    for (const key of candidates) {
      if (normalized.endsWith('/' + key) || normalized.endsWith(key)) return key;
    }
    if (normalized === '' || (pathname || '').endsWith('/')) return 'index.html';
    return null;
  }

  function setFavicon(emoji) {
    if (!emoji || typeof document === 'undefined') return;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      (document.head || document.documentElement).appendChild(link);
    }
    link.href = buildFaviconHref(emoji);
  }

  function applyCurrent() {
    if (typeof location === 'undefined') return;
    const key = resolvePageKey(location.pathname);
    if (key && FAVICONS[key]) setFavicon(FAVICONS[key]);
  }

  global.Favicons = { MAP: FAVICONS, resolvePageKey, setFavicon, applyCurrent, buildFaviconHref };

  if (typeof document !== 'undefined') applyCurrent();
})(typeof window !== 'undefined' ? window : globalThis);
