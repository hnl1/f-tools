(function (global) {
  function create(options) {
    options = options || {};
    const onClear = typeof options.onClear === 'function' ? options.onClear : () => {};
    const label = options.label || '清空';

    const btn = document.createElement('button');
    btn.id = 'clear-btn';
    btn.type = 'button';
    btn.className = 'danger';
    btn.textContent = label;
    btn.disabled = true;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      onClear();
    });

    return {
      el: btn,
      setEnabled(enabled) { btn.disabled = !enabled; },
      setCount(n) { btn.disabled = !(typeof n === 'number' && n > 0); },
    };
  }

  global.ClearButton = { create };
})(window);
