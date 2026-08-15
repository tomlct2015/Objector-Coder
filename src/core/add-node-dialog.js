/**
 * AddNodeDialog - 添加节点对话框（高级模式）
 * Electron 版：弹出独立子窗口（搜索+节点类型网格）
 * Web 回退版：内嵌 Modal 覆盖层
 */
const AddNodeDialog = (function () {
  let _dialog = null;      // 回退 Modal DOM
  let _parentId = null;    // 要添加子节点的父节点ID
  let _allTypes = [];      // 所有可用类型

  /**
   * 显示对话框
   * @param {string} parentId - 父节点ID
   */
  async function show(parentId) {
    _parentId = parentId || (typeof SceneGraph !== 'undefined' ? SceneGraph.getSelectedId() : null);

    // 获取允许的子节点类型
    if (typeof SceneGraph !== 'undefined') {
      _allTypes = SceneGraph.getValidChildTypes(_parentId).map(type => {
        const info = SceneGraph.getNodeType(type);
        return { type, ...info };
      });
    } else {
      _allTypes = [];
    }

    // 使用内嵌 Modal（Electron modal:true + frame:false 在 Windows 上会导致父窗口卡死）
    _showFallbackModal();
  }

  // ===================== 内嵌 Modal 回退 =====================

  /** 初始化对话框 DOM（首次使用） */
  function _ensureDialog() {
    if (_dialog) return;
    _dialog = document.createElement('div');
    _dialog.id = 'add-node-dialog';
    _dialog.className = 'modal-overlay hidden';
    _dialog.innerHTML = `
      <div class="modal-content add-node-modal">
        <div class="modal-header">
          <h3>添加节点</h3>
          <button class="modal-close" id="add-node-close">&times;</button>
        </div>
        <div class="add-node-search-wrap">
          <input type="text" id="add-node-search" placeholder="搜索节点类型..." class="add-node-search" />
        </div>
        <div id="add-node-grid" class="add-node-grid"></div>
      </div>
    `;
    document.body.appendChild(_dialog);

    _dialog.querySelector('#add-node-close').addEventListener('click', hide);
    _dialog.addEventListener('click', (e) => {
      if (e.target === _dialog) hide();
    });
    _dialog.querySelector('#add-node-search').addEventListener('input', (e) => {
      _filterTypes(e.target.value);
    });
  }

  /** 显示内嵌 Modal */
  function _showFallbackModal() {
    _ensureDialog();
    _renderGrid('');
    _dialog.classList.remove('hidden');
    const searchInput = _dialog.querySelector('#add-node-search');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
  }

  /** 隐藏内嵌 Modal */
  function hide() {
    if (_dialog) _dialog.classList.add('hidden');
  }

  /** 渲染类型网格 */
  function _renderGrid(filter) {
    const grid = _dialog.querySelector('#add-node-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const lowerFilter = (filter || '').toLowerCase();
    const filtered = _allTypes.filter(t => {
      if (!lowerFilter) return true;
      return t.type.toLowerCase().includes(lowerFilter)
        || (t.desc || '').toLowerCase().includes(lowerFilter);
    });

    if (filtered.length === 0) {
      grid.innerHTML = '<p class="add-node-empty">没有匹配的节点类型</p>';
      return;
    }

    filtered.forEach(typeInfo => {
      const card = document.createElement('div');
      card.className = 'add-node-card';
      card.innerHTML = `
        <div class="add-node-card-icon">${typeInfo.icon || '❓'}</div>
        <div class="add-node-card-name">${typeInfo.type}</div>
        <div class="add-node-card-desc">${typeInfo.desc || ''}</div>
      `;
      card.addEventListener('click', () => {
        _addNodeOfType(typeInfo.type);
      });
      grid.appendChild(card);
    });
  }

  /** 搜索过滤 */
  function _filterTypes(query) {
    _renderGrid(query);
  }

  // ===================== 添加节点核心逻辑 =====================

  /** 添加选中类型的节点 */
  function _addNodeOfType(type) {
    if (typeof SceneGraph === 'undefined') return;

    const typeId = SceneGraph.addNode(type, type, _parentId);
    if (!typeId) {
      alert('无法添加此类型的节点');
      return;
    }

    // 同步到 StageManager
    if (typeof StageManager !== 'undefined') {
      StageManager.syncFromSceneGraph();
    }

    // 选中新节点
    SceneGraph.selectNode(typeId);

    // 刷新场景树
    if (typeof SceneTree !== 'undefined') SceneTree.refresh();

    // 刷新检查器
    if (typeof Inspector !== 'undefined') Inspector.showNode(typeId);

    // 刷新 StageCanvas
    if (typeof StageCanvas !== 'undefined') StageCanvas.render();

    hide();
  }

  return { show, hide };
})();
