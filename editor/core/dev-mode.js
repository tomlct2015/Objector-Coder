/**
 * 开发者模式模块 - 管理编辑模式（新手/普通/开发者）
 * 提供：代码折叠、变量监视、断点调试、单步执行、执行高亮
 */
const DevMode = (function () {
  // 模式: 'beginner' | 'normal' | 'developer'
  let _mode = localStorage.getItem('editor-mode') || 'normal';

  // 折叠状态: blockId -> true (折叠)
  let _collapsed = {};

  // 断点: blockId -> true
  let _breakpoints = {};

  // 调试状态
  let _stepping = false;       // 单步模式
  let _stepResolve = null;     // 当前等待的 resolve
  let _executingBlock = null;  // 当前正在执行的积木 ID
  let _watchPanel = null;

  // 新手模式下隐藏的高级分类
  const BEGINNER_HIDDEN = ['oop', 'functions'];
  // 新手模式下标记为"高级"的分类
  const BEGINNER_ADVANCED = ['operators', 'lists', 'sensing'];

  function getMode() { return _mode; }

  function setMode(mode) {
    _mode = mode;
    localStorage.setItem('editor-mode', mode);
    applyMode();
  }

  function isBeginner() { return _mode === 'beginner'; }
  function isDeveloper() { return _mode === 'developer'; }
  function isNormal() { return _mode === 'normal'; }

  /** 应用模式到 UI */
  function applyMode() {
    const body = document.body;
    body.classList.remove('mode-beginner', 'mode-normal', 'mode-developer');
    body.classList.add('mode-' + _mode);

    // 更新模式选择器显示
    const selector = document.getElementById('mode-selector');
    if (selector) selector.value = _mode;

    // 刷新积木面板
    if (typeof Palette !== 'undefined') Palette.init();

    // 开发者面板
    const devTab = document.querySelector('.stage-tab[data-tab="debug"]');
    if (devTab) {
      devTab.classList.toggle('hidden', !isDeveloper());
    }

    // 开发者工具栏按钮
    const debugBtns = document.querySelectorAll('.dev-only');
    debugBtns.forEach(btn => btn.classList.toggle('hidden', !isDeveloper()));

    // 更新调试面板
    if (isDeveloper()) refreshWatchPanel();

    // 状态提示
    const modeNames = { beginner: '🌱 新手模式', normal: '⚡ 普通模式', developer: '🔧 开发者模式' };
    const statusText = document.getElementById('status-text');
    if (statusText) {
      statusText.textContent = modeNames[_mode] || '就绪';
      setTimeout(() => { if (statusText.textContent.startsWith('🌱') || statusText.textContent.startsWith('⚡') || statusText.textContent.startsWith('🔧')) statusText.textContent = i18n.t('status.ready'); }, 2000);
    }
  }

  // ===== 代码折叠 =====

  function isCollapsed(blockId) { return !!_collapsed[blockId]; }

  function toggleCollapse(blockId) {
    _collapsed[blockId] = !_collapsed[blockId];
    if (!_collapsed[blockId]) delete _collapsed[blockId];
  }

  /** 获取一条积木链的所有 block IDs */
  function getChainIds(startBlock) {
    const ids = [startBlock.id];
    let cur = startBlock;
    while (cur.flowOut && EditorState.blocks[cur.flowOut]) {
      cur = EditorState.blocks[cur.flowOut];
      ids.push(cur.id);
    }
    return ids;
  }

  /** 获取折叠的积木数量（用于显示） */
  function getCollapsedCount(blockId) {
    const block = EditorState.blocks[blockId];
    if (!block) return 0;
    return getChainIds(block).length - 1; // 减去帽子积木本身
  }

  // ===== 断点 =====

  function isBreakpoint(blockId) { return !!_breakpoints[blockId]; }

  function toggleBreakpoint(blockId) {
    _breakpoints[blockId] = !_breakpoints[blockId];
    if (!_breakpoints[blockId]) delete _breakpoints[blockId];
  }

  function clearAllBreakpoints() {
    _breakpoints = {};
    refreshWatchPanel();
  }

  // ===== 调试执行 =====

  function getExecutingBlock() { return _executingBlock; }

  function setExecutingBlock(blockId) {
    _executingBlock = blockId;
    if (isDeveloper()) refreshWatchPanel();
  }

  /** 在 executeBlock 前调用 - 检查断点和单步 */
  async function beforeExecuteBlock(block) {
    if (!isDeveloper() || !EditorState.running) return;

    setExecutingBlock(block.id);

    // 断点暂停
    if (_breakpoints[block.id]) {
      log('⏸ 断点命中: ' + block.type + ' (' + block.id.slice(-6) + ')');
      await pauseAndWait();
    }

    // 单步模式
    if (_stepping) {
      await pauseAndWait();
    }
  }

  function pauseAndWait() {
    return new Promise(resolve => {
      _stepResolve = resolve;
      document.getElementById('status-text').textContent = i18n.isEnglish() ? '⏸ Paused (click Continue or Step)' : '⏸ 已暂停（点击“继续”或“单步”）';
    });
  }

  /** 继续执行 */
  function continueExecution() {
    _stepping = false;
    if (_stepResolve) {
      const r = _stepResolve;
      _stepResolve = null;
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Running...' : '运行中...';
      r();
    }
  }

  /** 单步执行 */
  function stepExecution() {
    _stepping = true;
    if (_stepResolve) {
      const r = _stepResolve;
      _stepResolve = null;
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Step...' : '单步...';
      r();
    }
  }

  /** 停止调试 */
  function stopDebug() {
    _stepping = false;
    _executingBlock = null;
    if (_stepResolve) {
      const r = _stepResolve;
      _stepResolve = null;
      r();
    }
    // 同时停止执行
    if (typeof Executor !== 'undefined') Executor.stop();
  }

  function log(msg) {
    const logEl = document.getElementById('output-log');
    if (logEl) {
      logEl.textContent += msg + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  }

  // ===== 变量监视面板 =====

  function refreshWatchPanel() {
    if (!isDeveloper()) return;
    const panel = document.getElementById('debug-panel');
    if (!panel) return;

    let html = '';

    // 当前执行
    const execBlock = _executingBlock ? EditorState.blocks[_executingBlock] : null;
    html += '<div class="debug-section"><h4>▶ 当前执行</h4>';
    if (execBlock) {
      const def = BlockRegistry.getBlock(execBlock.type);
      html += `<div class="debug-exec-info">${def ? def.label.replace(/\{[^}]+\}/g, '...') : execBlock.type}</div>`;
      html += `<div class="debug-exec-id">ID: ...${execBlock.id.slice(-6)}</div>`;
    } else {
      html += '<div class="debug-exec-info" style="color:var(--text-muted);">未在运行</div>';
    }
    html += '</div>';

    // 变量监视
    html += '<div class="debug-section"><h4>📦 变量监视</h4>';
    if (typeof Executor !== 'undefined' && Executor._getGlobalVars) {
      const vars = Executor._getGlobalVars();
      const keys = Object.keys(vars);
      if (keys.length > 0) {
        html += '<div class="debug-var-list">';
        keys.forEach(k => {
          const val = vars[k];
          const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
          html += `<div class="debug-var-item"><span class="debug-var-name">${k}</span><span class="debug-var-val">${display}</span></div>`;
        });
        html += '</div>';
      } else {
        html += '<div style="color:var(--text-muted);font-size:11px;">暂无变量</div>';
      }
    } else {
      html += '<div style="color:var(--text-muted);font-size:11px;">运行后可查看</div>';
    }
    html += '</div>';

    // 断点列表
    html += '<div class="debug-section"><h4>🔴 断点</h4>';
    const bpKeys = Object.keys(_breakpoints);
    if (bpKeys.length > 0) {
      html += '<div class="debug-var-list">';
      bpKeys.forEach(bid => {
        const b = EditorState.blocks[bid];
        if (b) {
          const def = BlockRegistry.getBlock(b.type);
          html += `<div class="debug-var-item"><span class="debug-var-name">${def ? def.label.replace(/\{[^}]+\}/g, '') : b.type}</span><button class="debug-bp-remove" data-id="${bid}">×</button></div>`;
        }
      });
      html += '</div>';
      html += '<button class="tb-btn" style="margin-top:4px;font-size:10px;padding:2px 8px;" id="btn-clear-bp">清空所有断点</button>';
    } else {
      html += '<div style="color:var(--text-muted);font-size:11px;">右键积木可设置断点</div>';
    }
    html += '</div>';

    // 积木统计
    html += '<div class="debug-section"><h4>📊 积木统计</h4>';
    const allBlocks = Object.values(EditorState.blocks);
    const typeCount = {};
    allBlocks.forEach(b => { typeCount[b.type] = (typeCount[b.type] || 0) + 1; });
    html += '<div class="debug-var-list">';
    Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([type, count]) => {
      const def = BlockRegistry.getBlock(type);
      html += `<div class="debug-var-item"><span class="debug-var-name">${def ? (def.label || type).replace(/\{[^}]+\}/g, '').trim() : type}</span><span class="debug-var-val">${count}</span></div>`;
    });
    html += '</div></div>';

    panel.innerHTML = html;

    // 绑定事件
    panel.querySelectorAll('.debug-bp-remove').forEach(btn => {
      btn.addEventListener('click', () => { toggleBreakpoint(btn.dataset.id); refreshWatchPanel(); });
    });
    const clearBpBtn = panel.querySelector('#btn-clear-bp');
    if (clearBpBtn) clearBpBtn.addEventListener('click', () => { clearAllBreakpoints(); });
  }

  /** 获取新手模式下的分类过滤 */
  function filterCategories(categories) {
    if (!isBeginner()) return categories;
    return categories.filter(c => !BEGINNER_HIDDEN.includes(c.id));
  }

  /** 初始化 */
  function init() {
    // 创建模式选择器
    const toolbarRight = document.querySelector('.toolbar-right');
    if (toolbarRight && !document.getElementById('mode-selector')) {
      const select = document.createElement('select');
      select.id = 'mode-selector';
      select.className = 'mode-select';
      select.innerHTML = '<option value="beginner">🌱 新手</option><option value="normal">⚡ 普通</option><option value="developer">🔧 开发者</option>';
      select.value = _mode;
      select.addEventListener('change', () => setMode(select.value));
      toolbarRight.prepend(select);
    }

    applyMode();
  }

  return {
    getMode, setMode, isBeginner, isDeveloper, isNormal,
    init, applyMode, filterCategories,
    // 折叠
    isCollapsed, toggleCollapse, getCollapsedCount, getChainIds,
    // 断点
    isBreakpoint, toggleBreakpoint, clearAllBreakpoints,
    // 调试
    getExecutingBlock, setExecutingBlock, beforeExecuteBlock,
    continueExecution, stepExecution, stopDebug,
    // 面板
    refreshWatchPanel,
    // 常量
    BEGINNER_HIDDEN, BEGINNER_ADVANCED,
  };
})();
