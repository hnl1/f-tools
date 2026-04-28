(function (global) {
  function create(href, label) {
    href = href || '../index.html';
    label = label || '主页';
    const a = document.createElement('a');
    a.className = 'back-link icon-btn';
    a.href = href;
    a.setAttribute('aria-label', label);
    a.title = label;
    return a;
  }

  global.HomeLink = { create };
})(window);
