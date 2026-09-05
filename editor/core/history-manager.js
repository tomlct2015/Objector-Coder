/**
 * 历史记录管理器 - 支持撤销/重做
 * 跟踪积木状态变化，提供 Ctrl+Z / Ctrl+Y 支持
 */
const HistoryManager = (function () {
  const MAX_HISTORY = 50; // 最多保存 50 步
  let _history = [];      // 历史栈
  let _currentIndex = -1; // 当前位置
  let _isUndoing = false; // 防止撤销操作本身被记录
  let _debounceTimer = null;
  let _lastSnapshot = null;

  /** 初始化 */
  function init() {
    _history = [];
    _currentIndex = -1;
    _isUndoing = false;
    // 记录初始状态
    pushSnapshot();
    console.log('[HistoryManager] 已初始化');
  }

  /** 获取当前积木快照 */
  function _getSnapshot() {
    try {
      return JSON.stringify(EditorState.blocks || {});
    } catch {
      return '{}';
    }
  }

  /** 从快照恢复积木 */
  function _restoreSnapshot(snapshot) {
    try {
      _isUndoing = true;
      EditorState.blocks = JSON.parse(snapshot);
      // 重新渲染画布
      if (typeof EditorCanvas !== 'undefined') {
        EditorCanvas.render();
      }
      // 更新积木计数
      const count = Object.keys(EditorState.blocks || {}).length;
      const countEl = document.getElementById('block-count');
      if (countEl) countEl.textContent = i18n.t('editor.blockCount', null).replace('{n}', count);
      // 标记为已修改
      EditorState._isDirty = true;
    } catch (e) {
      console.error('[HistoryManager] 恢复失败:', e);
    } finally {
      _isUndoing = false;
    }
  }

  /** 推送新快照到历史栈 */
  function pushSnapshot() {
    if (_isUndoing) return;

    const snapshot = _getSnapshot();
    
    // 如果和上一次相同，跳过
    if (_history.length > 0 && _history[_currentIndex] === snapshot) {
      return;
    }

    // 清除当前位置之后的历史（如果用户在撤销后又做了新操作）
    if (_currentIndex < _history.length - 1) {
      _history = _history.slice(0, _currentIndex + 1);
    }

    // 添加新快照
    _history.push(snapshot);
    _currentIndex = _history.length - 1;

    // 限制历史长度
    if (_history.length > MAX_HISTORY) {
      _history.shift();
      _currentIndex--;
    }

    _updateButtons();
  }

  /** 防抖版本的 pushSnapshot（用于拖拽等频繁操作） */
  function pushSnapshotDebounced() {
    if (_isUndoing) return;
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      pushSnapshot();
    }, 300);
  }

  /** 撤销 */
  function undo() {
    if (!canUndo()) return;
    
    _currentIndex--;
    _restoreSnapshot(_history[_currentIndex]);
    _updateButtons();
    
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = i18n.isEnglish() ? 'Undo' : '撤销';
      setTimeout(() => { statusEl.textContent = i18n.t('status.ready'); }, 1000);
    }
  }

  /** 重做 */
  function redo() {
    if (!canRedo()) return;
    
    _currentIndex++;
    _restoreSnapshot(_history[_currentIndex]);
    _updateButtons();
    
    const statusEl = document.getElementById('status-text');
    if (statusEl) {
      statusEl.textContent = i18n.isEnglish() ? 'Redo' : '重做';
      setTimeout(() => { statusEl.textContent = i18n.t('status.ready'); }, 1000);
    }
  }

  /** 是否可以撤销 */
  function canUndo() {
    return _currentIndex > 0;
  }

  /** 是否可以重做 */
  function canRedo() {
    return _currentIndex < _history.length - 1;
  }

  /** 更新按钮状态 */
  function _updateButtons() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = !canUndo();
    if (redoBtn) redoBtn.disabled = !canRedo();
  }

  /** 清空历史 */
  function clear() {
    _history = [];
    _currentIndex = -1;
    _isUndoing = false;
    clearTimeout(_debounceTimer);
    _updateButtons();
  }

  /** 获取历史长度 */
  function getHistoryLength() {
    return _history.length;
  }

  return {
    init, pushSnapshot, pushSnapshotDebounced,
    undo, redo, canUndo, canRedo,
    clear, getHistoryLength
  };
})();
