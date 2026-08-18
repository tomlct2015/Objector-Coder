/**
 * FileSystemDock - 文件系统面板（高级模式）
 * 使用 Electron 真实文件系统 API（listDir/readFile/writeFile）
 * 支持场景切换、脚本编辑、新建文件/文件夹
 */
const FileSystemDock = (function () {
  let _container = null;
  let _expandedFolders = new Set();
  let _projectPath = '';

  // 文件类型图标映射
  const FILE_ICONS = {
    '.json': '📄',
    '.js': '📜',
    '.scene.json': '🎬',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.jpeg': '🖼️',
    '.gif': '🖼️',
    '.svg': '🖼️',
    '.webp': '🖼️',
    '.mp3': '🔊',
    '.wav': '🔊',
    '.ogg': '🔊',
    '.html': '🌐',
    '.css': '🎨',
    'folder': '📁',
    'folder-open': '📂',
    'default': '📄',
  };

  /** 初始化 */
  function init() {
    _container = document.getElementById('file-tree');
    if (!_container) return;

    // 绑定刷新按钮
    const refreshBtn = document.getElementById('btn-refresh-fs');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', refresh);
    }

    // 绑定新建场景按钮
    const newSceneBtn = document.getElementById('btn-new-scene');
    if (newSceneBtn) {
      newSceneBtn.addEventListener('click', _createNewScene);
    }

    // 绑定新建文件按钮
    const newFileBtn = document.getElementById('btn-new-file');
    if (newFileBtn) {
      newFileBtn.addEventListener('click', _createNewFile);
    }

    // 绑定新建文件夹按钮
    const newFolderBtn = document.getElementById('btn-new-folder');
    if (newFolderBtn) {
      newFolderBtn.addEventListener('click', _createNewFolder);
    }

    // 左侧分割条拖拽
    const divider = document.getElementById('left-divider');
    const scenePanel = document.getElementById('scene-tree-panel');
    if (divider && scenePanel) {
      let dragging = false;
      divider.addEventListener('mousedown', (e) => {
        dragging = true;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dock = document.getElementById('left-dock');
        if (!dock) return;
        const rect = dock.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        scenePanel.style.height = Math.max(100, Math.min(newHeight, rect.height - 100)) + 'px';
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }

    _projectPath = (typeof EditorState !== 'undefined') ? EditorState.projectPath : '';
    refresh();
  }

  /** 刷新文件列表 */
  async function refresh() {
    if (!_container) return;
    _projectPath = (typeof EditorState !== 'undefined') ? EditorState.projectPath : '';
    if (!_projectPath) {
      _container.innerHTML = '<p class="inspector-hint">未打开项目</p>';
      return;
    }

    _container.innerHTML = '<p class="inspector-hint">加载中...</p>';
    await _loadDirectory(_projectPath, 0, _container);
  }

  /** 加载目录内容（使用 Electron 文件系统 API） */
  async function _loadDirectory(dirPath, depth, parentEl) {
    let entries = [];

    try {
      // 使用 Electron API 列出真实目录
      if (window.api && window.api.listDir) {
        const items = await window.api.listDir(dirPath);
        if (Array.isArray(items)) {
          for (const name of items) {
            // 跳过隐藏文件
            if (name.startsWith('.')) continue;
            // 跳过 node_modules
            if (name === 'node_modules') continue;

            // 使用 pathJoin 构建路径（跨平台安全，Windows 自动用 \）
            let fullPath;
            if (window.api.pathJoin) {
              fullPath = await window.api.pathJoin(dirPath, name);
            } else {
              fullPath = dirPath.replace(/[\\/]+$/, '') + '/' + name;
            }

            // 使用 isDir API 正确判断是否为目录
            let isDir = false;
            if (window.api.isDir) {
              isDir = await window.api.isDir(fullPath);
            }

            entries.push({ name, isDir, path: fullPath });
          }
        }
      }
    } catch (e) {
      console.warn('[FileSystem] 读取目录失败:', e);
    }

    if (entries.length === 0) {
      if (depth === 0) {
        parentEl.innerHTML = '<p class="inspector-hint">空目录</p>';
      }
      return;
    }

    // 排序：文件夹在前，文件在后
    entries.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name);
    });

    // 清空加载中提示
    if (depth === 0 && parentEl.querySelector('.inspector-hint')) {
      parentEl.innerHTML = '';
    }

    for (const entry of entries) {
      await _renderEntry(entry, dirPath, depth, parentEl);
    }
  }

  /** 渲染文件/文件夹条目 */
  async function _renderEntry(entry, parentPath, depth, parentEl) {
    const row = document.createElement('div');
    row.className = 'fs-entry';
    row.style.paddingLeft = (8 + depth * 14) + 'px';

    const icon = document.createElement('span');
    icon.className = 'fs-icon';

    if (entry.isDir) {
      const isExpanded = _expandedFolders.has(entry.path);
      icon.textContent = isExpanded ? FILE_ICONS['folder-open'] : FILE_ICONS['folder'];

      const name = document.createElement('span');
      name.className = 'fs-name';
      name.textContent = entry.name;

      row.appendChild(icon);
      row.appendChild(name);

      row.addEventListener('click', () => {
        if (_expandedFolders.has(entry.path)) {
          _expandedFolders.delete(entry.path);
        } else {
          _expandedFolders.add(entry.path);
        }
        refresh();
      });

      // 文件夹右键菜单
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showFolderContextMenu(e, entry);
      });

      parentEl.appendChild(row);

      // 递归渲染子目录
      if (_expandedFolders.has(entry.path)) {
        const subContainer = document.createElement('div');
        subContainer.className = 'fs-subdir';
        parentEl.appendChild(subContainer);
        await _loadDirectory(entry.path, depth + 1, subContainer);
      }
    } else {
      icon.textContent = _getFileIcon(entry.name);
      const name = document.createElement('span');
      name.className = 'fs-name';
      name.textContent = entry.name;

      row.appendChild(icon);
      row.appendChild(name);

      // 双击打开
      row.addEventListener('dblclick', () => {
        _openFile(entry);
      });

      // 文件右键菜单
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _showFileContextMenu(e, entry);
      });

      parentEl.appendChild(row);
    }
  }

  /** 获取文件图标 */
  function _getFileIcon(filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.scene.json')) return FILE_ICONS['.scene.json'];
    for (const [ext, ic] of Object.entries(FILE_ICONS)) {
      if (ext !== 'folder' && ext !== 'folder-open' && ext !== 'default' && lower.endsWith(ext)) {
        return ic;
      }
    }
    return FILE_ICONS['default'];
  }

  /** 打开文件 */
  async function _openFile(entry) {
    const lower = entry.name.toLowerCase();
    console.log('[FileSystem] 打开文件:', entry.name, '路径:', entry.path);

    if (lower.endsWith('.scene.json')) {
      await _loadSceneFile(entry.path);
    } else if (lower.endsWith('.js')) {
      await _openJsFile(entry.path);
    } else if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(lower)) {
      _previewImage(entry.path);
    }
  }

  /** 加载场景文件 */
  async function _loadSceneFile(filePath) {
    try {
      if (!window.api || !window.api.readFile) {
        alert('文件系统 API 不可用');
        return;
      }
      console.log('[FileSystem] 打开场景文件:', filePath);
      const content = await window.api.readFile(filePath);
      if (content === null || content === undefined) {
        alert('场景文件不存在: ' + filePath);
        return;
      }
      if (!content.trim()) {
        alert('场景文件为空，请先保存场景后再打开');
        return;
      }
      const sceneData = JSON.parse(content);
      if ((sceneData.rootId || sceneData.nodes) && typeof SceneGraph !== 'undefined') {
        SceneGraph.fromJSON(sceneData);
        if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
        if (typeof SceneTree !== 'undefined') SceneTree.refresh();
        if (typeof Inspector !== 'undefined') {
          const root = SceneGraph.getRoot();
          if (root) Inspector.showNode(root.id);
        }

        // 3D 和 UI 场景仅支持 JS 脚本，隐藏积木 tab 并自动切换到 JS
        if (typeof SceneGraph !== 'undefined' && SceneGraph.isJsOnly && SceneGraph.isJsOnly()) {
          const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
          const jsTab = document.querySelector('.script-tab[data-tab="js"]');
          if (blocksTab) blocksTab.classList.add('hidden');
          if (jsTab && !jsTab.classList.contains('active')) jsTab.click();

          // 3D 场景：同步 Mesh3D 节点到 Three.js 渲染
          const sceneType = SceneGraph.getSceneType ? SceneGraph.getSceneType() : null;
          if (sceneType === 'Scene3D' && typeof Stage3D !== 'undefined' && Stage3D.isInitialized && Stage3D.isInitialized()) {
            Stage3D.syncMeshesFromSceneGraph();
          }
        } else {
          const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
          if (blocksTab) blocksTab.classList.remove('hidden');
        }

        document.getElementById('status-text').textContent = '已加载场景: ' + (sceneData.name || filePath);
      } else {
        alert('无效的场景文件格式');
      }
    } catch (e) {
      console.error('[FileSystem] 加载场景失败:', e);
      alert('场景加载失败: ' + e.message);
    }
  }

  /** 在 JS 编辑器中打开文件 */
  async function _openJsFile(filePath) {
    try {
      if (!window.api || !window.api.readFile) return;
      const content = await window.api.readFile(filePath);
      if (content === null || content === undefined) return;
      if (typeof EditorApp !== 'undefined' && EditorApp.getJsEditor) {
        const editor = EditorApp.getJsEditor();
        if (editor) {
          editor.setValue(content);
          // 切换到 JS tab
          const jsTab = document.querySelector('.script-tab[data-tab="js"]');
          if (jsTab) jsTab.click();
        }
      }
    } catch (e) {
      console.error('[FileSystem] 打开脚本失败:', e);
    }
  }

  /** 预览图片 */
  async function _previewImage(filePath) {
    try {
      if (!window.api || !window.api.readFile) return;
      const lower = filePath.toLowerCase();
      if (/\.(png|jpg|jpeg|gif|svg|webp)$/.test(lower)) {
        document.getElementById('status-text').textContent = '图片: ' + filePath.split('/').pop();
      }
    } catch (e) {
      console.error('[FileSystem] 预览图片失败:', e);
    }
  }

  // ===================== 创建场景 =====================

  /** 创建新场景文件 */
  async function _createNewScene() {
    if (!_projectPath) {
      alert('请先打开项目');
      return;
    }
    const result = await _showSceneTypeDialog();
    if (!result) return;

    const { sceneType, sceneName } = result;
    const safeName = sceneName.trim().replace(/[<>:"/\\|?*]/g, '_');
    if (!safeName) return;

    try {
      if (!window.api || !window.api.writeFile || !window.api.ensureDir || !window.api.pathJoin) {
        alert('文件系统 API 不可用');
        return;
      }

      // 确保 scenes 目录存在
      const scenesDir = await window.api.pathJoin(_projectPath, 'scenes');
      await window.api.ensureDir(scenesDir);

      // 确保 scripts 目录存在
      const scriptsDir = await window.api.pathJoin(_projectPath, 'scripts');
      await window.api.ensureDir(scriptsDir);

      // 构建场景模板数据
      const sceneData = _buildSceneTemplate(sceneType, safeName);
      const sceneFilePath = await window.api.pathJoin(scenesDir, safeName + '.scene.json');

      // 写入场景文件
      const writeResult = await window.api.writeFile(sceneFilePath, JSON.stringify(sceneData, null, 2));
      if (writeResult && writeResult.error) {
        alert('创建场景文件失败: ' + writeResult.error);
        return;
      }

      // 写入对应 JS 脚本文件
      const jsFilePath = await window.api.pathJoin(scriptsDir, safeName + '.js');
      const jsTemplate = _buildSceneJsTemplate(sceneType, safeName);
      await window.api.writeFile(jsFilePath, jsTemplate);

      // 刷新文件列表
      _expandedFolders.add(scenesDir);
      _expandedFolders.add(scriptsDir);
      await refresh();

      document.getElementById('status-text').textContent = '已创建场景: ' + safeName + ' (' + (sceneType === '3d' ? '3D' : sceneType === 'ui' ? 'UI' : '2D') + ')';
    } catch (e) {
      console.error('[FileSystem] 创建场景失败:', e);
      alert('创建场景失败: ' + e.message);
    }
  }

  /** 构建场景模板数据 */
  function _buildSceneTemplate(sceneType, name) {
    let rootType, rootName, childNode;

    if (sceneType === '3d') {
      rootType = 'Scene3D';
      rootName = name + ' 场景';
      childNode = {
        id: 'node_2', type: 'Mesh3D', name: '网格体1',
        parent: 'node_1', children: [],
        properties: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, meshType: 'box', color: '#4C97FF', scale: 1 },
        spriteRef: null, script: '', blocks: {}, expanded: true, visible: true, locked: false,
      };
    } else if (sceneType === '2d') {
      rootType = 'Scene2D';
      rootName = name + ' 场景';
      childNode = {
        id: 'node_2', type: 'Sprite2D', name: '精灵1',
        parent: 'node_1', children: [],
        properties: { x: 0, y: 0, direction: 90, size: 100, color: '#4C97FF', costumeName: '', rotationStyle: 'allAround' },
        spriteRef: null, script: '', blocks: {}, expanded: true, visible: true, locked: false,
      };
    } else {
      rootType = 'SceneUI';
      rootName = name + ' UI 场景';
      childNode = {
        id: 'node_2', type: 'UIPanel', name: '面板',
        parent: 'node_1', children: [],
        properties: { x: 0, y: 0, width: 200, height: 150, bgColor: '#313244', borderRadius: 6, opacity: 1 },
        spriteRef: null, script: '', blocks: {}, expanded: true, visible: true, locked: false,
      };
    }

    return {
      name: name,
      sceneType: sceneType,
      rootId: 'node_1',
      nextId: 3,
      nodes: {
        'node_1': {
          id: 'node_1', type: rootType, name: rootName,
          parent: null, children: ['node_2'],
          properties: {}, spriteRef: null, script: '', blocks: {},
          expanded: true, visible: true, locked: false,
        },
        'node_2': childNode,
      },
    };
  }

  /** 构建场景 JS 脚本模板 */
  function _buildSceneJsTemplate(sceneType, name) {
    if (sceneType === '3d') {
      return '// ' + name + ' 3D 场景脚本\n'
        + '// 可用对象：scene（当前场景）、THREE（Three.js 库）\n'
        + '// 可用方法：scene.add(mesh)、scene.remove(mesh)、scene.update(fn)\n'
        + '\n'
        + '// 场景初始化\n'
        + 'function onStart() {\n'
        + '  console.log("' + name + ' 3D 场景已启动");\n'
        + '}\n'
        + '\n'
        + '// 每帧更新（约 60fps）\n'
        + 'function onUpdate(deltaTime) {\n'
        + '  // 在这里编写每帧执行的逻辑\n'
        + '}\n';
    } else if (sceneType === '2d') {
      return '// ' + name + ' 2D 场景脚本\n'
        + '// 可用对象：sprite（当前精灵）、stage（舞台）\n'
        + '// 可用方法：sprite.x、sprite.y、sprite.move(steps)、sprite.say(text)\n'
        + '\n'
        + '// 场景初始化\n'
        + 'function onStart() {\n'
        + '  console.log("' + name + ' 2D 场景已启动");\n'
        + '}\n'
        + '\n'
        + '// 每帧更新（约 60fps）\n'
        + 'function onUpdate(deltaTime) {\n'
        + '  // 在这里编写每帧执行的逻辑\n'
        + '}\n';
    } else {
      return '// ' + name + ' UI 场景脚本\n'
        + '// 可用对象：ui（当前 UI 场景）、document（DOM）\n'
        + '// 可用方法：ui.createButton()、ui.createText()、ui.createPanel()\n'
        + '\n'
        + '// UI 初始化\n'
        + 'function onStart() {\n'
        + '  console.log("' + name + ' UI 场景已加载");\n'
        + '\n'
        + '  // 示例：创建按钮\n'
        + '  // const btn = ui.createButton({ text: "点击我", x: 100, y: 50 });\n'
        + '  // btn.onClick(() => { console.log("按钮被点击了！"); });\n'
        + '}\n'
        + '\n'
        + '// UI 事件处理\n'
        + 'function onEvent(eventName, data) {\n'
        + '  switch (eventName) {\n'
        + '    case "click":\n'
        + '      console.log("点击事件:", data);\n'
        + '      break;\n'
        + '  }\n'
        + '}\n';
    }
  }

  /** 显示场景类型选择对话框 */
  function _showSceneTypeDialog() {
    return new Promise((resolve) => {
      let selectedType = null;

      const overlay = document.createElement('div');
      overlay.className = 'scene-type-dialog';
      overlay.innerHTML = `
        <div class="scene-type-dialog-box">
          <h3>🎬 新建场景</h3>
          <p>选择场景类型：</p>
          <div class="scene-type-cards">
            <div class="scene-type-card" data-type="2d">
              <div class="scene-type-card-icon">🎬</div>
              <div class="scene-type-card-name">2D 场景</div>
              <div class="scene-type-card-desc">经典 2D 平面创作<br>精灵、运动、物理系统</div>
              <div class="scene-type-card-badge" style="background:rgba(249,226,175,0.2);color:#f9e2af;">积木 + JS</div>
            </div>
            <div class="scene-type-card" data-type="3d">
              <div class="scene-type-card-icon">🌐</div>
              <div class="scene-type-card-name">3D 场景</div>
              <div class="scene-type-card-desc">使用 Three.js 渲染<br>3D 网格、相机、灯光</div>
              <div class="scene-type-card-badge" style="background:rgba(137,180,250,0.2);color:#89b4fa;">仅 JS 脚本</div>
            </div>
            <div class="scene-type-card" data-type="ui">
              <div class="scene-type-card-icon">🖥️</div>
              <div class="scene-type-card-name">UI 场景</div>
              <div class="scene-type-card-desc">界面布局与设计<br>面板、按钮、文本、图片</div>
              <div class="scene-type-card-badge" style="background:rgba(166,227,161,0.2);color:#a6e3a1;">仅 JS 脚本</div>
            </div>
          </div>
          <p>场景名称：</p>
          <input type="text" id="scene-name-input" value="new-scene" />
          <div class="scene-type-dialog-actions">
            <button id="scene-dialog-cancel" class="tb-btn" style="background:var(--bg-surface,#313244);color:var(--text-primary,#cdd6f4);border:1px solid var(--border,#45475a);border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;">取消</button>
            <button id="scene-dialog-ok" class="tb-btn" style="background:var(--accent,#89b4fa);color:#1e1e2e;border:none;border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;font-weight:600;" disabled>创建</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const cards = overlay.querySelectorAll('.scene-type-card');
      const okBtn = overlay.querySelector('#scene-dialog-ok');
      const cancelBtn = overlay.querySelector('#scene-dialog-cancel');
      const nameInput = overlay.querySelector('#scene-name-input');

      cards.forEach(card => {
        card.addEventListener('click', () => {
          cards.forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          selectedType = card.dataset.type;
          okBtn.disabled = false;
        });
      });

      nameInput.focus();
      nameInput.select();

      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      okBtn.addEventListener('click', () => {
        if (!selectedType) return;
        const name = nameInput.value.trim();
        if (!name) { nameInput.focus(); return; }
        document.body.removeChild(overlay);
        resolve({ sceneType: selectedType, sceneName: name });
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && selectedType) {
          okBtn.click();
        }
        if (e.key === 'Escape') {
          cancelBtn.click();
        }
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  // ===================== 创建文件/文件夹 =====================

  /** 创建新文件 */
  async function _createNewFile() {
    if (!_projectPath) {
      alert('请先打开项目');
      return;
    }
    const fileName = await _showInputDialog('新建文件', '输入文件名（如 script.js 或 data.json）:', 'untitled.js');
    if (!fileName || !fileName.trim()) return;

    const trimmed = fileName.trim();

    try {
      if (!window.api || !window.api.writeFile) {
        alert('文件系统 API 不可用');
        return;
      }

      // 使用 pathJoin 构建路径（跨平台安全）
      let filePath;
      if (window.api.pathJoin) {
        filePath = await window.api.pathJoin(_projectPath, trimmed);
      } else {
        filePath = _projectPath.replace(/[\\/]+$/, '') + '/' + trimmed;
      }

      // 确保父目录存在
      if (window.api.ensureDir) {
        const dirPath = filePath.substring(0, Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')));
        const dirResult = await window.api.ensureDir(dirPath);
        if (dirResult && dirResult.error) {
          alert('创建目录失败: ' + dirResult.error);
          return;
        }
      }

      // 写入文件
      const result = await window.api.writeFile(filePath, '');
      if (result && result.error) {
        alert('创建文件失败: ' + result.error);
        return;
      }

      await refresh();
      document.getElementById('status-text').textContent = '已创建文件: ' + trimmed;
    } catch (e) {
      console.error('[FileSystem] 创建文件失败:', e);
      alert('创建文件失败: ' + e.message);
    }
  }

  /** 创建新文件夹 */
  async function _createNewFolder() {
    if (!_projectPath) {
      alert('请先打开项目');
      return;
    }
    const folderName = await _showInputDialog('新建文件夹', '输入文件夹名称:', 'new-folder');
    if (!folderName || !folderName.trim()) return;

    const trimmed = folderName.trim();

    try {
      if (!window.api || !window.api.ensureDir) {
        alert('文件系统 API 不可用');
        return;
      }

      // 使用 pathJoin 构建路径（跨平台安全）
      let folderPath;
      if (window.api.pathJoin) {
        folderPath = await window.api.pathJoin(_projectPath, trimmed);
      } else {
        folderPath = _projectPath.replace(/[\\/]+$/, '') + '/' + trimmed;
      }

      const result = await window.api.ensureDir(folderPath);
      if (result && result.error) {
        alert('创建文件夹失败: ' + result.error);
        return;
      }

      await refresh();
      document.getElementById('status-text').textContent = '已创建文件夹: ' + trimmed;
    } catch (e) {
      console.error('[FileSystem] 创建文件夹失败:', e);
      alert('创建文件夹失败: ' + e.message);
    }
  }

  /** 显示输入对话框（Promise 封装） */
  function _showInputDialog(title, message, defaultValue) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'dialog-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
      overlay.innerHTML = `
        <div style="background:var(--bg-secondary,#181825);border:1px solid var(--border,#45475a);border-radius:10px;padding:20px;min-width:320px;max-width:420px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:var(--accent,#89b4fa);">${title}</h3>
          <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary,#a6adc8);">${message}</p>
          <input type="text" id="dialog-input" value="${defaultValue || ''}" style="width:100%;padding:8px 10px;background:var(--bg-surface,#313244);border:1px solid var(--border,#45475a);border-radius:6px;color:var(--text-primary,#cdd6f4);font-size:13px;outline:none;" />
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button id="dialog-cancel" class="tb-btn" style="background:var(--bg-surface,#313244);color:var(--text-primary,#cdd6f4);border:1px solid var(--border,#45475a);border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;">取消</button>
            <button id="dialog-ok" class="tb-btn" style="background:var(--accent,#89b4fa);color:#1e1e2e;border:none;border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;font-weight:600;">确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#dialog-input');
      input.focus();
      input.select();

      overlay.querySelector('#dialog-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      overlay.querySelector('#dialog-ok').addEventListener('click', () => {
        const val = input.value;
        document.body.removeChild(overlay);
        resolve(val);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const val = input.value;
          document.body.removeChild(overlay);
          resolve(val);
        }
        if (e.key === 'Escape') {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  // ===================== 右键菜单 =====================

  /** 显示文件右键菜单 */
  function _showFileContextMenu(e, entry) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    menu.innerHTML = `
      <div class="ctx-item" data-action="open">📂 打开</div>
      <div class="ctx-item" data-action="rename">✏️ 重命名</div>
      <div class="ctx-item" data-action="delete" style="color:var(--red,#f38ba8);">🗑️ 删除</div>
    `;

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');

    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        _handleFileAction(item.dataset.action, entry);
        menu.classList.add('hidden');
      });
    });

    const closeMenu = () => {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /** 显示文件夹右键菜单 */
  function _showFolderContextMenu(e, entry) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;

    menu.innerHTML = `
      <div class="ctx-item" data-action="new-scene">🎬 新建场景</div>
      <div class="ctx-item" data-action="new-file">📄 新建文件</div>
      <div class="ctx-item" data-action="new-folder">📁 新建文件夹</div>
      <div class="ctx-item" data-action="rename">✏️ 重命名</div>
      <div class="ctx-item" data-action="delete" style="color:var(--red,#f38ba8);">🗑️ 删除</div>
    `;

    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    menu.classList.remove('hidden');

    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        _handleFolderAction(item.dataset.action, entry);
        menu.classList.add('hidden');
      });
    });

    const closeMenu = () => {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  /** 处理文件操作 */
  async function _handleFileAction(action, entry) {
    switch (action) {
      case 'open':
        await _openFile(entry);
        break;
      case 'rename': {
        const newName = await _showInputDialog('重命名', '输入新名称:', entry.name);
        if (newName && newName !== entry.name) {
          try {
            const oldPath = entry.path;
            const newPath = oldPath.replace(/[^/\\]+$/, newName);
            if (window.api && window.api.readFile && window.api.writeFile && window.api.deleteFile) {
              const content = await window.api.readFile(oldPath);
              if (content !== null && content !== undefined) {
                await window.api.writeFile(newPath, content);
                await window.api.deleteFile(oldPath);
              }
            }
            refresh();
          } catch (e) {
            alert('重命名失败: ' + e.message);
          }
        }
        break;
      }
      case 'delete': {
        if (!confirm('确定删除 "' + entry.name + '" 吗？')) return;
        try {
          if (window.api && window.api.deleteFile) {
            await window.api.deleteFile(entry.path);
          }
          refresh();
        } catch (e) {
          alert('删除失败: ' + e.message);
        }
        break;
      }
    }
  }

  /** 处理文件夹操作 */
  async function _handleFolderAction(action, entry) {
    switch (action) {
      case 'new-scene':
        _createNewScene();
        break;
      case 'new-file': {
        const fileName = await _showInputDialog('新建文件', '在 ' + entry.name + '/ 下创建文件:', 'untitled.js');
        if (!fileName || !fileName.trim()) return;
        try {
          if (!window.api || !window.api.writeFile) { alert('文件系统 API 不可用'); return; }
          let filePath;
          if (window.api.pathJoin) {
            filePath = await window.api.pathJoin(entry.path, fileName.trim());
          } else {
            filePath = entry.path.replace(/[\\/]+$/, '') + '/' + fileName.trim();
          }
          const result = await window.api.writeFile(filePath, '');
          if (result && result.error) { alert('创建文件失败: ' + result.error); return; }
          _expandedFolders.add(entry.path);
          await refresh();
        } catch (e) {
          alert('创建文件失败: ' + e.message);
        }
        break;
      }
      case 'new-folder': {
        const folderName = await _showInputDialog('新建文件夹', '在 ' + entry.name + '/ 下创建文件夹:', 'new-folder');
        if (!folderName || !folderName.trim()) return;
        try {
          if (!window.api || !window.api.ensureDir) { alert('文件系统 API 不可用'); return; }
          let folderPath;
          if (window.api.pathJoin) {
            folderPath = await window.api.pathJoin(entry.path, folderName.trim());
          } else {
            folderPath = entry.path.replace(/[\\/]+$/, '') + '/' + folderName.trim();
          }
          const result = await window.api.ensureDir(folderPath);
          if (result && result.error) { alert('创建文件夹失败: ' + result.error); return; }
          _expandedFolders.add(entry.path);
          await refresh();
        } catch (e) {
          alert('创建文件夹失败: ' + e.message);
        }
        break;
      }
      case 'rename': {
        const newName = await _showInputDialog('重命名', '输入新名称:', entry.name);
        if (newName && newName !== entry.name) {
          try {
            const oldPath = entry.path;
            const newPath = oldPath.replace(/[^/\\]+$/, newName);
            if (window.api && window.api.renameFolder) {
              await window.api.renameFolder(oldPath, newPath);
            }
            refresh();
          } catch (e) {
            alert('重命名失败: ' + e.message);
          }
        }
        break;
      }
      case 'delete': {
        if (!confirm('确定删除文件夹 "' + entry.name + '" 及其所有内容吗？')) return;
        try {
          if (window.api && window.api.deleteFolder) {
            await window.api.deleteFolder(entry.path);
          }
          refresh();
        } catch (e) {
          alert('删除失败: ' + e.message);
        }
        break;
      }
    }
  }

  /** 保存当前场景到文件 */
  async function saveCurrentScene(name) {
    if (typeof SceneGraph === 'undefined' || typeof EditorState === 'undefined') return;
    if (!window.api || !window.api.writeFile || !window.api.ensureDir) return;

    const sceneName = name || 'main';
    let scenesDir;
    let filePath;
    if (window.api.pathJoin) {
      scenesDir = await window.api.pathJoin(EditorState.projectPath, 'scenes');
      filePath = await window.api.pathJoin(scenesDir, sceneName + '.scene.json');
    } else {
      scenesDir = EditorState.projectPath.replace(/[\\/]+$/, '') + '/scenes';
      filePath = scenesDir + '/' + sceneName + '.scene.json';
    }

    const data = {
      name: sceneName,
      ...SceneGraph.toJSON(),
    };

    try {
      await window.api.ensureDir(scenesDir);
      await window.api.writeFile(filePath, JSON.stringify(data, null, 2));
      refresh();
      return filePath;
    } catch (e) {
      console.error('[FileSystem] 保存场景失败:', e);
      return null;
    }
  }

  return {
    init,
    refresh,
    saveCurrentScene,
  };
})();
