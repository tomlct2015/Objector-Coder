/**
 * Inspector - 属性检查器模块（高级模式 Godot 式）
 * 根据节点类型显示不同属性组
 */
const Inspector = (function () {
  let _container = null;
  let _currentNodeId = null;

  function init() {
    _container = document.getElementById('inspector-content');
  }

  function showNode(nodeId) {
    if (!_container) return;
    _currentNodeId = nodeId;
    if (typeof SceneGraph === 'undefined') {
      _container.innerHTML = '<p class="inspector-hint">SceneGraph 未加载</p>';
      return;
    }
    const node = SceneGraph.getNode(nodeId);
    if (!node) {
      _container.innerHTML = '<p class="inspector-hint">选择场景树中的节点</p>';
      return;
    }
    const typeInfo = SceneGraph.getNodeType(node.type);
    const isRoot = !node.parent;
    const isSceneRoot = isRoot && ['Scene2D', 'Scene3D', 'SceneUI'].includes(node.type);
    _container.innerHTML = `
      <div class="inspector-group">
        <div class="inspector-group-title">
          <span>${typeInfo ? typeInfo.icon : '❓'} ${node.type}</span>
        </div>
        <div class="inspector-row">
          <span class="inspector-label">名称</span>
          <input class="inspector-input" data-prop="name" value="${esc(node.name)}" />
        </div>
        <div class="inspector-row">
          <span class="inspector-label">可见</span>
          <input type="checkbox" data-prop="visible" ${node.visible !== false ? 'checked' : ''} style="width:auto;" />
        </div>
        ${isSceneRoot ? _renderModeSwitcher(node) : ''}
      </div>
      ${_renderProps(node)}
    `;
    _bindInputs(nodeId);
  }

  /** 渲染场景模式切换器（仅根节点） */
  function _renderModeSwitcher(node) {
    const modes = SceneGraph.getSceneModes();
    const labels = SceneGraph.getSceneModeLabels();
    const opts = modes.map(m => `<option value="${m}" ${m === node.type ? 'selected' : ''}>${labels[m] || m}</option>`).join('');
    return `<div class="inspector-row">
      <span class="inspector-label">场景模式</span>
      <select class="inspector-input" data-action="switch-mode" style="padding:2px 4px;">
        ${opts}
      </select>
    </div>`;
  }

  function _renderProps(node) {
    const p = node.properties;
    let h = '';
    switch (node.type) {
      case 'Sprite2D':
        h += _pos2d(p) + _transform2d(p) + _appear2d(p) + _physics(p);
        break;
      case 'Node2D':
        h += _pos2d(p) + _transform2d(p);
        break;
      case 'Camera2D':
        h += _pos2d(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">摄像机</div>
          <div class="inspector-row"><span class="inspector-label">缩放</span>
          <input class="inspector-input" type="number" data-prop="zoom" value="${p.zoom||1}" step="0.1" min="0.1" /></div></div>`;
        break;
      case 'Scene2D': h += '<p class="inspector-hint">2D 场景根节点</p>'; break;
      case 'Scene3D': h += '<p class="inspector-hint">3D 场景根节点</p>'; break;
      case 'SceneUI': h += '<p class="inspector-hint">Control UI 场景根节点</p>'; break;
      // ===== UI 节点 =====
      case 'NodeUI':
        h += _pos2d(p) + _uiSize(p);
        break;
      case 'ButtonUI':
        h += _pos2d(p) + _uiSize(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">按钮</div>
          <div class="inspector-row"><span class="inspector-label">文本</span>
          <input class="inspector-input" data-prop="text" value="${esc(p.text||'')}" /></div>
          <div class="inspector-row"><span class="inspector-label">背景色</span>
          <input class="inspector-input" type="color" data-prop="color" value="${p.color||'#89b4fa'}" style="padding:2px;height:24px;" /></div>
          <div class="inspector-row"><span class="inspector-label">文字色</span>
          <input class="inspector-input" type="color" data-prop="textColor" value="${p.textColor||'#1e1e2e'}" style="padding:2px;height:24px;" /></div></div>`;
        break;
      case 'LabelUI':
        h += _pos2d(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">文本</div>
          <div class="inspector-row"><span class="inspector-label">内容</span>
          <input class="inspector-input" data-prop="text" value="${esc(p.text||'')}" /></div>
          <div class="inspector-row"><span class="inspector-label">字号</span>
          <input class="inspector-input" type="number" data-prop="fontSize" value="${p.fontSize||16}" min="6" max="200" /></div>
          <div class="inspector-row"><span class="inspector-label">颜色</span>
          <input class="inspector-input" type="color" data-prop="color" value="${p.color||'#cdd6f4'}" style="padding:2px;height:24px;" /></div></div>`;
        break;
      case 'ImageUI':
        h += _pos2d(p) + _uiSize(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">图片</div>
          <div class="inspector-row"><span class="inspector-label">图片路径</span>
          <input class="inspector-input" data-prop="src" value="${esc(p.src||'')}" placeholder="assets/img.png" /></div></div>`;
        break;
      case 'PanelUI':
        h += _pos2d(p) + _uiSize(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">面板样式</div>
          <div class="inspector-row"><span class="inspector-label">背景色</span>
          <input class="inspector-input" type="color" data-prop="bgColor" value="${p.bgColor||'#313244'}" style="padding:2px;height:24px;" /></div>
          <div class="inspector-row"><span class="inspector-label">边框色</span>
          <input class="inspector-input" type="color" data-prop="borderColor" value="${p.borderColor||'#45475a'}" style="padding:2px;height:24px;" /></div></div>`;
        break;
      // ===== SceneRef =====
      case 'SceneRef':
        h += `<div class="inspector-group"><div class="inspector-group-title">场景引用</div>
          <div class="inspector-row"><span class="inspector-label">场景路径</span>
          <input class="inspector-input" data-prop="scenePath" value="${esc(p.scenePath||'')}" placeholder="scenes/xxx.scene.json" /></div>
          <div class="inspector-row" style="padding-top:4px;">
            <button id="btn-pick-scene" class="tb-btn" style="font-size:11px;padding:4px 10px;">📁 选择场景文件...</button>
          </div>
        </div>`;
        break;
      case 'Node3D':
        h += _pos3d(p);
        break;
      case 'Mesh3D':
        h += _pos3d(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">网格</div>
          <div class="inspector-row"><span class="inspector-label">类型</span>
          <select class="inspector-input" data-prop="meshType" style="padding:2px 4px;">
            <option value="box" ${(p.meshType||'box')==='box'?'selected':''}>立方体</option>
            <option value="sphere" ${p.meshType==='sphere'?'selected':''}>球体</option>
            <option value="cylinder" ${p.meshType==='cylinder'?'selected':''}>圆柱</option>
            <option value="cone" ${p.meshType==='cone'?'selected':''}>圆锥</option>
            <option value="plane" ${p.meshType==='plane'?'selected':''}>平面</option>
          </select></div>
          <div class="inspector-row"><span class="inspector-label">颜色</span>
          <input class="inspector-input" type="color" data-prop="color" value="${p.color||'#4C97FF'}" style="padding:2px;height:24px;" /></div>
          <div class="inspector-row"><span class="inspector-label">缩放</span>
          <input class="inspector-input" type="number" data-prop="scale" value="${p.scale||1}" step="0.1" min="0.01" /></div></div>`;
        break;
      case 'Camera3D':
        h += _pos3d(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">摄像机</div>
          <div class="inspector-row"><span class="inspector-label">FOV</span>
          <input class="inspector-input" type="number" data-prop="fov" value="${p.fov||75}" min="10" max="170" /></div></div>`;
        break;
      case 'Light3D':
        h += _pos3d(p);
        h += `<div class="inspector-group"><div class="inspector-group-title">灯光</div>
          <div class="inspector-row"><span class="inspector-label">颜色</span>
          <input class="inspector-input" type="color" data-prop="color" value="${p.color||'#ffffff'}" style="padding:2px;height:24px;" /></div>
          <div class="inspector-row"><span class="inspector-label">强度</span>
          <input class="inspector-input" type="number" data-prop="intensity" value="${p.intensity||1}" step="0.1" min="0" /></div>
          <div class="inspector-row"><span class="inspector-label">范围</span>
          <input class="inspector-input" type="number" data-prop="range" value="${p.range||10}" step="0.5" min="0" /></div></div>`;
        break;
      default: h += '<p class="inspector-hint">未知节点类型</p>';
    }
    return h;
  }

  function _uiSize(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">尺寸</div>
      <div class="inspector-row"><span class="inspector-label">宽度</span>
      <input class="inspector-input" type="number" data-prop="width" value="${p.width||100}" min="1" /></div>
      <div class="inspector-row"><span class="inspector-label">高度</span>
      <input class="inspector-input" type="number" data-prop="height" value="${p.height||40}" min="1" /></div></div>`;
  }

  function _pos2d(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">位置</div>
      <div class="inspector-row"><span class="inspector-label">X</span>
      <input class="inspector-input" type="number" data-prop="x" value="${p.x||0}" /></div>
      <div class="inspector-row"><span class="inspector-label">Y</span>
      <input class="inspector-input" type="number" data-prop="y" value="${p.y||0}" /></div></div>`;
  }

  function _transform2d(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">变换</div>
      <div class="inspector-row"><span class="inspector-label">方向</span>
      <input class="inspector-input" type="number" data-prop="direction" value="${p.direction!=null?p.direction:90}" min="0" max="360" /></div>
      <div class="inspector-row"><span class="inspector-label">大小</span>
      <input class="inspector-input" type="number" data-prop="size" value="${p.size||100}" min="1" /></div>
      <div class="inspector-row"><span class="inspector-label">旋转模式</span>
      <select class="inspector-input" data-prop="rotationStyle" style="padding:2px 4px;">
        <option value="allAround" ${(p.rotationStyle||'allAround')==='allAround'?'selected':''}>全向</option>
        <option value="leftRight" ${p.rotationStyle==='leftRight'?'selected':''}>左右</option>
        <option value="dontRotate" ${p.rotationStyle==='dontRotate'?'selected':''}>不旋转</option>
      </select></div></div>`;
  }

  function _appear2d(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">外观</div>
      <div class="inspector-row"><span class="inspector-label">颜色</span>
      <input class="inspector-input" type="color" data-prop="color" value="${p.color||'#4C97FF'}" style="padding:2px;height:24px;" /></div>
      <div class="inspector-row"><span class="inspector-label">造型</span>
      <input class="inspector-input" data-prop="costumeName" value="${esc(p.costumeName||'')}" placeholder="造型文件名" /></div></div>`;
  }

  function _physics(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">物理</div>
      <div class="inspector-row"><span class="inspector-label">速度X</span>
      <input class="inspector-input" type="number" data-prop="vx" value="${p.vx||0}" step="0.1" /></div>
      <div class="inspector-row"><span class="inspector-label">速度Y</span>
      <input class="inspector-input" type="number" data-prop="vy" value="${p.vy||0}" step="0.1" /></div></div>`;
  }

  function _pos3d(p) {
    return `<div class="inspector-group"><div class="inspector-group-title">3D 位置</div>
      <div class="inspector-row"><span class="inspector-label">X</span>
      <input class="inspector-input" type="number" data-prop="x" value="${p.x||0}" step="0.1" /></div>
      <div class="inspector-row"><span class="inspector-label">Y</span>
      <input class="inspector-input" type="number" data-prop="y" value="${p.y||0}" step="0.1" /></div>
      <div class="inspector-row"><span class="inspector-label">Z</span>
      <input class="inspector-input" type="number" data-prop="z" value="${p.z||0}" step="0.1" /></div></div>
      <div class="inspector-group"><div class="inspector-group-title">3D 旋转</div>
      <div class="inspector-row"><span class="inspector-label">RotX</span>
      <input class="inspector-input" type="number" data-prop="rx" value="${p.rx||0}" step="1" /></div>
      <div class="inspector-row"><span class="inspector-label">RotY</span>
      <input class="inspector-input" type="number" data-prop="ry" value="${p.ry||0}" step="1" /></div>
      <div class="inspector-row"><span class="inspector-label">RotZ</span>
      <input class="inspector-input" type="number" data-prop="rz" value="${p.rz||0}" step="1" /></div></div>`;
  }

  function _bindInputs(nodeId) {
    _container.querySelectorAll('.inspector-input').forEach(input => {
      const prop = input.dataset.prop;
      const action = input.dataset.action;
      if (!prop && !action) return;

      // 场景模式切换
      if (action === 'switch-mode') {
        input.addEventListener('change', () => {
          const ok = SceneGraph.switchRootMode(input.value);
          if (ok) {
            // 切换实际渲染器
            if (typeof window.switchRendererForMode === 'function') {
              window.switchRendererForMode(input.value);
            }
            if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
            if (typeof SceneTree !== 'undefined') SceneTree.refresh();
            // 重新渲染 inspector
            showNode(nodeId);
          }
        });
        return;
      }

      const handler = () => {
        let value;
        if (input.type === 'checkbox') value = input.checked;
        else if (input.type === 'number') value = parseFloat(input.value) || 0;
        else value = input.value;
        if (prop === 'name') SceneGraph.renameNode(nodeId, value);
        else if (prop === 'visible') SceneGraph.setVisible(nodeId, value);
        else SceneGraph.updateProperty(nodeId, prop, value);
        if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
        if (prop === 'name' && typeof SceneTree !== 'undefined') SceneTree.refresh();
        if (typeof StageCanvas !== 'undefined') StageCanvas.render();
      };
      input.addEventListener('change', handler);
      if (input.type === 'color' || input.type === 'range') input.addEventListener('input', handler);
    });

    // 场景选择按钮
    const pickBtn = _container.querySelector('#btn-pick-scene');
    if (pickBtn) {
      pickBtn.addEventListener('click', async () => {
        const scenes = await SceneGraph.listScenes();
        if (scenes.length === 0) {
          alert('未找到场景文件。请先在 scenes/ 目录下创建 .scene.json 文件。');
          return;
        }
        const options = scenes.map(s => s.name).join('\n');
        const chosen = prompt('选择场景文件（输入文件名）：\n\n' + options);
        if (chosen) {
          const match = scenes.find(s => s.name === chosen.trim());
          if (match) {
            SceneGraph.updateProperty(nodeId, 'scenePath', match.path);
            if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
            showNode(nodeId); // 刷新显示
          } else {
            alert('未找到场景文件: ' + chosen);
          }
        }
      });
    }
  }

  function showSprite(index) {
    if (typeof SceneGraph === 'undefined') return;
    const sprites = SceneGraph.getSprites();
    const node = sprites.find(n => n.spriteRef === index);
    if (node) showNode(node.id);
  }

  function refresh() { if (_currentNodeId) showNode(_currentNodeId); }

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  return { init, showNode, showSprite, refresh };
})();
