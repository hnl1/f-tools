(function (global) {
  function toElement(value) {
    if (!value) return null;
    return typeof value === 'string' ? document.querySelector(value) : value;
  }

  function getFilesFromClipboard(clipboardData) {
    if (!clipboardData) return [];

    const files = Array.from(clipboardData.files || []);
    if (files.length) return files;

    return Array.from(clipboardData.items || [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean);
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

  function bindFileInputDropZone(options) {
    const zone = toElement(options.zone);
    const input = toElement(options.input);
    const triggerElement = toElement(options.triggerElement || options.dropZone || options.button);
    const status = toElement(options.status);
    const onFiles = options.onFiles;
    const accept = options.accept || (input && input.accept) || '';
    const multiple = options.multiple != null ? options.multiple : Boolean(input && input.multiple);
    const emptyText = options.emptyText || '';
    const acceptedText = options.acceptedText || summarizeFiles;
    const rejectedText = options.rejectedText || '没有可用的文件，请检查文件类型。';
    const sourceLabels = Object.assign({
      choose: '选择',
      drop: '拖入',
      paste: '粘贴',
    }, options.sourceLabels || {});

    if (!zone || !input || typeof onFiles !== 'function') {
      throw new Error('bindFileInputDropZone requires zone, input, and onFiles.');
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

    document.addEventListener('drop', (event) => {
      if (!isFileDrag(event) && !(event.dataTransfer && event.dataTransfer.files.length)) return;
      event.preventDefault();
      setDragging(false);
      acceptFiles(event.dataTransfer.files, 'drop');
    });

    document.addEventListener('paste', (event) => {
      const files = getFilesFromClipboard(event.clipboardData);
      if (!files.length) return;

      if (acceptFiles(files, 'paste')) {
        event.preventDefault();
      }
    });

    if (emptyText) setStatus(emptyText, false);

    return {
      setStatus,
      clear() {
        input.value = '';
        setStatus(emptyText, false);
      },
    };
  }

  global.FileInputDropZone = {
    bind: bindFileInputDropZone,
  };
})(window);
