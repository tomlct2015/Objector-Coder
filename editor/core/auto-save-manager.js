/**
 * 自动保存管理器 - 定时保存项目到磁盘
 * 防止意外关闭丢失工作
 */
const AutoSaveManager = (function () {
  let _timer = null;
  let _interval = 30000; // 30 秒自动保存
  let _lastSaveTime = null;
  let _isEnabled = true;

  /** 初始化自动保存 */
  function init() {
    if (!_isEnabled) return;
    
    // 从 localStorage 读取用户设置
    const savedInterval = localStorage.getItem('autosave-interval');
    if (savedInterval) {
      _interval = parseInt(savedInterval, 10) * 1000;
    }

    start();
    console.log('[AutoSaveManager] 已初始化，间隔', _interval / 1000, '秒');
  }

  /** 启动自动保存定时器 */
  function start() {
    stop();
    if (!_isEnabled || _interval <= 0) return;

    _timer = setInterval(() => {
      _doAutoSave();
    }, _interval);
  }

  /** 停止自动保存 */
  function stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
  }

  /** 执行自动保存 */
  async function _doAutoSave() {
    // 检查是否有未保存的更改
    if (!EditorState._isDirty) return;
    if (!EditorState.projectPath) return;

    // 检查是否正在运行（运行时不保存，避免干扰）
    if (EditorState.running) return;

    try {
      // 调用项目保存
      if (typeof ProjectManager !== 'undefined' && ProjectManager.saveProject) {
        await ProjectManager.saveProject();
        _lastSaveTime = new Date();
        
        // 显示自动保存提示
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
          const time = _lastSaveTime.toLocaleTimeString();
          const msg = i18n.isEnglish() ? `Auto-saved at ${time}` : `已自动保存 (${time})`;
          statusEl.textContent = msg;
          setTimeout(() => {
            if (statusEl.textContent === msg) {
              statusEl.textContent = i18n.t('status.ready');
            }
          }, 2000);
        }
      }
    } catch (e) {
      console.error('[AutoSaveManager] 保存失败:', e);
    }
  }

  /** 立即保存（手动触发） */
  async function saveNow() {
    await _doAutoSave();
  }

  /** 设置保存间隔（秒） */
  function setInterval(seconds) {
    _interval = seconds * 1000;
    localStorage.setItem('autosave-interval', seconds.toString());
    start(); // 重启定时器
  }

  /** 获取保存间隔（秒） */
  function getInterval() {
    return _interval / 1000;
  }

  /** 获取上次保存时间 */
  function getLastSaveTime() {
    return _lastSaveTime;
  }

  /** 启用/禁用自动保存 */
  function setEnabled(enabled) {
    _isEnabled = enabled;
    if (enabled) {
      start();
    } else {
      stop();
    }
  }

  /** 是否启用 */
  function isEnabled() {
    return _isEnabled;
  }

  return {
    init, start, stop,
    saveNow, setInterval, getInterval,
    getLastSaveTime, setEnabled, isEnabled
  };
})();
