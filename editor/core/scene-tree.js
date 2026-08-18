/**
 * SceneTree - 场景树模块（高级模式 Godot 式）
 * 层级化节点树渲染，支持展开/折叠、拖拽排序、右键菜单
 */
const SceneTree = (function () {
  let _container = null;
  let _dragNodeId = null;  // 拖拽中的节点ID
  let _dropTarget = null;  // 放置目标

  /** 初始化场景树 */
  function init() {
    _container = document.getElementById('scene-tree');
    if (!_container) return;

    // 绑定添加按钮
    const addBtn = document.getElementById('btn-add-scene-node');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        if (typeof AddNodeDialog !== 'undefined') {
          const selectedId = SceneGraph ? SceneGraph.getSelectedId() : null;
          AddNodeDialog.show(selectedId);
        }
      });
    }

    refresh();
  }

  /** 刷新场景树显示 */
  function refresh() {
    if (!_container) return;
    if (typeof SceneGraph === 'undefined') return;

    const root = SceneGraph.getRoot();
    if (!root) {
      _container.innerHTML = '<p class="inspector-hint">空场景</p>';
      return;
    }

    _container.innerHTML = '';
    _renderNode(root, 0, _container);
  }

  /** 递归渲染节点 */
  function _renderNode(node, depth, parentEl) {
    if (!node) return;

    const typeInfo = SceneGraph.getNodeType(node.type);
    const isSelected = SceneGraph.getSelectedId() === node.id;
    const hasChildren = node.children && node.children.length > 0;

    // 节点行
    const row = document.createElement('div');
    row.className = 'scene-node' + (isSelected ? ' selected' : '');
    row.dataset.nodeId = node.id;
    row.style.paddingLeft = (12 + depth * 16) + 'px';
    row.draggable = node.parent !== null; // 根节点不可拖拽

    // 展开箭头
    const arrow = document.createElement('span');
    arrow.className = 'scene-node-arrow';
    if (hasChildren) {
      arrow.textContent = node.expanded ? '▼' : '▶';
      arrow.addEventListener('click', (e) => {
        e.stopPropagation();
        SceneGraph.toggleExpand(node.id);
        refresh();
      });
    } else {
      arrow.textContent = ' ';
      arrow.style.visibility = 'hidden';
    }

    // 类型图标
    const icon = document.createElement('span');
    icon.className = 'scene-node-icon';
    icon.textContent = typeInfo ? typeInfo.icon : '❓';

    // 名称
    const name = document.createElement('span');
    name.className = 'scene-node-name';
    name.textContent = node.name;

    // 可见性
    const vis = document.createElement('span');
    vis.className = 'scene-node-vis';
    vis.textContent = node.visible !== false ? '👁' : '🚫';
    vis.title = node.visible !== false ? '点击隐藏' : '点击显示';
    vis.addEventListener('click', (e) => {
      e.stopPropagation();
      SceneGraph.setVisible(node.id, !node.visible);
      // 同步到 StageManager
      if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
      refresh();
    });

    // 锁定
    const lock = document.createElement('span');
    lock.className = 'scene-node-lock';
    lock.textContent = node.locked ? '🔒' : '🔓';
    lock.title = node.locked ? '点击解锁' : '点击锁定';
    lock.addEventListener('click', (e) => {
      e.stopPropagation();
      SceneGraph.setLocked(node.id, !node.locked);
      refresh();
    });

    row.appendChild(arrow);
    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(vis);
    row.appendChild(lock);

    // 点击选中
    row.addEventListener('click', () => selectNode(node.id));

    // 右键菜单
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      SceneGraph.selectNode(node.id);
      refresh();
      showContextMenu(e, node.id);
    });

    // 拖拽开始
    row.addEventListener('dragstart', (e) => {
      _dragNodeId = node.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', node.id);
      row.classList.add('dragging');
    });

    row.addEventListener('dragend', () => {
      _dragNodeId = null;
      row.classList.remove('dragging');
      // 清除所有拖拽指示
      _container.querySelectorAll('.drag-over-top,.drag-over-bottom,.drag-over-self').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-self');
      });
    });

    // 拖拽放置
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (!_dragNodeId || _dragNodeId === node.id) return;

      const rect = row.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;

      // 清除之前的状态
      row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-self');

      if (y < h * 0.25) {
        row.classList.add('drag-over-top');
        _dropTarget = { type: 'before', nodeId: node.id };
      } else if (y > h * 0.75) {
        row.classList.add('drag-over-bottom');
        _dropTarget = { type: 'after', nodeId: node.id };
      } else {
        row.classList.add('drag-over-self');
        _dropTarget = { type: 'child', nodeId: node.id };
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-self');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!_dragNodeId || !_dropTarget) return;

      const targetNode = SceneGraph.getNode(_dropTarget.nodeId);
      if (!targetNode) return;

      if (_dropTarget.type === 'child') {
        // 成为子节点
        SceneGraph.moveNode(_dragNodeId, _dropTarget.nodeId);
      } else {
        // 成为兄弟节点（插入到目标前面或后面）
        const parent = SceneGraph.getNode(targetNode.parent);
        if (parent) {
          const idx = parent.children.indexOf(_dropTarget.nodeId);
          const insertIdx = _dropTarget.type === 'after' ? idx + 1 : idx;
          SceneGraph.moveNode(_dragNodeId, parent.id, insertIdx);
        }
      }

      // 同步到 StageManager
      if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
      refresh();
      _dropTarget = null;
    });

    parentEl.appendChild(row);

    // 递归渲染子节点（如果展开）
    if (hasChildren && node.expanded) {
      node.children.forEach(childId => {
        const child = SceneGraph.getNode(childId);
        if (child) _renderNode(child, depth + 1, parentEl);
      });
    }
  }

  /** 选中节点 */
  function selectNode(id) {
    // 保存当前节点的代码
    const prevId = SceneGraph.getSelectedId();
    if (prevId && typeof EditorApp !== 'undefined' && EditorApp.getJsEditor) {
      const prevNode = SceneGraph.getNode(prevId);
      const editor = EditorApp.getJsEditor();
      if (prevNode && editor) {
        if (prevNode.type === 'Sprite2D') {
          EditorApp.setSpriteScript(prevNode.spriteRef, editor.getValue());
        } else if (EditorApp.setNodeScript) {
          EditorApp.setNodeScript(prevId, editor.getValue());
        }
      }
    }

    SceneGraph.selectNode(id);
    refresh();

    // 通知 Inspector
    if (typeof Inspector !== 'undefined') {
      Inspector.showNode(id);
    }

    // 同步 StageManager 并加载脚本
    const node = SceneGraph.getNode(id);
    if (!node) return;

    if (node.type === 'Sprite2D' && typeof StageManager !== 'undefined') {
      StageManager.syncFromSceneGraph();
      if (node.spriteRef !== null) {
        StageManager.setActiveSprite(node.spriteRef);
      }
    }

    // 加载对应脚本（精灵用 spriteRef，其他节点用 nodeId）
    if (typeof EditorApp !== 'undefined' && EditorApp.getJsEditor) {
      const editor = EditorApp.getJsEditor();
      if (editor) {
        let script;
        if (node.type === 'Sprite2D') {
          script = EditorApp.getSpriteScript(node.spriteRef) || '// 在此编写 JavaScript 代码\n';
        } else if (EditorApp.getNodeScript) {
          script = EditorApp.getNodeScript(id) || '// 在此编写 JavaScript 代码\n';
        } else {
          script = '// 在此编写 JavaScript 代码\n';
        }
        editor.setValue(script);
      }
    }
  }

  /** 获取当前选中节点ID */
  function getSelectedId() {
    return SceneGraph ? SceneGraph.getSelectedId() : null;
  }

  /** 获取选中索引（兼容旧API，返回 Sprite2D 的 spriteRef） */
  function getSelectedIndex() {
    if (!SceneGraph) return -1;
    const node = SceneGraph.getSelectedNode();
    if (!node) return -1;
    if (node.type === 'Sprite2D') return node.spriteRef !== null ? node.spriteRef : -1;
    return -1;
  }

  /** 显示右键菜单 */
  function showContextMenu(e, nodeId) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    const node = SceneGraph.getNode(nodeId);
    if (!node) return;

    const isRoot = !node.parent;
    const typeInfo = SceneGraph.getNodeType(node.type);
    const canAddChild = typeInfo && typeInfo.canAddChild;

    menu.innerHTML = `
      ${canAddChild ? '<div class="ctx-item" data-action="add-child">➕ 添加子节点</div>' : ''}
      <div class="ctx-item" data-action="rename">✏️ 重命名</div>
      <div class="ctx-item" data-action="duplicate">📋 复制（含子节点）</div>
      ${!isRoot ? '<div class="ctx-item" data-action="move-up">⬆️ 上移</div>' : ''}
      ${!isRoot ? '<div class="ctx-item" data-action="move-down">⬇️ 下移</div>' : ''}
      ${!isRoot ? '<div class="ctx-item" data-action="delete" style="color:var(--red,#f38ba8);">🗑️ 删除</div>' : ''}
    `;

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');

    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        handleContextAction(item.dataset.action, nodeId);
        menu.classList.add('hidden');
      });
    });

    const closeMenu = () => {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /** 处理右键菜单操作 */
  function handleContextAction(action, nodeId) {
    const node = SceneGraph.getNode(nodeId);
    if (!node) return;

    switch (action) {
      case 'add-child':
        if (typeof AddNodeDialog !== 'undefined') {
          AddNodeDialog.show(nodeId);
        }
        break;
      case 'rename': {
        const newName = prompt('输入新名称:', node.name);
        if (newName) {
          SceneGraph.renameNode(nodeId, newName);
          // 同步 StageManager
          if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
          refresh();
        }
        break;
      }
      case 'duplicate': {
        const newId = SceneGraph.duplicateNode(nodeId);
        if (newId && typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
        refresh();
        break;
      }
      case 'move-up': {
        if (!node.parent) break;
        const parent = SceneGraph.getNode(node.parent);
        if (!parent) break;
        const idx = parent.children.indexOf(nodeId);
        if (idx > 0) {
          parent.children.splice(idx, 1);
          parent.children.splice(idx - 1, 0, nodeId);
          if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
          refresh();
        }
        break;
      }
      case 'move-down': {
        if (!node.parent) break;
        const parent = SceneGraph.getNode(node.parent);
        if (!parent) break;
        const idx = parent.children.indexOf(nodeId);
        if (idx < parent.children.length - 1) {
          parent.children.splice(idx, 1);
          parent.children.splice(idx + 1, 0, nodeId);
          if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
          refresh();
        }
        break;
      }
      case 'delete': {
        const childCount = _countDescendants(nodeId);
        const msg = childCount > 0
          ? `确定删除 "${node.name}" 及其 ${childCount} 个子节点吗？`
          : `确定删除 "${node.name}" 吗？`;
        if (confirm(msg)) {
          SceneGraph.removeNode(nodeId);
          if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
          refresh();
        }
        break;
      }
    }
  }

  /** 计算后代节点数量 */
  function _countDescendants(nodeId) {
    const node = SceneGraph.getNode(nodeId);
    if (!node) return 0;
    let count = node.children.length;
    node.children.forEach(cid => { count += _countDescendants(cid); });
    return count;
  }

  return {
    init,
    refresh,
    selectNode,
    getSelectedId,
    getSelectedIndex,
  };
})();
