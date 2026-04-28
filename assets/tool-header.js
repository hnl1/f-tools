(function (global) {
  const STORAGE_KEY = 'f-tools-theme';
  const ICONS = {
    auto: { icon: '🖥️', title: '跟随系统（点击切到亮色）' },
    light: { icon: '☀️', title: '亮色（点击切到暗色）' },
    dark: { icon: '🌙', title: '暗色（点击切到跟随系统）' },
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

  applyThemeAttrs(getPref());

  function createBackLink(href, label) {
    const a = document.createElement('a');
    a.className = 'back-link';
    a.href = href;
    a.setAttribute('aria-label', label);
    a.title = label;
    return a;
  }

  function createThemeToggle() {
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.type = 'button';
    btn.title = '切换主题';

    function refresh() {
      const pref = getPref();
      btn.textContent = ICONS[pref].icon;
      btn.title = ICONS[pref].title;
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

  function mount(options) {
    options = options || {};
    const title = options.title || '';
    const controls = Array.isArray(options.controls) ? options.controls : [];
    const back = options.back || '../index.html';
    const includeTheme = options.themeToggle !== false;

    if (!document.body) {
      throw new Error('ToolHeader.mount must run after <body> is available');
    }

    const header = document.createElement('header');
    header.className = 'tool-header';

    header.appendChild(createBackLink(back, '主页'));

    const h1 = document.createElement('h1');
    h1.textContent = title;
    header.appendChild(h1);

    const actions = document.createElement('div');
    actions.className = 'header-actions';
    controls.forEach((el) => { if (el) actions.appendChild(el); });

    let themeBtn = null;
    if (includeTheme) {
      themeBtn = createThemeToggle();
      actions.appendChild(themeBtn);
    }
    if (actions.childNodes.length) header.appendChild(actions);

    document.body.insertBefore(header, document.body.firstChild);

    return { headerEl: header, controlsEl: actions, themeBtn };
  }

  global.ToolHeader = { mount };
})(window);
