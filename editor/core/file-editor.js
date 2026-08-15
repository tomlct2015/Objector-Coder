/**
 * 文件编辑器模块 - 管理扩展文件的新建/编辑/保存/加载
 */
const FileEditor = (function () {
  let currentFile = null;
  let files = [];

  /** 获取 extensions 目录路径 */
  function getExtensionsDir() {
    if (!EditorState.projectPath) return null;
    return EditorState.projectPath + '/extensions';
  }

  /** 刷新文件列表 */
  async function refreshFileList() {
    const dir = getExtensionsDir();
    if (!dir) return;

    const listEl = document.getElementById('file-list');
    if (!listEl) return;

    // 确保目录存在
    await window.api.ensureDir(dir);

    // 读取目录
    const entries = await window.api.listDir(dir);
    files = (entries || []).filter(f => f.endsWith('.js') || f.endsWith('.json'));

    listEl.innerHTML = '';
    files.forEach(fname => {
      const item = document.createElement('div');
      item.className = 'file-item' + (currentFile === fname ? ' active' : '');

      const nameEl = document.createElement('span');
      nameEl.className = 'file-item-name';
      nameEl.textContent = fname;
      nameEl.onclick = () => openFile(fname);

      const delEl = document.createElement('span');
      delEl.className = 'file-item-delete';
      delEl.textContent = '×';
      delEl.onclick = (e) => { e.stopPropagation(); deleteFile(fname); };

      item.appendChild(nameEl);
      item.appendChild(delEl);
      listEl.appendChild(item);
    });
  }

  /** 打开文件 */
  async function openFile(fname) {
    const dir = getExtensionsDir();
    if (!dir) return;

    const content = await window.api.readFile(dir + '/' + fname);
    if (content === null) return;

    currentFile = fname;
    document.getElementById('file-editor-area').value = content;
    refreshFileList();
  }

  /** 显示文件名输入对话框 */
  function showFilenameDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.innerHTML = `
        <div class="dialog-box" style="max-width:360px;text-align:left;">
          <h2 style="text-align:center;">新建文件</h2>
          <p style="text-align:center;">输入文件名（以 .js 或 .json 结尾）</p>
          <input id="filename-input" type="text" placeholder="my-extension.js"
            style="width:100%;padding:8px 12px;background:var(--bg-primary);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius);font-size:14px;outline:none;margin-bottom:16px;" />
          <div class="dialog-actions">
            <button id="fname-ok" class="tb-btn tb-run" style="flex:1;">确定</button>
            <button id="fname-cancel" class="tb-btn" style="flex:1;">取消</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#filename-input');
      const okBtn = overlay.querySelector('#fname-ok');
      const cancelBtn = overlay.querySelector('#fname-cancel');

      input.focus();

      function close(val) {
        document.body.removeChild(overlay);
        resolve(val || null);
      }

      okBtn.addEventListener('click', () => close(input.value.trim()));
      cancelBtn.addEventListener('click', () => close(null));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') close(input.value.trim());
        if (e.key === 'Escape') close(null);
      });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close(null);
      });
    });
  }

  /** 新建文件 */
  async function createFile() {
    const fname = await showFilenameDialog();
    if (!fname) return;

    // 验证文件名
    if (!fname.endsWith('.js') && !fname.endsWith('.json')) {
      alert(i18n.isEnglish() ? 'File name must end with .js or .json' : '文件名必须以 .js 或 .json 结尾');
      return;
    }

    const dir = getExtensionsDir();
    if (!dir) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 确保目录存在
    await window.api.ensureDir(dir);

    // 检查是否已存在
    const existing = await window.api.readFile(dir + '/' + fname);
    if (existing !== null) {
      if (!confirm(i18n.isEnglish() ? 'File exists, overwrite?' : '文件已存在，是否覆盖？')) return;
    }

    // 创建模板内容
    let content = '';
    if (fname.endsWith('.json')) {
      content = JSON.stringify({
        name: fname.replace('.json', ''),
        version: '1.0.0',
        blocks: []
      }, null, 2);
    } else {
      content = '/**\n * Extension: ' + fname + '\n */\n\n// Write extension code here\n';
    }

    console.log('[FileEditor] 创建文件:', dir + '/' + fname);
    const result = await window.api.writeFile(dir + '/' + fname, content);
    console.log('[FileEditor] 写入结果:', result);
    if (result && result.error) {
      alert((i18n.isEnglish() ? 'File creation failed: ' : '文件创建失败: ') + result.error);
      return;
    }

    currentFile = fname;
    document.getElementById('file-editor-area').value = content;
    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'File created: ' : '文件已创建: ') + fname;
    await refreshFileList();

    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 保存当前文件 */
  async function saveFile() {
    if (!currentFile) {
      alert(i18n.isEnglish() ? 'Please select or create a file first' : '请先选择或新建一个文件');
      return;
    }

    const dir = getExtensionsDir();
    if (!dir) return;

    const content = document.getElementById('file-editor-area').value;
    await window.api.writeFile(dir + '/' + currentFile, content);
    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'File saved: ' : '文件已保存: ') + currentFile;
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 删除文件 */
  async function deleteFile(fname) {
    if (!confirm(i18n.isEnglish() ? 'Delete file ' + fname + '?' : '确定删除文件 ' + fname + '？')) return;

    const dir = getExtensionsDir();
    if (!dir) return;

    await window.api.deleteFile(dir + '/' + fname);
    if (currentFile === fname) {
      currentFile = null;
      document.getElementById('file-editor-area').value = '';
    }
    await refreshFileList();
  }

  /** 加载测试（加载当前项目的扩展） */
  async function loadTest() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 先保存当前文件
    if (currentFile) {
      await saveFile();
    }

    // 调用扩展管理器加载
    const count = await ExtensionManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      Palette.init();
      document.getElementById('status-text').textContent = i18n.isEnglish() ? `Loaded ${count} extension(s)` : `已加载 ${count} 个扩展`;
    } else {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'No extension files found' : '未找到可扩展文件';
    }
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

 /** 为 textarea 绑定编辑器快捷键（Tab缩进/自动缩进/括号配对/Ctrl+S） */
  function bindEditorKeys() {
    const ta = document.getElementById('file-editor-area');
    if (!ta || ta._keysBound) return;
    ta._keysBound = true;

    const INDENT = '    '; // 4 spaces
    const PAIRS = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
    const CLOSERS = new Set([')', ']', '}', '"', "'", '`']);

    // ── Tab 防讧：三层保护确保 Tab 始终插入 4 空格 ───────────────
    // 第1层: capture 阶段 preventDefault 阻止浏览器默认焦点跳转
    // 第2层: textarea keydown 正常插入空格并清除 _tabNotHandled 标记
    // 第3层: capture 中的 setTimeout(16ms) 兜底 —
    //         若 textarea keydown 未执行（浏览器拦截了事件），
    //         _tabNotHandled 仍为 true 且焦点已丢失 → 恢复焦点并补插
    let _tabNotHandled = false;
    let _tabCursorPos = 0;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && document.activeElement === ta) {
        e.preventDefault();
        _tabNotHandled = true;
        _tabCursorPos = ta.selectionStart;
        // 延迟检查：给 textarea keydown 足够时间执行
        // 如果 textarea keydown 执行了，它会将 _tabNotHandled 设为 false
        setTimeout(function () {
          if (_tabNotHandled && document.activeElement !== ta) {
            // 焦点被浏览器抢走了，textarea keydown 没有执行
            _tabNotHandled = false;
            const pos = _tabCursorPos;
            const v = ta.value;
            ta.value = v.slice(0, pos) + INDENT + v.slice(pos);
            ta.selectionStart = ta.selectionEnd = pos + 4;
            ta.focus();
          }
          _tabNotHandled = false;
        }, 16);
      }
    }, true); // ← capture phase

    ta.addEventListener('keydown', function (e) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;

      // ── Tab / Shift+Tab ──────────────────────────────────────
      if (e.key === 'Tab') {
        e.preventDefault();
        _tabNotHandled = false; // keydown 执行了，清除兜底标记
        if (start === end && !e.shiftKey) {
          // 无选区：直接插入 4 空格
          ta.value = val.slice(0, start) + INDENT + val.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 4;
        } else {
          // 有选区或 Shift+Tab：按行缩进/取消缩进
          const lineStart = val.lastIndexOf('\n', start - 1) + 1;
          const block = val.slice(lineStart, end);
          let newBlock;
          if (e.shiftKey) {
            newBlock = block.replace(/^( {1,4})/gm, '');
          } else {
            newBlock = block.replace(/^/gm, INDENT);
          }
          ta.value = val.slice(0, lineStart) + newBlock + val.slice(end);
          ta.selectionStart = lineStart;
          ta.selectionEnd = lineStart + newBlock.length;
        }
        return;
      }

      // ── Enter 自动缩进 ───────────────────────────────────────
      if (e.key === 'Enter') {
        const lineStart = val.lastIndexOf('\n', start - 1) + 1;
        const currentLine = val.slice(lineStart, start);
        const leadingWS = (currentLine.match(/^(\s*)/) || ['',''])[1];
        // 如果当前行以 { ( [ 结尾，增加一级缩进
        const lastChar = currentLine.trimEnd().slice(-1);
        const extra = (lastChar === '{' || lastChar === '(' || lastChar === '[') ? INDENT : '';
        if (leadingWS || extra) {
          e.preventDefault();
          const insert = '\n' + leadingWS + extra;
          ta.value = val.slice(0, start) + insert + val.slice(end);
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        }
        return;
      }

      // ── Ctrl/Cmd + S 保存 ───────────────────────────────────
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        saveFile();
        return;
      }

      // ── 自动配对括号/引号 ────────────────────────────────────
      if (PAIRS[e.key] && start === end) {
        // 若下一个字符已经是同类型闭符号，则跳过插入（仅引号适用）
        if (CLOSERS.has(e.key) && val[start] === e.key) {
          e.preventDefault();
          ta.selectionStart = ta.selectionEnd = start + 1;
          return;
        }
        e.preventDefault();
        const close = PAIRS[e.key];
        ta.value = val.slice(0, start) + e.key + close + val.slice(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
        return;
      }

      // ── 跳过闭符号（光标紧跟在闭符号前时按闭符号直接跳过）─────
      if (CLOSERS.has(e.key) && val[start] === e.key && start === end) {
        e.preventDefault();
        ta.selectionStart = ta.selectionEnd = start + 1;
        return;
      }

      // ── Backspace 删除配对（光标在两配对符号中间时同时删除两个）
      if (e.key === 'Backspace' && start === end && start > 0) {
        const before = val[start - 1];
        const after = val[start];
        if (PAIRS[before] === after) {
          e.preventDefault();
          ta.value = val.slice(0, start - 1) + val.slice(start + 1);
          ta.selectionStart = ta.selectionEnd = start - 1;
        }
      }
    });
  }

  /** 初始化（绑定按钮事件） */
  function init() {
    const newBtn = document.getElementById('btn-file-editor-new');
    const saveBtn = document.getElementById('btn-save-file');
    const loadBtn = document.getElementById('btn-load-test');

    if (newBtn) newBtn.addEventListener('click', createFile);
    if (saveBtn) saveBtn.addEventListener('click', saveFile);
    if (loadBtn) loadBtn.addEventListener('click', loadTest);

    bindEditorKeys();
  }

  return { init, refreshFileList, openFile, createFile, saveFile };
})();
