/**
 * 舞台管理器 - 精灵管理和运动控制
 */
const StageManager = (function () {
  let _sprites = [];
  let _activeIdx = 0;
  let _isExecuting = false;  // 执行期间禁止积木同步
  const STAGE_W = 480, STAGE_H = 360;

  function init() {
    // 默认精灵
    _sprites.push(new Sprite('精灵1', 0, 0));
    _activeIdx = 0;
    renderSpriteList();
  }

  function getSprites() { return _sprites; }
  function getSprite(idx) { return _sprites[idx] || _sprites[0]; }
  function getActiveSpriteIdx() { return _activeIdx; }
  function getActiveSprite() { return _sprites[_activeIdx] || _sprites[0]; }

  function getSpriteByName(name) {
    return _sprites.find(s => s.name === name) || null;
  }
  function getSpriteIndexByName(name) {
    return _sprites.findIndex(s => s.name === name);
  }
  function cloneSprite(idx) {
    const src = getSprite(idx);
    if (!src) return null;
    const clone = new Sprite(src.name + '_clone', src.x, src.y);
    clone.direction = src.direction;
    clone.size = src.size;
    clone.visible = src.visible;
    clone.rotationStyle = src.rotationStyle;
    clone.penDown = src.penDown;
    clone.color = src.color;
    clone.costumeName = src.costumeName;
    clone.costumePath = src.costumePath;
    clone.blocks = {};
    _sprites.push(clone);
    renderSpriteList();
    return _sprites.length - 1;
  }

  function setActiveSprite(idx) {
    if (idx >= 0 && idx < _sprites.length) {
      if (!_isExecuting) {
        // 编辑器模式：保存/加载积木
        if (typeof EditorState !== 'undefined' && _sprites[_activeIdx]) {
          _sprites[_activeIdx].blocks = EditorState.blocks || {};
        }
      }
      _activeIdx = idx;
      if (!_isExecuting) {
        if (typeof EditorState !== 'undefined') {
          EditorState.blocks = _sprites[_activeIdx].blocks || {};
        }
      }
      renderSpriteList();
    }
  }

  function setExecuting(v) { _isExecuting = v; }

  function addSprite(name) {
    const s = new Sprite(name, 0, 0);
    s.blocks = {};
    _sprites.push(s);
    renderSpriteList();
    return s;
  }

  function removeSprite(idx) {
    if (_sprites.length <= 1) return;
    _sprites.splice(idx, 1);
    if (_activeIdx >= _sprites.length) _activeIdx = _sprites.length - 1;
    if (typeof EditorState !== 'undefined') {
      EditorState.blocks = _sprites[_activeIdx].blocks || {};
    }
    renderSpriteList();
  }

  function renderSpriteList() {
    const list = document.getElementById('sprite-list');
    if (!list) return;
    list.innerHTML = '';
    _sprites.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'sprite-thumb' + (i === _activeIdx ? ' selected' : '');

      // 如果有贴图，显示缩略图
      if (s.costumeImage) {
        div.innerHTML = '';
        const img = document.createElement('img');
        img.src = s.costumeImage.src;
        img.style.cssText = 'width:32px;height:32px;object-fit:contain;';
        div.appendChild(img);
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = 'font-size:9px;color:var(--text-muted);display:block;';
        nameSpan.textContent = s.name;
        div.appendChild(nameSpan);
      } else {
        div.style.color = s.color;
        div.innerHTML = `▲<br><span style="font-size:9px;color:var(--text-muted)">${s.name}</span>`;
      }

      div.addEventListener('click', () => {
        setActiveSprite(i);
      });
      div.addEventListener('dblclick', async () => {
        const newName = await showCustomPrompt('重命名精灵:', s.name);
        if (newName && newName.trim()) {
          s.name = newName.trim();
          renderSpriteList();
        }
      });
      // 右键删除
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (_sprites.length > 1 && confirm(`删除精灵 "${s.name}"？`)) {
          removeSprite(i);
        }
      });
      list.appendChild(div);
    });
  }

  function moveSprite(idx, steps) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    const rad = (s.direction - 90) * Math.PI / 180;
    s.x += Math.cos(rad) * steps;
    s.y -= Math.sin(rad) * steps;
  }

  function rotateSprite(idx, deg) {
    const s = getSprite(idx);
    if (s) s.direction = ((s.direction + deg) % 360 + 360) % 360;
  }

  function setSpritePos(idx, x, y) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    s.x = x; s.y = y;
  }

  function setSpriteDir(idx, deg) {
    const s = getSprite(idx);
    if (s) s.direction = ((deg % 360) + 360) % 360;
  }

  function setSpriteVisible(idx, v) {
    const s = getSprite(idx);
    if (s) s.visible = v;
  }

  function setSpriteSize(idx, size) {
    const s = getSprite(idx);
    if (s) s.size = size;
  }

  function changeSpriteSize(idx, delta) {
    const s = getSprite(idx);
    if (s) s.size = Math.max(10, s.size + delta);
  }

  function setSpriteSay(idx, text) {
    const s = getSprite(idx);
    if (s) s.sayText = text;
  }

  function bounceSprite(idx) {
    const s = getSprite(idx);
    if (!s) return;
    const halfW = STAGE_W / 2, halfH = STAGE_H / 2;
    if (s.x > halfW || s.x < -halfW) s.direction = 180 - s.direction;
    if (s.y > halfH || s.y < -halfH) s.direction = -s.direction;
  }

  /** 设置精灵贴图（通过 CostumeManager 造型名） */
  async function setSpriteCostume(idx, imagePath) {
    const s = getSprite(idx);
    if (!s) return false;
    // 如果传入的是造型名称
    if (typeof CostumeManager !== 'undefined' && CostumeManager.hasCostume(imagePath)) {
      s.setCostume(imagePath);
      renderSpriteList();
      return true;
    }
    // 兼容旧版：直接从路径加载
    const ok = await s.loadCostume(imagePath);
    renderSpriteList();
    return ok;
  }

  /** 设置精灵造型（通过 CostumeManager 名称） */
  function setSpriteCostumeByName(idx, costumeName) {
    const s = getSprite(idx);
    if (!s) return false;
    const ok = s.setCostume(costumeName);
    renderSpriteList();
    return ok;
  }

  /** 清除精灵贴图 */
  function clearSpriteCostume(idx) {
    const s = getSprite(idx);
    if (s) s.clearCostume();
    renderSpriteList();
  }

  /** 检查精灵是否碰到边缘 */
  function isTouchingEdge(idx) {
    const s = getSprite(idx);
    if (!s) return false;
    const halfW = STAGE_W / 2, halfH = STAGE_H / 2;
    return s.x > halfW || s.x < -halfW || s.y > halfH || s.y < -halfH;
  }

  // ===== 速度系统 =====
  function setVelocity(idx, vx, vy) {
    const s = getSprite(idx);
    if (s) { s.vx = Number(vx); s.vy = Number(vy); }
  }
  function changeVelocity(idx, dvx, dvy) {
    const s = getSprite(idx);
    if (s) { s.vx += Number(dvx); s.vy += Number(dvy); }
  }
  function setSpeedDirection(idx, speed, deg) {
    const s = getSprite(idx);
    if (!s) return;
    const rad = (Number(deg) - 90) * Math.PI / 180;
    s.vx = Math.cos(rad) * Number(speed);
    s.vy = -Math.sin(rad) * Number(speed);
  }
  function applyFriction(idx, factor) {
    const s = getSprite(idx);
    if (!s) return;
    const f = Number(factor);
    s.vx *= f;
    s.vy *= f;
    if (Math.abs(s.vx) < 0.01) s.vx = 0;
    if (Math.abs(s.vy) < 0.01) s.vy = 0;
  }
  function applyGravity(idx, g) {
    const s = getSprite(idx);
    if (s) s.vy += Number(g);
  }
  function updateVelocity(idx) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    s.x += s.vx;
    s.y += s.vy;
  }
  function bounceEdgeVelocity(idx, elasticity) {
    const s = getSprite(idx);
    if (!s) return;
    const e = Number(elasticity);
    const halfW = STAGE_W / 2, halfH = STAGE_H / 2;
    if (s.x > halfW) { s.x = halfW; s.vx = -Math.abs(s.vx) * e; }
    else if (s.x < -halfW) { s.x = -halfW; s.vx = Math.abs(s.vx) * e; }
    if (s.y > halfH) { s.y = halfH; s.vy = -Math.abs(s.vy) * e; }
    else if (s.y < -halfH) { s.y = -halfH; s.vy = Math.abs(s.vy) * e; }
  }

  // ===== 追踪系统 =====
  function moveTowards(idx, tx, ty, steps) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    const dx = tx - s.x, dy = ty - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;
    const st = Number(steps);
    const ratio = Math.min(st / dist, 1);
    s.x += dx * ratio;
    s.y += dy * ratio;
  }
  function moveAwayFrom(idx, tx, ty, steps) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    const dx = s.x - tx, dy = s.y - ty;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return;
    const st = Number(steps);
    s.x += (dx / dist) * st;
    s.y += (dy / dist) * st;
  }
  function pointTowards(idx, tx, ty) {
    const s = getSprite(idx);
    if (!s) return;
    const dx = tx - s.x, dy = -(ty - s.y);
    s.direction = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  }

  // ===== 圆周运动 =====
  function orbitAround(idx, tx, ty, deg, radius) {
    const s = getSprite(idx);
    if (!s) return;
    savePos(s);
    const dx = s.x - tx, dy = s.y - ty;
    const curAngle = Math.atan2(dy, dx);
    const newAngle = curAngle + Number(deg) * Math.PI / 180;
    const r = Number(radius);
    s.x = tx + Math.cos(newAngle) * r;
    s.y = ty + Math.sin(newAngle) * r;
  }

  // ===== 边界操作 =====
  function clampToStage(idx) {
    const s = getSprite(idx);
    if (!s) return;
    const halfW = STAGE_W / 2, halfH = STAGE_H / 2;
    s.x = Math.max(-halfW, Math.min(halfW, s.x));
    s.y = Math.max(-halfH, Math.min(halfH, s.y));
  }
  function wrapAround(idx) {
    const s = getSprite(idx);
    if (!s) return;
    const halfW = STAGE_W / 2, halfH = STAGE_H / 2;
    if (s.x > halfW) s.x = -halfW;
    else if (s.x < -halfW) s.x = halfW;
    if (s.y > halfH) s.y = -halfH;
    else if (s.y < -halfH) s.y = halfH;
  }
  function goBack(idx) {
    const s = getSprite(idx);
    if (!s || s._posHistory.length === 0) return;
    const prev = s._posHistory.pop();
    s.x = prev.x;
    s.y = prev.y;
    s.direction = prev.dir;
  }

  // ===== 辅助 =====
  function savePos(s) {
    s._posHistory.push({ x: s.x, y: s.y, dir: s.direction });
    if (s._posHistory.length > 50) s._posHistory.shift();
  }
  function getSpeed(idx) {
    const s = getSprite(idx);
    if (!s) return 0;
    return Math.sqrt(s.vx * s.vx + s.vy * s.vy);
  }
  function getDistanceToPoint(idx, tx, ty) {
    const s = getSprite(idx);
    if (!s) return 0;
    const dx = s.x - tx, dy = s.y - ty;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function getDirectionToPoint(idx, tx, ty) {
    const s = getSprite(idx);
    if (!s) return 0;
    const dx = tx - s.x, dy = -(ty - s.y);
    return (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  }

  /** 检查两个精灵是否碰撞 */
  function isTouchingSprite(idx1, idx2) {
    const s1 = getSprite(idx1);
    const s2 = getSprite(idx2);
    if (!s1 || !s2) return false;
    const dx = s1.x - s2.x;
    const dy = s1.y - s2.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // 简化：距离小于 30 认为碰撞
    return dist < 30;
  }

  /** 获取到另一个精灵的距离 */
  function distanceToSprite(idx1, idx2) {
    const s1 = getSprite(idx1);
    const s2 = getSprite(idx2);
    if (!s1 || !s2) return 0;
    const dx = s1.x - s2.x;
    const dy = s1.y - s2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /** 导出精灵数据用于序列化保存（含积木脚本） */
  function getSpriteData() {
    if (typeof EditorState !== 'undefined' && _sprites[_activeIdx]) {
      _sprites[_activeIdx].blocks = EditorState.blocks || {};
    }
    return _sprites.map(s => ({
      name: s.name,
      x: s.x,
      y: s.y,
      direction: s.direction,
      size: s.size,
      visible: s.visible,
      costumeName: s.costumeName || '',
      costumePath: s.costumePath || '',
      rotationStyle: s.rotationStyle,
      penDown: s.penDown,
      color: s.color,
      sayText: s.sayText,
      vx: s.vx,
      vy: s.vy,
      blocks: s.blocks || {},
    }));
  }

  /** 获取所有精灵的积木合并（运行时用） */
  function getAllBlocks() {
    if (typeof EditorState !== 'undefined' && _sprites[_activeIdx]) {
      _sprites[_activeIdx].blocks = EditorState.blocks || {};
    }
    const merged = {};
    _sprites.forEach(s => {
      if (s.blocks) {
        Object.assign(merged, s.blocks);
      }
    });
    return merged;
  }

  /** 获取精灵数量 */
  function getSpriteCount() { return _sprites.length; }

  /** 从保存的数据恢复精灵（含贴图加载和积木恢复） */
  function restoreSprites(data, projectPath) {
    _sprites = [];
    data.forEach(sd => {
      const s = new Sprite(sd.name, sd.x || 0, sd.y || 0);
      s.direction = sd.direction || 90;
      s.size = sd.size || 100;
      s.visible = sd.visible !== false;
      s.rotationStyle = sd.rotationStyle || 'allAround';
      s.penDown = !!sd.penDown;
      s.color = sd.color || '#4C97FF';
      s.sayText = sd.sayText || '';
      s.vx = sd.vx || 0;
      s.vy = sd.vy || 0;
      s.blocks = sd.blocks || {};
      if (sd.costumeName && typeof CostumeManager !== 'undefined' && CostumeManager.hasCostume(sd.costumeName)) {
        s.setCostume(sd.costumeName);
      } else if (sd.costumePath) {
        let fullPath = sd.costumePath;
        if (!sd.costumePath.startsWith('/') && !sd.costumePath.match(/^[a-zA-Z]:[\\/]/)) {
          fullPath = projectPath + '/' + sd.costumePath;
        }
        s.loadCostume(fullPath);
      }
      _sprites.push(s);
    });
    _activeIdx = 0;
    if (typeof EditorState !== 'undefined' && _sprites[0]) {
      EditorState.blocks = _sprites[0].blocks || {};
    }
    renderSpriteList();
  }

  // ============================================================
  // SceneGraph 适配层（高级模式）
  // ============================================================

  /** 从 SceneGraph 同步 Sprite2D 节点到 _sprites */
  function syncFromSceneGraph() {
    if (typeof SceneGraph === 'undefined') return;
    const spriteNodes = SceneGraph.getSprites();

    // 保留现有精灵的积木数据
    const existingBlocks = {};
    _sprites.forEach((s, i) => {
      existingBlocks[s.name] = s.blocks || {};
    });

    _sprites = [];
    spriteNodes.forEach((node, idx) => {
      const p = node.properties;
      const s = new Sprite(node.name, p.x || 0, p.y || 0);
      s.direction = p.direction || 90;
      s.size = p.size || 100;
      s.visible = node.visible !== false;
      s.rotationStyle = p.rotationStyle || 'allAround';
      s.color = p.color || '#4C97FF';
      s.costumeName = p.costumeName || '';
      s.blocks = existingBlocks[node.name] || node.blocks || {};
      // 存储节点ID关联
      s._sceneNodeId = node.id;
      if (p.costumeName && typeof CostumeManager !== 'undefined' && CostumeManager.hasCostume(p.costumeName)) {
        s.setCostume(p.costumeName);
      }
      _sprites.push(s);
      node.spriteRef = idx;
    });

    if (_activeIdx >= _sprites.length) _activeIdx = Math.max(0, _sprites.length - 1);
    if (typeof EditorState !== 'undefined' && _sprites[_activeIdx]) {
      EditorState.blocks = _sprites[_activeIdx].blocks || {};
    }
    renderSpriteList();
  }

  /** 将 _sprites 变更同步回 SceneGraph */
  function syncToSceneGraph() {
    if (typeof SceneGraph === 'undefined') return;
    _sprites.forEach(sprite => {
      if (!sprite._sceneNodeId) return;
      const node = SceneGraph.getNode(sprite._sceneNodeId);
      if (!node) return;
      node.name = sprite.name;
      node.visible = sprite.visible;
      node.properties.x = sprite.x;
      node.properties.y = sprite.y;
      node.properties.direction = sprite.direction;
      node.properties.size = sprite.size;
      node.properties.color = sprite.color;
      node.properties.rotationStyle = sprite.rotationStyle;
      node.properties.costumeName = sprite.costumeName || '';
      node.blocks = sprite.blocks || {};
    });
  }

  /** 高级模式添加精灵（同时更新 SceneGraph） */
  function addSpriteAdvanced(name, parentId) {
    if (typeof SceneGraph === 'undefined') return addSprite(name);
    const nodeId = SceneGraph.addNode('Sprite2D', name || '精灵', parentId);
    if (!nodeId) return null;
    syncFromSceneGraph();
    return nodeId;
  }

  return {
    init, getSprites, getSprite, getSpriteByName, getSpriteIndexByName,
    getActiveSprite, getActiveSpriteIdx, setActiveSprite,
    addSprite, removeSprite, cloneSprite,
    moveSprite, rotateSprite, setSpritePos, setSpriteDir, setSpriteVisible,
    setSpriteSize, changeSpriteSize, setSpriteSay, bounceSprite,
    setSpriteCostume, setSpriteCostumeByName, clearSpriteCostume,
    isTouchingEdge, isTouchingSprite, distanceToSprite,
    renderSpriteList,
    // 新增 API
    setVelocity, changeVelocity, setSpeedDirection,
    applyFriction, applyGravity, updateVelocity, bounceEdgeVelocity,
    moveTowards, moveAwayFrom, pointTowards,
    orbitAround, clampToStage, wrapAround, goBack,
    getSpeed, getDistanceToPoint, getDirectionToPoint,
    getSpriteData, restoreSprites, getAllBlocks, getSpriteCount, setExecuting,
    // SceneGraph 适配
    syncFromSceneGraph, syncToSceneGraph, addSpriteAdvanced,
    STAGE_W, STAGE_H,
  };
})();
