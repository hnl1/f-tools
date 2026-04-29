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

  function supportsDirectoryInput() {
    const probe = document.createElement('input');
    probe.type = 'file';
    return 'webkitdirectory' in probe;
  }

  function createDirectoryInput(input) {
    const directoryInput = document.createElement('input');
    directoryInput.type = 'file';
    directoryInput.className = input.className;
    directoryInput.accept = input.accept || '';
    directoryInput.multiple = true;
    directoryInput.tabIndex = -1;
    directoryInput.setAttribute('aria-hidden', 'true');
    directoryInput.setAttribute('webkitdirectory', '');
    directoryInput.setAttribute('directory', '');
    input.insertAdjacentElement('afterend', directoryInput);
    return directoryInput;
  }

  function spaceBeforeSubject(subject) {
    return /^[A-Za-z0-9]/.test(subject) ? ' ' : '';
  }

  function formatDropTitle(subject) {
    if (!subject) return '';
    const sp = spaceBeforeSubject(subject);
    return `拖入${sp}${subject}/文件夹，粘贴或选择资源`;
  }

  function formatChooseFileText(subject) {
    if (!subject) return '选择文件';
    return `选择${spaceBeforeSubject(subject)}${subject}`;
  }

  function formatAddFileText(subject) {
    if (!subject) return '添加文件';
    return `添加${spaceBeforeSubject(subject)}${subject}`;
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
    const allowDirectories = options.allowDirectories !== false && supportsDirectoryInput();

    if (!zone || !input || typeof onFiles !== 'function') {
      throw new Error('bindFileInputDropZone requires zone, input, and onFiles.');
    }

    const directoryInput = allowDirectories ? createDirectoryInput(input) : null;

    if (subject) {
      const titleEl = zone.querySelector('.file-drop-title');
      if (titleEl) titleEl.textContent = formatDropTitle(subject);
    }
    const sourceLabels = Object.assign({
      choose: '选择',
      folder: '选择文件夹',
      drop: '拖入',
      paste: '粘贴',
    }, options.sourceLabels || {});

    let hasItems = false;
    let triggerShownOnce = false;
    let triggerIntroTimer = 0;
    let triggerTooltipTimer = 0;
    let triggerTooltipEl = null;
    let pickerMenuEl = null;

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

    if (directoryInput) {
      directoryInput.addEventListener('change', () => {
        acceptFiles(directoryInput.files, 'folder');
        directoryInput.value = '';
      });
    }

    function chooseFiles() {
      hidePickerMenu();
      input.click();
    }

    function chooseFolder() {
      hidePickerMenu();
      if (directoryInput) directoryInput.click();
    }

    function createDropActions() {
      if (!directoryInput || zone.querySelector('.file-drop-actions')) return;

      const actions = document.createElement('div');
      actions.className = 'file-drop-actions';

      const fileButton = document.createElement('button');
      fileButton.type = 'button';
      fileButton.className = 'file-drop-action';
      fileButton.textContent = formatChooseFileText(subject);
      fileButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseFiles();
      });

      const folderButton = document.createElement('button');
      folderButton.type = 'button';
      folderButton.className = 'file-drop-action';
      folderButton.textContent = '选择文件夹';
      folderButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseFolder();
      });

      actions.append(fileButton, folderButton);

      if (status && status.parentElement === zone) {
        zone.insertBefore(actions, status);
      } else {
        zone.appendChild(actions);
      }
    }

    function ensurePickerMenu() {
      if (pickerMenuEl || !directoryInput) return pickerMenuEl;

      pickerMenuEl = document.createElement('div');
      pickerMenuEl.className = 'file-input-picker-menu';
      pickerMenuEl.setAttribute('role', 'menu');
      pickerMenuEl.hidden = true;

      const fileButton = document.createElement('button');
      fileButton.type = 'button';
      fileButton.setAttribute('role', 'menuitem');
      fileButton.textContent = formatAddFileText(subject);
      fileButton.addEventListener('click', chooseFiles);

      const folderButton = document.createElement('button');
      folderButton.type = 'button';
      folderButton.setAttribute('role', 'menuitem');
      folderButton.textContent = '添加文件夹';
      folderButton.addEventListener('click', chooseFolder);

      pickerMenuEl.append(fileButton, folderButton);
      pickerMenuEl.addEventListener('click', (event) => event.stopPropagation());
      pickerMenuEl.addEventListener('keydown', (event) => {
        const buttons = Array.from(pickerMenuEl.querySelectorAll('button'));
        const activeIndex = buttons.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          hidePickerMenu();
          return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (activeIndex + direction + buttons.length) % buttons.length;
        buttons[nextIndex].focus();
      });
      document.body.appendChild(pickerMenuEl);
      return pickerMenuEl;
    }

    function positionPickerMenu(anchor) {
      if (!pickerMenuEl || !anchor) return;
      const rect = anchor.getBoundingClientRect();
      const menuRect = pickerMenuEl.getBoundingClientRect();
      const left = Math.min(
        Math.max(8, rect.left + rect.width / 2 - menuRect.width / 2),
        Math.max(8, window.innerWidth - menuRect.width - 8)
      );
      const top = Math.min(rect.bottom + 8, Math.max(8, window.innerHeight - menuRect.height - 8));
      pickerMenuEl.style.left = `${left}px`;
      pickerMenuEl.style.top = `${top}px`;
    }

    function hidePickerMenu() {
      if (!pickerMenuEl) return;
      pickerMenuEl.hidden = true;
    }

    function showPickerMenu(anchor) {
      ensurePickerMenu();
      if (!pickerMenuEl) return;
      pickerMenuEl.hidden = false;
      positionPickerMenu(anchor);
      const firstButton = pickerMenuEl.querySelector('button');
      if (firstButton) firstButton.focus();
    }

    function openFilePicker(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      hideTriggerTooltip();
      if (directoryInput && event && event.currentTarget === triggerButton) {
        showPickerMenu(triggerButton);
        return;
      }
      chooseFiles();
    }

    createDropActions();
    document.addEventListener('click', hidePickerMenu);

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
