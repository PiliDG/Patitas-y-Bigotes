export function normalizeImageSrc(value) {
  try {
    if (value === undefined || value === null) return '';
    let s = String(value).trim();
    if (!s) return '';
    if (s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:image') || s.startsWith('/') || s.startsWith('blob:')) {
      return s;
    }
    if (s.startsWith('image/') && s.includes('base64,')) {
      return `data:${s}`;
    }
    const compact = s.replace(/\s+/g, '');
    if (/^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 100) {
      return `data:image/jpeg;base64,${compact}`;
    }
    return s;
  } catch {
    return '';
  }
}

// Progressive image loading with blur + vertical reveal
export function applyProgressiveLoading(root = document) {
  try {
    const imgs = Array.from(root.querySelectorAll('img[data-src]:not([data-progressive-bound])'));
    imgs.forEach((el) => {
      el.setAttribute('data-progressive-bound', '');
      const target = el.getAttribute('data-src');
      if (!target) return;
      const real = new Image();
      real.decoding = 'async';
      real.loading = 'eager';
      real.onload = () => {
        try {
          el.src = target;
          el.classList.add('is-loaded', 'reveal-down');
        } catch {}
      };
      real.onerror = () => {
        // keep fallback src; optionally mark error state
        el.setAttribute('data-load-error', 'true');
      };
      real.src = target;
    });
  } catch {}
}
