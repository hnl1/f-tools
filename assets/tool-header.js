(function (global) {
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

    header.appendChild(HomeLink.create(back, '主页'));

    let themeBtn = null;
    if (includeTheme) {
      themeBtn = ThemeToggle.create();
      header.appendChild(themeBtn);
    }

    const h1 = document.createElement('h1');
    h1.textContent = title;
    header.appendChild(h1);

    const actions = document.createElement('div');
    actions.className = 'header-actions';
    controls.forEach((el) => { if (el) actions.appendChild(el); });

    let clearBtn = null;
    if (options.clearButton) {
      clearBtn = ClearButton.create(options.clearButton);
      actions.appendChild(clearBtn.el);
    }

    if (actions.childNodes.length) header.appendChild(actions);

    document.body.insertBefore(header, document.body.firstChild);

    return { headerEl: header, controlsEl: actions, themeBtn, clearBtn };
  }

  global.ToolHeader = { mount };
})(window);
