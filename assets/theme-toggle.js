(function (global) {
  const STORAGE_KEY = 'f-tools-theme';
  const TITLES = {
    auto: '跟随系统（点击切到亮色）',
    light: '亮色（点击切到暗色）',
    dark: '暗色（点击切到跟随系统）',
  };

  function getPref() {
    let p = null;
    try { p = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    return p === 'light' || p === 'dark' ? p : 'auto';
  }

  function applyThemeAttrs(pref) {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const actual = pref === 'auto' ? (mql.matches ? 'dark' : 'light') : pref;
    document.documentElement.setAttribute('data-theme', actual);
    document.documentElement.setAttribute('data-theme-pref', pref);
    return actual;
  }

  function setPref(pref) {
    try {
      if (pref === 'auto') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, pref);
    } catch (e) {}
    applyThemeAttrs(pref);
  }

  // 同步应用一次，避免 FOUC
  applyThemeAttrs(getPref());

  const PREF_TO_ICON = { auto: 'icon-computer', light: 'icon-sun', dark: 'icon-moon' };

  function create() {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'icon-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', '切换主题');

    function refresh() {
      const pref = getPref();
      btn.dataset.pref = pref;
      btn.title = TITLES[pref];
      for (const cls of Object.values(PREF_TO_ICON)) btn.classList.remove(cls);
      btn.classList.add(PREF_TO_ICON[pref]);
    }

    refresh();

    btn.addEventListener('click', () => {
      const cur = getPref();
      setPref(cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto');
      refresh();
    });

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    mql.addEventListener('change', () => {
      if (getPref() === 'auto') {
        applyThemeAttrs('auto');
        refresh();
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY) return;
      applyThemeAttrs(getPref());
      refresh();
    });

    return btn;
  }

  global.ThemeToggle = { create };
})(window);
