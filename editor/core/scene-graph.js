/**
 * SceneGraph - 场景图核心模块（高级模式 Godot 式）
 * 管理层级化节点树，支持多种节点类型
 */
const SceneGraph = (function () {
  let _nodes = {};       // id -> node
  let _rootId = null;    // 根节点ID
  let _selectedId = null; // 当前选中节点ID
  let _nextId = 1;

  // 节点类型定义：图标、默认属性、描述
  const NODE_TYPES = {
    Scene2D: {
      icon: '🎬', desc: '2D 场景',
      defaultProps: {},
      canAddChild: true,
      validChildren: ['Node2D', 'Sprite2D', 'Camera2D'],
    },
    Scene3D: {
      icon: '🌐', desc: '3D 场景',
      defaultProps: {},
      canAddChild: true,
      validChildren: ['Node3D', 'Mesh3D', 'Camera3D', 'Light3D'],
    },
    Node2D: {
      icon: '⬜', desc: '2D 空节点（分组/容器）',
      defaultProps: { x: 0, y: 0, rotation: 0 },
      canAddChild: true,
      validChildren: ['Node2D', 'Sprite2D', 'Camera2D'],
    },
    Sprite2D: {
      icon: '🎭', desc: '2D 精灵',
      defaultProps: { x: 0, y: 0, direction: 90, size: 100, color: '#4C97FF', costumeName: '', rotationStyle: 'allAround' },
      canAddChild: false,
    },
    Camera2D: {
      icon: '📷', desc: '2D 摄像机',
      defaultProps: { x: 0, y: 0, zoom: 1 },
      canAddChild: false,
    },
    Node3D: {
      icon: '📦', desc: '3D 空节点',
      defaultProps: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
      canAddChild: true,
      validChildren: ['Node3D', 'Mesh3D', 'Camera3D', 'Light3D'],
    },
    Mesh3D: {
      icon: '🔷', desc: '3D 网格体',
      defaultProps: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, meshType: 'box', color: '#4C97FF', scale: 1 },
      canAddChild: false,
    },
    Camera3D: {
      icon: '🎥', desc: '3D 摄像机',
      defaultProps: { x: 0, y: 2, z: 5, rx: 0, ry: 0, rz: 0, fov: 75 },
      canAddChild: false,
    },
    Light3D: {
      icon: '💡', desc: '3D 灯光',
      defaultProps: { x: 2, y: 4, z: 2, color: '#ffffff', intensity: 1, range: 10 },
      canAddChild: false,
    },
    // ===== Control UI 节点类型 =====
    SceneUI: {
      icon: '🖼️', desc: 'Control UI 场景',
      defaultProps: {},
      canAddChild: true,
      validChildren: ['NodeUI', 'ButtonUI', 'LabelUI', 'ImageUI', 'PanelUI'],
    },
    NodeUI: {
      icon: '⬛', desc: 'UI 容器节点',
      defaultProps: { x: 0, y: 0, width: 100, height: 40 },
      canAddChild: true,
      validChildren: ['NodeUI', 'ButtonUI', 'LabelUI', 'ImageUI', 'PanelUI'],
    },
    ButtonUI: {
      icon: '🔘', desc: '按钮',
      defaultProps: { x: 10, y: 10, width: 120, height: 36, text: '按钮', color: '#89b4fa', textColor: '#1e1e2e' },
      canAddChild: false,
    },
    LabelUI: {
      icon: '📝', desc: '文本标签',
      defaultProps: { x: 10, y: 10, text: '文本', fontSize: 16, color: '#cdd6f4' },
      canAddChild: false,
    },
    ImageUI: {
      icon: '🖼️', desc: '图片',
      defaultProps: { x: 10, y: 10, width: 64, height: 64, src: '' },
      canAddChild: false,
    },
    PanelUI: {
      icon: '🪟', desc: '面板',
      defaultProps: { x: 10, y: 10, width: 200, height: 120, bgColor: '#313244', borderColor: '#45475a' },
      canAddChild: true,
      validChildren: ['NodeUI', 'ButtonUI', 'LabelUI', 'ImageUI', 'PanelUI'],
    },
    // ===== 场景引用节点 =====
    SceneRef: {
      icon: '🔗', desc: '引用其他场景（实例化）',
      defaultProps: { scenePath: '' },
      canAddChild: false,
    },
  };

  // 场景根节点模式列表
  const SCENE_MODES = ['Scene2D', 'Scene3D', 'SceneUI'];
  const SCENE_MODE_LABELS = { Scene2D: '2D', Scene3D: '3D', SceneUI: 'UI' };

  /** 生成唯一ID */
  function _genId() {
    return 'node_' + (_nextId++);
  }

  /** 创建节点 */
  function _createNode(type, name, parentId) {
    const typeInfo = NODE_TYPES[type];
    if (!typeInfo) return null;
    const id = _genId();
    const node = {
      id: id,
      type: type,
      name: name || type,
      parent: parentId || null,
      children: [],
      properties: { ...typeInfo.defaultProps },
      spriteRef: null,   // Sprite2D 关联的 StageManager 精灵索引
      script: '',        // JS 脚本
      blocks: {},        // 积木数据
      expanded: true,
      visible: true,
      locked: false,
    };
    _nodes[id] = node;
    return id;
  }

  /** 初始化默认场景 */
  function init(renderMode) {
    _nodes = {};
    _nextId = 1;
    _selectedId = null;

    const sceneType = renderMode === '3d' ? 'Scene3D' : (renderMode === 'ui' ? 'SceneUI' : 'Scene2D');
    _rootId = _createNode(sceneType, '主场景', null);

    // 添加一个默认精灵
    const spriteId = _createNode('Sprite2D', '精灵1', _rootId);
    if (_rootId && _nodes[_rootId]) {
      _nodes[_rootId].children.push(spriteId);
    }

    _selectedId = spriteId;
    return _rootId;
  }

  /** 添加节点 */
  function addNode(type, name, parentId) {
    const parent = parentId ? _nodes[parentId] : _nodes[_rootId];
    if (!parent) return null;

    // 检查类型兼容性
    const parentType = NODE_TYPES[parent.type];
    if (parentType && parentType.validChildren && !parentType.validChildren.includes(type)) {
      console.warn(`[SceneGraph] ${parent.type} 不允许子节点类型 ${type}`);
      // 仍然允许，但给出警告
    }

    const id = _createNode(type, name, parent.id);
    if (id) {
      parent.children.push(id);
    }
    return id;
  }

  /** 删除节点（含子树） */
  function removeNode(id) {
    if (id === _rootId) return false; // 不允许删除根节点
    const node = _nodes[id];
    if (!node) return false;

    // 递归删除子节点
    node.children.forEach(childId => removeNode(childId));

    // 从父节点移除
    if (node.parent && _nodes[node.parent]) {
      const parent = _nodes[node.parent];
      parent.children = parent.children.filter(cid => cid !== id);
    }

    delete _nodes[id];

    if (_selectedId === id) {
      _selectedId = node.parent || _rootId;
    }
    return true;
  }

  /** 移动节点到新父节点 */
  function moveNode(id, newParentId, insertIndex) {
    if (id === _rootId || id === newParentId) return false;
    const node = _nodes[id];
    const newParent = _nodes[newParentId];
    if (!node || !newParent) return false;

    // 防止循环引用（不能移动到自身子节点下）
    let check = newParentId;
    while (check) {
      if (check === id) return false;
      check = _nodes[check] ? _nodes[check].parent : null;
    }

    // 从旧父节点移除
    if (node.parent && _nodes[node.parent]) {
      _nodes[node.parent].children = _nodes[node.parent].children.filter(cid => cid !== id);
    }

    // 添加到新父节点
    node.parent = newParentId;
    if (insertIndex !== undefined && insertIndex >= 0) {
      newParent.children.splice(insertIndex, 0, id);
    } else {
      newParent.children.push(id);
    }
    return true;
  }

  /** 获取节点 */
  function getNode(id) {
    return _nodes[id] || null;
  }

  /** 获取子节点列表 */
  function getNodeChildren(id) {
    const node = _nodes[id];
    if (!node) return [];
    return node.children.map(cid => _nodes[cid]).filter(Boolean);
  }

  /** 获取根节点 */
  function getRoot() {
    return _nodes[_rootId] || null;
  }

  /** 获取根节点ID */
  function getRootId() {
    return _rootId;
  }

  /** 选中节点 */
  function selectNode(id) {
    if (_nodes[id]) {
      _selectedId = id;
    }
  }

  /** 获取选中节点ID */
  function getSelectedId() {
    return _selectedId;
  }

  /** 获取选中节点 */
  function getSelectedNode() {
    return _nodes[_selectedId] || null;
  }

  /** 深度优先扁平化遍历（用于渲染场景树） */
  function flatten() {
    const result = [];
    function _walk(id, depth) {
      const node = _nodes[id];
      if (!node) return;
      result.push({ node, depth });
      node.children.forEach(cid => _walk(cid, depth + 1));
    }
    if (_rootId) _walk(_rootId, 0);
    return result;
  }

  /** 获取所有 Sprite2D 节点（用于兼容 StageManager） */
  function getSprites() {
    const sprites = [];
    Object.values(_nodes).forEach(node => {
      if (node.type === 'Sprite2D') {
        sprites.push(node);
      }
    });
    return sprites;
  }

  /** 获取节点的全局变换（累加父节点的位置） */
  function getGlobalPosition(id) {
    let gx = 0, gy = 0;
    let current = _nodes[id];
    while (current) {
      gx += (current.properties.x || 0);
      gy += (current.properties.y || 0);
      current = current.parent ? _nodes[current.parent] : null;
    }
    return { x: gx, y: gy };
  }

  /** 获取节点深度 */
  function getDepth(id) {
    let depth = 0;
    let current = _nodes[id];
    while (current && current.parent) {
      depth++;
      current = _nodes[current.parent];
    }
    return depth;
  }

  /** 获取节点类型信息 */
  function getNodeType(type) {
    return NODE_TYPES[type] || null;
  }

  /** 获取所有支持的节点类型 */
  function getNodeTypes() {
    return NODE_TYPES;
  }

  /** 获取给定父节点允许的子节点类型 */
  function getValidChildTypes(parentId) {
    const parent = _nodes[parentId];
    if (!parent) return Object.keys(NODE_TYPES);
    const parentType = NODE_TYPES[parent.type];
    if (!parentType || !parentType.canAddChild) return [];
    return parentType.validChildren || Object.keys(NODE_TYPES);
  }

  /** 复制节点（含子树），返回新节点ID */
  function duplicateNode(id) {
    const node = _nodes[id];
    if (!node || id === _rootId) return null;

    // 深拷贝当前节点
    const newId = _createNode(node.type, node.name + ' 副本', node.parent);
    if (!newId) return null;
    const newNode = _nodes[newId];
    newNode.properties = JSON.parse(JSON.stringify(node.properties));
    newNode.script = node.script;
    newNode.blocks = JSON.parse(JSON.stringify(node.blocks || {}));
    newNode.visible = node.visible;

    // 递归复制子节点
    function _copyChildren(srcId, destId) {
      const src = _nodes[srcId];
      const dest = _nodes[destId];
      if (!src || !dest) return;
      src.children.forEach(childId => {
        const child = _nodes[childId];
        if (!child) return;
        const newChildId = _createNode(child.type, child.name, destId);
        if (!newChildId) return;
        const newChild = _nodes[newChildId];
        newChild.properties = JSON.parse(JSON.stringify(child.properties));
        newChild.script = child.script;
        newChild.blocks = JSON.parse(JSON.stringify(child.blocks || {}));
        newChild.visible = child.visible;
        dest.children.push(newChildId);
        _copyChildren(childId, newChildId);
      });
    }
    _copyChildren(id, newId);

    // 添加到父节点
    if (node.parent && _nodes[node.parent]) {
      _nodes[node.parent].children.push(newId);
    }

    return newId;
  }

  /** 重命名节点 */
  function renameNode(id, newName) {
    if (_nodes[id]) {
      _nodes[id].name = newName;
    }
  }

  /** 更新节点属性 */
  function updateProperty(id, prop, value) {
    if (_nodes[id]) {
      _nodes[id].properties[prop] = value;
    }
  }

  /** 序列化 */
  function toJSON() {
    return {
      rootId: _rootId,
      nextId: _nextId,
      nodes: _nodes,
    };
  }

  /** 反序列化 */
  function fromJSON(data) {
    if (!data || !data.nodes) return;
    _nodes = data.nodes || {};
    _rootId = data.rootId || null;
    _nextId = data.nextId || 1;
    _selectedId = _rootId;
  }

  /** 切换节点展开/折叠 */
  function toggleExpand(id) {
    if (_nodes[id]) {
      _nodes[id].expanded = !_nodes[id].expanded;
    }
  }

  /** 设置节点可见性 */
  function setVisible(id, visible) {
    if (_nodes[id]) {
      _nodes[id].visible = visible;
    }
  }

  /** 设置节点锁定 */
  function setLocked(id, locked) {
    if (_nodes[id]) {
      _nodes[id].locked = locked;
    }
  }

  /** 获取根节点的当前模式 */
  function getRootMode() {
    const root = _nodes[_rootId];
    return root ? root.type : null;
  }

  /** 切换根节点的场景模式（2D/3D/UI） */
  function switchRootMode(newMode) {
    if (!SCENE_MODES.includes(newMode)) return false;
    const root = _nodes[_rootId];
    if (!root) return false;
    if (root.type === newMode) return false;
    root.type = newMode;
    return true;
  }

  /** 获取所有场景模式 */
  function getSceneModes() { return SCENE_MODES; }
  function getSceneModeLabels() { return SCENE_MODE_LABELS; }

  /** 列出项目中所有已保存的场景文件（用于 SceneRef 选择） */
  async function listScenes() {
    if (!window.api || !window.api.listDir || typeof EditorState === 'undefined' || !EditorState.projectPath) return [];
    const scenes = [];
    try {
      let scenesDir;
      if (window.api.pathJoin) {
        scenesDir = await window.api.pathJoin(EditorState.projectPath, 'scenes');
      } else {
        scenesDir = EditorState.projectPath.replace(/[\\/]+$/, '') + '/scenes';
      }
      const items = await window.api.listDir(scenesDir);
      if (Array.isArray(items)) {
        for (const name of items) {
          if (name.endsWith('.scene.json')) {
            let fullPath;
            if (window.api.pathJoin) {
              fullPath = await window.api.pathJoin(scenesDir, name);
            } else {
              fullPath = scenesDir + '/' + name;
            }
            scenes.push({ name, path: fullPath });
          }
        }
      }
    } catch (e) {
      // scenes 目录不存在时不报错
    }
    return scenes;
  }

  /** 加载被引用的场景数据（SceneRef） */
  async function loadReferencedScene(filePath) {
    if (!filePath || !window.api || !window.api.readFile) return null;
    try {
      const content = await window.api.readFile(filePath);
      if (!content || !content.trim()) return null;
      return JSON.parse(content);
    } catch (e) {
      console.warn('[SceneGraph] 加载引用场景失败:', filePath, e);
      return null;
    }
  }

  return {
    init, addNode, removeNode, moveNode,
    getNode, getNodeChildren, getRoot, getRootId,
    selectNode, getSelectedId, getSelectedNode,
    flatten, getSprites, getGlobalPosition, getDepth,
    getNodeType, getNodeTypes, getValidChildTypes,
    duplicateNode, renameNode, updateProperty,
    toggleExpand, setVisible, setLocked,
    toJSON, fromJSON,
    getRootMode, switchRootMode, getSceneModes, getSceneModeLabels,
    listScenes, loadReferencedScene,
  };
})();
