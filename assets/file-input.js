(function (global) {
  function toElement(value) {
    if (!value) return null;
    return typeof value === 'string' ? document.querySelector(value) : value;
  }

  async function getFilesFromClipboard(clipboardData) {
    if (!clipboardData) return [];
    return getFilesFromDataTransfer(clipboardData);
  }

  function readEntryFile(entry) {
    return new Promise((resolve) => {
      entry.file((file) => resolve(file), () => resolve(null));
    });
  }

  function readAllDirectoryEntries(reader) {
    return new Promise((resolve) => {
      const entries = [];

      function readNextBatch() {
        reader.readEntries((batch) => {
          if (!batch.length) {
            resolve(entries);
            return;
          }

          entries.push(...batch);
          readNextBatch();
        }, () => resolve(entries));
      }

      readNextBatch();
    });
  }

  async function getFilesFromEntry(entry) {
    if (!entry) return [];
    if (entry.isFile) {
      const file = await readEntryFile(entry);
      return file ? [file] : [];
    }
    if (!entry.isDirectory) return [];

    const entries = await readAllDirectoryEntries(entry.createReader());
    const nestedFiles = await Promise.all(entries.map(getFilesFromEntry));
    return nestedFiles.flat();
  }

  async function getFilesFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return [];

    const items = Array.from(dataTransfer.items || []);
    const entries = items
      .filter((item) => item.kind === 'file' && typeof item.webkitGetAsEntry === 'function')
      .map((item) => item.webkitGetAsEntry())
      .filter(Boolean);

    if (!entries.length) return Array.from(dataTransfer.files || []);

    const files = (await Promise.all(entries.map(getFilesFromEntry))).flat();
    return files.length ? files : Array.from(dataTransfer.files || []);
  }

  function isFileDrag(event) {
    return Array.from((event.dataTransfer && event.dataTransfer.types) || []).includes('Files');
  }

  function matchesAccept(file, accept) {
    if (!accept) return true;

    const fileName = file.name || '';
    const fileType = file.type || '';
    return accept
      .split(',')
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
      .some((token) => {
        if (token.startsWith('.')) return fileName.toLowerCase().endsWith(token);
        if (token.endsWith('/*')) return fileType.toLowerCase().startsWith(token.slice(0, -1));
        return fileType.toLowerCase() === token;
      });
  }

  function summarizeFiles(files) {
    if (files.length === 1) return files[0].name || '已选择 1 个文件';
    return `已选择 ${files.length} 个文件`;
  }

  function spaceBeforeSubject(subject) {
    return /^[A-Za-z0-9]/.test(subject) ? ' ' : '';
  }

  function formatDropTitle(subject) {
    if (!subject) return '';
    const sp = spaceBeforeSubject(subject);
    return `拖入${sp}${subject}/文件夹、粘贴或点击添加${sp}${subject}`;
  }

  function formatRejectedText(subject) {
    if (!subject) return '没有可用的文件，请检查文件类型。';
    const sp = spaceBeforeSubject(subject);
    return `没有可用的${sp}${subject}，请使用${sp}${subject}文件。`;
  }

  function bindFileInputDropZone(options) {
    const zone = toElement(options.zone);
    const input = toElement(options.input);
    const triggerElement = toElement(options.triggerElement || options.dropZone || options.button);
    const triggerButton = toElement(options.triggerButton);
    const status = toElement(options.status);
    const onFiles = options.onFiles;
    const accept = options.accept || (input && input.accept) || '';
    const multiple = options.multiple != null ? options.multiple : Boolean(input && input.multiple);
    const subject = options.subject || '';
    const emptyText = options.emptyText || '';
    const acceptedText = options.acceptedText || summarizeFiles;
    const rejectedText = options.rejectedText || formatRejectedText(subject);

    if (!zone || !input || typeof onFiles !== 'function') {
      throw new Error('bindFileInputDropZone requires zone, input, and onFiles.');
    }

    if (subject) {
      const titleEl = zone.querySelector('.file-drop-title');
      if (titleEl) titleEl.textContent = formatDropTitle(subject);
    }
    const sourceLabels = Object.assign({
      choose: '选择',
      drop: '拖入',
      paste: '粘贴',
    }, options.sourceLabels || {});

    let hasItems = false;
    let triggerShownOnce = false;
    let triggerIntroTimer = 0;
    let triggerTooltipTimer = 0;
    let triggerTooltipEl = null;

    function ensureTriggerTooltip() {
      if (triggerTooltipEl || !triggerButton || !subject) return triggerTooltipEl;
      triggerTooltipEl = document.createElement('div');
      triggerTooltipEl.className = 'file-input-trigger-tooltip';
      triggerTooltipEl.setAttribute('role', 'tooltip');
      triggerTooltipEl.textContent = formatDropTitle(subject);
      triggerTooltipEl.hidden = true;
      document.body.appendChild(triggerTooltipEl);
      return triggerTooltipEl;
    }

    function positionTriggerTooltip() {
      if (!triggerTooltipEl || !triggerButton) return;
      const rect = triggerButton.getBoundingClientRect();
      triggerTooltipEl.style.left = `${rect.left + rect.width / 2}px`;
      triggerTooltipEl.style.top = `${rect.bottom + 8}px`;
    }

    function showTriggerTooltip() {
      if (!triggerButton || triggerButton.hidden) return;
      ensureTriggerTooltip();
      if (!triggerTooltipEl) return;
      positionTriggerTooltip();
      triggerTooltipEl.hidden = false;
      requestAnimationFrame(() => triggerTooltipEl.classList.add('is-visible'));
    }

    function hideTriggerTooltip() {
      clearTimeout(triggerTooltipTimer);
      if (!triggerTooltipEl) return;
      triggerTooltipEl.classList.remove('is-visible');
      triggerTooltipEl.hidden = true;
    }

    function playTriggerIntro() {
      if (!triggerButton) return;
      clearTimeout(triggerIntroTimer);
      clearTimeout(triggerTooltipTimer);
      triggerButton.classList.remove('is-newly-visible');
      void triggerButton.offsetWidth;
      triggerButton.classList.add('is-newly-visible');
      showTriggerTooltip();
      triggerIntroTimer = setTimeout(() => {
        triggerButton.classList.remove('is-newly-visible');
      }, 1700);
      triggerTooltipTimer = setTimeout(hideTriggerTooltip, 2200);
    }

    function setHasItems(value) {
      const next = Boolean(value);
      if (next === hasItems) return;
      hasItems = next;
      zone.classList.toggle('is-collapsed', hasItems);
      if (!triggerButton) return;
      triggerButton.hidden = !hasItems;
      if (hasItems) {
        if (!triggerShownOnce) {
          triggerShownOnce = true;
          playTriggerIntro();
        }
      } else {
        hideTriggerTooltip();
      }
    }

    const statusId = status && status.id;

    if (!zone.hasAttribute('tabindex')) zone.setAttribute('tabindex', '0');
    if (!zone.hasAttribute('role')) zone.setAttribute('role', 'button');

    function setStatus(message, isError) {
      const hasMessage = Boolean(message);
      zone.classList.toggle('has-error', Boolean(isError));
      if (status) {
        status.textContent = message;
        status.hidden = !hasMessage;
      }
      if (statusId) {
        const describedBy = (zone.getAttribute('aria-describedby') || '')
          .trim()
          .split(/\s+/)
          .filter(Boolean);
        const nextDescribedBy = hasMessage
          ? Array.from(new Set([...describedBy, statusId]))
          : describedBy.filter((id) => id !== statusId);
        if (nextDescribedBy.length) {
          zone.setAttribute('aria-describedby', nextDescribedBy.join(' '));
        } else {
          zone.removeAttribute('aria-describedby');
        }
      }
      if (typeof options.onStatus === 'function') options.onStatus(message, Boolean(isError));
    }

    function setDragging(isDragging) {
      zone.classList.toggle('dragging', isDragging);
    }

    function acceptFiles(fileList, source) {
      const incoming = Array.from(fileList || []);
      if (!incoming.length) return false;

      const accepted = incoming.filter((file) => matchesAccept(file, accept));
      const files = multiple ? accepted : accepted.slice(0, 1);
      if (!files.length) {
        setStatus(typeof rejectedText === 'function' ? rejectedText(incoming, sourceLabels[source]) : rejectedText, true);
        return false;
      }

      const message = typeof acceptedText === 'function'
        ? acceptedText(files, sourceLabels[source])
        : acceptedText;
      if (message) setStatus(message, false);
      onFiles(files, { source, sourceLabel: sourceLabels[source], allFiles: incoming });
      return true;
    }

    input.addEventListener('change', () => {
      acceptFiles(input.files, 'choose');
      input.value = '';
    });

    function openFilePicker(event) {
      if (event) event.preventDefault();
      input.click();
    }

    if (triggerElement && triggerElement !== zone) {
      triggerElement.addEventListener('click', openFilePicker);
    }

    if (triggerButton) {
      triggerButton.classList.add('file-input-trigger');
      triggerButton.hidden = true;
      triggerButton.addEventListener('click', openFilePicker);
      triggerButton.addEventListener('mouseenter', showTriggerTooltip);
      triggerButton.addEventListener('focus', showTriggerTooltip);
      triggerButton.addEventListener('mouseleave', hideTriggerTooltip);
      triggerButton.addEventListener('blur', hideTriggerTooltip);
      window.addEventListener('resize', () => {
        if (triggerTooltipEl && !triggerTooltipEl.hidden) positionTriggerTooltip();
      });
    }

    zone.addEventListener('click', (event) => {
      if (event.defaultPrevented || event.target === input) return;
      if (event.target.closest('button, a, input, select, textarea, label')) return;
      openFilePicker(event);
    });

    zone.addEventListener('keydown', (event) => {
      if (event.target !== zone) return;
      if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
      openFilePicker(event);
    });

    document.addEventListener('dragenter', (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      setDragging(true);
    });

    document.addEventListener('dragover', (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      setDragging(true);
    });

    document.addEventListener('dragleave', (event) => {
      if (
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight
      ) {
        setDragging(false);
      }
    });

    document.addEventListener('drop', async (event) => {
      if (!isFileDrag(event) && !(event.dataTransfer && event.dataTransfer.files.length)) return;
      event.preventDefault();
      setDragging(false);
      const files = await getFilesFromDataTransfer(event.dataTransfer);
      acceptFiles(files, 'drop');
    });

    document.addEventListener('paste', async (event) => {
      const files = await getFilesFromClipboard(event.clipboardData);
      if (!files.length) return;

      if (acceptFiles(files, 'paste')) {
        event.preventDefault();
      }
    });

    if (emptyText) setStatus(emptyText, false);

    return {
      setStatus,
      setHasItems,
      clear() {
        input.value = '';
        setStatus(emptyText, false);
        setHasItems(false);
      },
    };
  }

  global.FileInputDropZone = {
    bind: bindFileInputDropZone,
    formatDropTitle,
    formatRejectedText,
  };
})(window);
