/**
 * 编辑器画布 - 拖拽、平移、缩放、选择
 */
const EditorCanvas = (function () {
  let canvas, ctx;
  let offsetX = 0, offsetY = 0, scale = 1;
  let dpr = 1; // 设备像素比
  let dragging = null; // { blockId, offX, offY, isPalette, chainIds, startWx, startWy, positions }
  let panning = false, panStart = { x: 0, y: 0 };
  let spaceDown = false; // 空格键按下 = 拖拽模式
  let selectedBlock = null;
  let hoveredPort = null;
  let dragLine = null; // { fromBlockId, fromPort, mx, my }
  let paramEditorState = null; // { blockId, paramName, inputEl }


  // 全局状态
  window.EditorState = {
    blocks: {},        // id -> block instance
    running: false,
    projectPath: null,
    projectName: '未命名项目',
  };

  function init() {
    canvas = document.getElementById('editor-canvas');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    // 缩放控制按钮
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomReset = document.getElementById('btn-zoom-reset');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => zoomTo(scale * 1.2));
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => zoomTo(scale / 1.2));
    if (btnZoomReset) btnZoomReset.addEventListener('click', resetView);

    render();
  }

  function zoomTo(newScale) {
    const rect = canvas.getBoundingClientRect();
    const mx = rect.width / 2, my = rect.height / 2;
    newScale = Math.min(Math.max(newScale, 0.2), 3);
    offsetX = mx - (mx - offsetX) * (newScale / scale);
    offsetY = my - (my - offsetY) * (newScale / scale);
    scale = newScale;
  }

  function resetView() {
    offsetX = 0;
    offsetY = 0;
    scale = 1;
  }

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1;
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
    canvas.style.width = r.width + 'px';
    canvas.style.height = r.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }

  function render() {
    if (!ctx) return;
    try {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // 网格
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
    drawGrid();


    // 绘制所有顶级积木（无 flowIn 的）及其子代码链
    const drawn = new Set();
    function drawBlockWithSubs(blk) {
      if (drawn.has(blk.id)) return;
      // 折叠状态：跳过整个链的后续积木
      if (typeof DevMode !== 'undefined' && DevMode.isCollapsed(blk.id)) {
        BlockRenderer.drawBlock(ctx, blk, selectedBlock === blk.id, hoveredPort);
        drawn.add(blk.id);
        // 跳过整条链
        let cur = blk.flowOut;
        while (cur && EditorState.blocks[cur]) {
          drawn.add(cur);
          cur = EditorState.blocks[cur].flowOut;
        }
        return;
      }
      BlockRenderer.drawBlock(ctx, blk, selectedBlock === blk.id, hoveredPort);
      drawn.add(blk.id);
      // 绘制 C 型槽子积木链（子积木保持原位，在各自位置绘制）
      if (blk.subBlocks) {
        Object.values(blk.subBlocks).forEach(subId => {
          const sub = EditorState.blocks[subId];
          if (sub && !drawn.has(subId)) {
            const subChain = getChain(sub);
            subChain.forEach(drawBlockWithSubs);
          }
        });
      }
    }
    Object.values(EditorState.blocks).forEach(b => {
      if (!b.flowIn && !isSubBlock(b.id)) {
        const chain = getChain(b);
        chain.forEach(drawBlockWithSubs);
      }
    });
    // 绘制独立 reporter/boolean 积木
    Object.values(EditorState.blocks).forEach(b => {
      if (!drawn.has(b.id)) {
        BlockRenderer.drawBlock(ctx, b, selectedBlock === b.id, hoveredPort);
        drawn.add(b.id);
      }
    });

    // 绘制连接线
    drawConnections();

    // 拖拽线
    if (dragLine) {
      ctx.beginPath();
      ctx.strokeStyle = '#89b4fa';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      const from = EditorState.blocks[dragLine.fromBlockId];
      if (from) {
        const sz = BlockRenderer.measureBlock(from);
        const ports = BlockRenderer.getPorts(from, sz);
        const port = ports.find(p => p.name === dragLine.fromPort);
        if (port) {
          ctx.moveTo(from.x + port.x, from.y + port.y);
          ctx.lineTo(dragLine.mx, dragLine.my);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    ctx.restore();  // 内层 restore (网格/缩放)
    ctx.restore();  // 外层 restore (DPR)
    } catch(renderErr) {
      if (!window._rErr1) { window._rErr1 = true; console.error('[render]', renderErr.message, renderErr.stack); }
      try { ctx.restore(); } catch(_) {}
      try { ctx.restore(); } catch(_) {}
    }
    updateStatusBar();
    requestAnimationFrame(render);
  }

  function drawGrid() {
    const step = 40;
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    const startX = Math.floor((-offsetX / scale) / step) * step - step;
    const startY = Math.floor((-offsetY / scale) / step) * step - step;
    const endX = startX + canvas.width / scale + step * 2;
    const endY = startY + canvas.height / scale + step * 2;
    for (let gx = startX; gx < endX; gx += step) {
      ctx.beginPath(); ctx.moveTo(gx, startY); ctx.lineTo(gx, endY); ctx.stroke();
    }
    for (let gy = startY; gy < endY; gy += step) {
      ctx.beginPath(); ctx.moveTo(startX, gy); ctx.lineTo(endX, gy); ctx.stroke();
    }
  }

  /** 绘制方向箭头（实心三角 + 线身） */
  function drawArrowHead(x, y, angle, size) {
    size = size || 10;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.45);
    ctx.lineTo(-size * 0.7, 0);
    ctx.lineTo(-size, size * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 绘制带箭头的连接线 */
  function drawArrowLine(x1, y1, x2, y2, color, width, arrowSize) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    // 线段缩短，留出箭头空间
    const shrink = arrowSize * 0.6;
    const ex = x2 - Math.cos(angle) * shrink;
    const ey = y2 - Math.sin(angle) * shrink;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // 箭头
    ctx.fillStyle = color;
    drawArrowHead(x2, y2, angle, arrowSize);
  }

  /** 绘制带箭头的贝塞尔曲线 */
  function drawArrowBezier(x1, y1, cx1, cy1, cx2, cy2, x2, y2, color, width, arrowSize) {
    // 贝塞尔曲线终点方向的切线角度
    const dx = x2 - cx2, dy = y2 - cy2;
    const angle = Math.atan2(dy, dx);
    const shrink = arrowSize * 0.5;
    const ex = x2 - Math.cos(angle) * shrink;
    const ey = y2 - Math.sin(angle) * shrink;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.bezierCurveTo(cx1, cy1, cx2, cy2, ex, ey);
    ctx.stroke();
    ctx.fillStyle = color;
    drawArrowHead(x2, y2, angle, arrowSize);
  }

  function drawConnections() {
    Object.values(EditorState.blocks).forEach(b => {
      // 流式连接线：父→子（向下）
      if (b.flowOut) {
        const next = EditorState.blocks[b.flowOut];
        if (next) {
          const sz1 = BlockRenderer.measureBlock(b);
          const sz2 = BlockRenderer.measureBlock(next);
          const x1 = b.x + sz1.w / 2, y1 = b.y + sz1.h;
          const x2 = next.x + sz2.w / 2, y2 = next.y;
          drawArrowLine(
            x1, y1, x2, y2,
            'rgba(137,180,250,0.85)', 3, 12
          );
        }
      }
      // 参数连接贝塞尔曲线：reporter → slot（指向父积木）
      if (b.paramConnections) {
        Object.entries(b.paramConnections).forEach(([pname, targetId]) => {
          const target = EditorState.blocks[targetId];
          if (target) {
            const sz1 = BlockRenderer.measureBlock(b);
            const ports1 = BlockRenderer.getPorts(b, sz1);
            const port = ports1.find(p => p.name === pname);
            const sz2 = BlockRenderer.measureBlock(target);
            if (port) {
              const sx = b.x + port.x, sy = b.y + port.y;
              const tx = target.x + sz2.w / 2, ty = target.y + sz2.h / 2;
              drawArrowBezier(
                tx, ty, tx + 30, ty, sx - 30, sy, sx, sy,
                'rgba(137,180,250,0.9)', 2.5, 10
              );
            }
          }
        });
      }
      // 子代码连接线：父→子（从 sub-in 到子积木）
      if (b.subBlocks) {
        const sz1 = BlockRenderer.measureBlock(b);
        const ports1 = BlockRenderer.getPorts(b, sz1);
        Object.entries(b.subBlocks).forEach(([subName, subId]) => {
          const sub = EditorState.blocks[subId];
          if (!sub) return;
          const port = ports1.find(p => p.name === subName && p.type === 'sub-in');
          if (!port) return;
          const sz2 = BlockRenderer.measureBlock(sub);
          const sx = b.x + port.x, sy = b.y + port.y;
          const tx = sub.x + sz2.w / 2, ty = sub.y;
          ctx.setLineDash([6, 4]);
          // 绘制带箭头的虚线贝塞尔
          const bAngle = Math.atan2(ty - sy, tx - sx);
          const bShrink = 10 * 0.5;
          const bex = tx - Math.cos(bAngle) * bShrink;
          const bey = ty - Math.sin(bAngle) * bShrink;
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255,200,100,0.9)';
          ctx.lineWidth = 2.5;
          ctx.moveTo(sx, sy);
          ctx.bezierCurveTo(sx - 20, sy + 30, tx - 20, ty - 20, bex, bey);
          ctx.stroke();
          ctx.setLineDash([]);
          // 箭头指向子积木
          ctx.fillStyle = 'rgba(255,200,100,0.9)';
          drawArrowHead(tx, ty, bAngle, 10);
        });
      }
    });
  }

  function getChain(block) {
    const chain = [block];
    let cur = block.flowOut;
    while (cur && EditorState.blocks[cur]) {
      chain.push(EditorState.blocks[cur]);
      cur = EditorState.blocks[cur].flowOut;
    }
    return chain;
  }

  function isSubBlock(id) {
    return Object.values(EditorState.blocks).some(b =>
      b.subBlocks && Object.values(b.subBlocks).includes(id)
    );
  }

  function screenToWorld(sx, sy) {
    return { x: (sx - offsetX) / scale, y: (sy - offsetY) / scale };
  }

  function findBlockAt(wx, wy) {
    const ids = Object.keys(EditorState.blocks).reverse();
    for (const id of ids) {
      const b = EditorState.blocks[id];
      const def = BlockRegistry.getBlock(b.type);
      const sz = BlockRenderer.measureBlock(b);

      // 基本包围盒检查
      if (wx < b.x || wx > b.x + sz.w || wy < b.y || wy > b.y + sz.h) continue;

      // C 型积木：排除 C 口区域（子代码应在子积木上命中）
      if (def && def.shape === 'c-block') {
        const topOff = def.shape === 'hat' ? BlockRenderer.HAT_HEIGHT : 0;
        const mouthTop = b.y + topOff + BlockRenderer.BLOCK_HEIGHT;
        const mouthBottom = mouthTop + BlockRenderer.C_MOUTH_HEIGHT * (def.subBlocks || ['body']).length;
        if (wy >= mouthTop && wy <= mouthBottom && wx > b.x + 30) {
          continue; // 跳过 C 口内部，让子积木先被检测
        }
      }

      return b;
    }
    return null;
  }

  function findPortAt(wx, wy) {
    for (const b of Object.values(EditorState.blocks)) {
      const sz = BlockRenderer.measureBlock(b);
      const ports = BlockRenderer.getPorts(b, sz);
      for (const port of ports) {
        const dx = wx - (b.x + port.x), dy = wy - (b.y + port.y);
        if (dx * dx + dy * dy < BlockRenderer.PORT_HIT * BlockRenderer.PORT_HIT) {
          return { blockId: b.id, ...port };
        }
      }
    }
    return null;
  }

  function onMouseDown(e) {
    // 关闭参数编辑器（如果点击在其他地方，且不是刚打开的）
    if (paramEditorState && !e.target.classList.contains('param-editor') &&
        (!paramEditorState.openedAt || Date.now() - paramEditorState.openedAt > 200)) {
      commitParamEdit();
    }
    // 关闭下拉菜单（由菜单自己的 handler 处理）

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);

    hideContextMenu();

    if (e.button === 1 || e.button === 2) {
      panning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
      canvas.style.cursor = 'grabbing';
      return;
    }

    // 空格+左键拖拽画布
    if (spaceDown && e.button === 0) {
      panning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
      canvas.style.cursor = 'grabbing';
      return;
    }

    const port = findPortAt(w.x, w.y);
    if (port) {
      dragLine = { fromBlockId: port.blockId, fromPort: port.name, mx: w.x, my: w.y };
      return;
    }

    const block = findBlockAt(w.x, w.y);
    if (block) {
      selectedBlock = block.id;

      // 检查是否点击在参数插槽上 —— 不启动拖拽，等待可能的双击编辑
      const slots = BlockRenderer.getParamSlots(block);
      for (const slot of slots) {
        if (w.x >= slot.x && w.x <= slot.x + slot.w &&
            w.y >= slot.y && w.y <= slot.y + slot.h) {
          return;
        }
      }

      // 检查是否点击在动态参数的移除按钮上
      if (block.type === 'list_create' || block.type === 'func_define' ||
          block.type === 'func_call' || block.type === 'func_call_reporter') {
        const buttons = BlockRenderer.getRemoveButtons(block);
        for (const btn of buttons) {
          if (w.x >= btn.x && w.x <= btn.x + btn.size &&
              w.y >= btn.y && w.y <= btn.y + btn.size) {
            removeListItem(block, btn.name);
            return;
          }
        }
      }

      // 收集拖拽链：默认拖动整个链，Shift 只拖单个
      let chainIds = [];
      if (!e.shiftKey) {
        let cur = block;
        while (cur) {
          chainIds.push(cur.id);
          cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
        }
      } else {
        chainIds = [block.id];
      }

      const positions = {};
      chainIds.forEach(id => {
        const b = EditorState.blocks[id];
        if (b) positions[id] = { x: b.x, y: b.y };
      });

      dragging = {
        blockId: block.id, offX: w.x - block.x, offY: w.y - block.y,
        chainIds, startWx: w.x, startWy: w.y, positions,
      };
    } else {
      // 点击空白区域 → 拖拽画布
      selectedBlock = null;
      panning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
      canvas.style.cursor = 'grabbing';
    }
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);

    if (panning) {
      offsetX = e.clientX - panStart.x;
      offsetY = e.clientY - panStart.y;
      return;
    }

    if (dragLine) {
      dragLine.mx = w.x;
      dragLine.my = w.y;
      hoveredPort = findPortAt(w.x, w.y);
      return;
    }

    if (dragging) {
      const dx = w.x - dragging.startWx;
      const dy = w.y - dragging.startWy;
      dragging.chainIds.forEach(id => {
        const b = EditorState.blocks[id];
        const orig = dragging.positions[id];
        if (b && orig) { b.x = orig.x + dx; b.y = orig.y + dy; }
      });
      return;
    }

    hoveredPort = findPortAt(w.x, w.y);
    document.getElementById('status-pos').textContent = `X: ${Math.round(w.x)}  Y: ${Math.round(w.y)}`;
  }

  function onMouseUp(e) {
    if (panning) {
      panning = false;
      canvas.style.cursor = spaceDown ? 'grab' : 'default';
      return;
    }

    if (dragLine) {
      const rect = canvas.getBoundingClientRect();
      const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const targetPort = findPortAt(w.x, w.y);
      if (targetPort && targetPort.blockId !== dragLine.fromBlockId) {
        ConnectionManager.connect(dragLine.fromBlockId, dragLine.fromPort, targetPort.blockId, targetPort.name);
      }
      dragLine = null;
      hoveredPort = null;
      return;
    }

    if (dragging) {
      dragging = null;
    }
  }

  function onDblClick(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    const block = findBlockAt(w.x, w.y);
    if (!block) return;
    // 查找是否双击了参数插槽
    const slots = BlockRenderer.getParamSlots(block);
    for (const slot of slots) {
      if (w.x >= slot.x && w.x <= slot.x + slot.w &&
          w.y >= slot.y && w.y <= slot.y + slot.h) {
        openParamEditor(block, slot, e.clientX, e.clientY);
        return;
      }
    }
  }

  function openParamEditor(block, slot, clientX, clientY) {
    // 计算屏幕位置
    const rect = canvas.getBoundingClientRect();
    const screenX = slot.x * scale + offsetX + rect.left;
    const screenY = slot.y * scale + offsetY + rect.top;
    const screenW = slot.w * scale;
    const screenH = slot.h * scale;

    // 下拉菜单类型
    if (slot.type === 'dropdown' && slot.options) {
      showDropdownMenu(block, slot, screenX, screenY, screenW, screenH);
      return;
    }

    const input = document.getElementById('param-editor');
    if (!input) return;

    input.style.left = screenX + 'px';
    input.style.top = screenY + 'px';
    input.style.width = Math.max(screenW, 60) + 'px';
    input.style.height = screenH + 'px';
    input.value = String(slot.value);
    input.classList.remove('hidden');
    input.focus();
    input.select();

    paramEditorState = { blockId: block.id, paramName: slot.name, inputEl: input, openedAt: Date.now() };

    // 绑定事件
    const onBlur = () => {
      commitParamEdit();
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('keydown', onKey);
    };
    const onKey = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = String(slot.value); // 恢复原值
        input.blur();
      }
    };
    input.addEventListener('blur', onBlur);
    input.addEventListener('keydown', onKey);
  }

  function showDropdownMenu(block, slot, screenX, screenY, screenW, screenH) {
    // 移除旧菜单
    closeDropdownMenu();

    const menu = document.createElement('div');
    menu.className = 'param-dropdown-menu';
    menu.style.left = screenX + 'px';
    menu.style.top = (screenY + screenH + 2) + 'px';
    menu.style.minWidth = Math.max(screenW, 80) + 'px';

    // 使用 flag 防止 mousedown 立即关闭
    let _justOpened = true;
    setTimeout(() => { _justOpened = false; }, 100);

    slot.options.forEach(opt => {
      const label = Array.isArray(opt) ? opt[0] : opt;
      const value = Array.isArray(opt) ? opt[1] : opt;
      const item = document.createElement('div');
      item.className = 'param-dropdown-item' + (value === String(slot.value) ? ' active' : '');
      item.textContent = label;
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        block.params[slot.name] = value;
        closeDropdownMenu();
      });
      menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // 点击其他地方关闭
    const closeHandler = (e) => {
      if (_justOpened) return;
      if (!menu.contains(e.target)) {
        closeDropdownMenu();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 50);
  }

  function closeDropdownMenu() {
    const old = document.querySelector('.param-dropdown-menu');
    if (old) old.remove();
  }

  function commitParamEdit() {
    if (!paramEditorState) return;
    const { blockId, paramName, inputEl } = paramEditorState;
    const block = EditorState.blocks[blockId];
    if (block && block.params) {
      block.params[paramName] = inputEl.value;
    }
    inputEl.classList.add('hidden');
    paramEditorState = null;
  }

  function onWheel(e) {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+滚轮 = 缩放
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(Math.max(scale * delta, 0.2), 3);
      offsetX = mx - (mx - offsetX) * (newScale / scale);
      offsetY = my - (my - offsetY) * (newScale / scale);
      scale = newScale;
    } else {
      // 普通滚轮 = 滚动画布
      offsetX -= e.deltaX || 0;
      offsetY -= e.deltaY;
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const block = findBlockAt(w.x, w.y);
    if (block) {
      selectedBlock = block.id;
      showContextMenu(e.clientX, e.clientY, block.id);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Delete' && selectedBlock) {
      deleteBlock(selectedBlock);
      selectedBlock = null;
    }
    // Ctrl+T = 跳转到重要代码
    if (e.key === 't' && e.ctrlKey && e.target === document.body) {
      e.preventDefault();
      showGotoLabelDialog();
    }
    // 空格键 = 拖拽模式
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      spaceDown = true;
      canvas.style.cursor = 'grab';
    }
  }

  function onKeyUp(e) {
    if (e.key === ' ') {
      spaceDown = false;
      if (!panning) canvas.style.cursor = 'default';
    }
  }

  function deleteBlock(id) {
    const b = EditorState.blocks[id];
    if (!b) return;
    // 断开连接
    if (b.flowIn) {
      const prev = EditorState.blocks[b.flowIn];
      if (prev) prev.flowOut = b.flowOut;
    }
    if (b.flowOut) {
      const next = EditorState.blocks[b.flowOut];
      if (next) next.flowIn = b.flowIn;
    }
    // 删除子积木链
    if (b.flowOut) {
      let cur = b.flowOut;
      while (cur) {
        const nb = EditorState.blocks[cur];
        delete EditorState.blocks[cur];
        cur = nb ? nb.flowOut : null;
      }
    }
    delete EditorState.blocks[id];
    updateBlockCount();
  }

  /** 从面板拖入新积木 */
  function addBlockFromPalette(type, sx, sy) {
    const w = screenToWorld(sx, sy);
    const block = BlockRegistry.createBlock(type, w.x, w.y);
    if (block) {
      EditorState.blocks[block.id] = block;
      selectedBlock = block.id;
      updateBlockCount();
    }
    return block;
  }

  /** 通用：添加动态参数（列表项 / 函数参数 / 调用实参） */
  function addDynamicParam(block) {
    if (!block._extraParams) block._extraParams = [];
    const n = block._extraParams.length + 1;
    let prefix = 'item';
    let defaultVal = '';
    if (block.type === 'func_define' || block.type === 'class_init' || block.type === 'class_method') prefix = 'param';
    else if (block.type === 'func_call' || block.type === 'func_call_reporter') prefix = 'arg';
    else if (block.type === 'class_create' || block.type === 'class_call_method' || block.type === 'class_call_method_reporter') { prefix = 'arg'; defaultVal = '0'; }
    // 扩展积木：从注册定义中读取自定义前缀
    const def = BlockRegistry.getBlock(block.type);
    if (def && def.dynamicParams) {
      if (def.dynamicParamsPrefix) prefix = def.dynamicParamsPrefix;
      if (def.dynamicParamsDefault !== undefined) defaultVal = def.dynamicParamsDefault;
    }
    const name = prefix + n;
    block._extraParams.push({ name, type: 'string', default: defaultVal });
    block.params[name] = defaultVal;
  }
  // 兼容旧名
  function addListItem(block) {
    if (hasDynamicParams(block)) {
      addDynamicParam(block);
    }
  }

  /** 通用：移除动态参数 */
  function removeDynamicParam(block, paramName) {
    if (!block._extraParams) return;
    block._extraParams = block._extraParams.filter(p => p.name !== paramName);
    delete block.params[paramName];
    if (block.paramConnections) delete block.paramConnections[paramName];
  }
  function removeListItem(block, paramName) { removeDynamicParam(block, paramName); }

  /** 判断积木是否支持动态参数 */
  function hasDynamicParams(block) {
    // 内置积木白名单
    if (['list_create','func_define','func_call','func_call_reporter',
         'class_init','class_method','class_create','class_call_method','class_call_method_reporter'].includes(block.type)) return true;
    // 扩展积木：检查注册定义中的 dynamicParams 标志
    const def = BlockRegistry.getBlock(block.type);
    return !!(def && def.dynamicParams);
  }

  /** 批注：设置/编辑积木批注（使用自定义对话框替代 window.prompt） */
  async function editComment(block) {
    const current = block._comment || '';
    const text = await showCustomPrompt('编辑批注（留空则删除）:', current);
    if (text === null) return;
    if (text.trim()) block._comment = text.trim();
    else delete block._comment;
  }

  /** 获取积木右键菜单元素（优先使用独立的 block-context-menu） */
  function _getBlockMenu() {
    return document.getElementById('block-context-menu') || document.getElementById('context-menu');
  }

  function showContextMenu(cx, cy, blockId) {
    const menu = _getBlockMenu();
    menu.style.left = cx + 'px';
    menu.style.top = cy + 'px';
    menu.classList.remove('hidden');
    menu.dataset.blockId = blockId;
    const block = EditorState.blocks[blockId];
    // 列表项/函数参数 操作显示控制
    const isList = block && block.type === 'list_create';
    const isFunc = block && ['func_define','func_call','func_call_reporter',
      'class_init','class_method','class_create','class_call_method','class_call_method_reporter'].includes(block.type);
    const hasDP = block && hasDynamicParams(block);
    // 扩展积木的菜单文本
    const isExtDP = hasDP && !isList && !isFunc;
    menu.querySelectorAll('[data-action="add-list-item"], [data-action="remove-list-item"]')
      .forEach(el => { el.style.display = hasDP ? '' : 'none'; });
    // 更新添加/移除文本
    const addEl = menu.querySelector('[data-action="add-list-item"]');
    const remEl = menu.querySelector('[data-action="remove-list-item"]');
    if (addEl) {
      if (isList) addEl.textContent = '+ 添加列表项';
      else if (isFunc) addEl.textContent = '+ 添加参数';
      else if (isExtDP) addEl.textContent = '+ 添加参数';
    }
    if (remEl) {
      if (isList) remEl.textContent = '- 移除最后一项';
      else if (isFunc) remEl.textContent = '- 移除最后一个参数';
      else if (isExtDP) remEl.textContent = '- 移除最后一个参数';
    }
    // 批注菜单
    const commentEl = menu.querySelector('[data-action="edit-comment"]');
    if (commentEl) {
      commentEl.style.display = '';
      commentEl.textContent = block && block._comment ? '📝 编辑批注' : '💬 添加批注';
    }
    // 重要代码菜单
    const importantEl = menu.querySelector('[data-action="toggle-important"]');
    if (importantEl) {
      importantEl.style.display = '';
      importantEl.textContent = block && block._importantLabel ? '⭐ 取消重要代码 (' + block._importantLabel + ')' : '⭐ 标记为重要代码';
    }
    // 开发者模式菜单项
    const isDev = typeof DevMode !== 'undefined' && DevMode.isDeveloper();
    menu.querySelectorAll('.dev-only').forEach(el => {
      el.style.display = isDev ? '' : 'none';
    });
    // 更新断点菜单文本
    if (isDev && block) {
      const bpItem = menu.querySelector('[data-action="toggle-breakpoint"]');
      if (bpItem) bpItem.textContent = DevMode.isBreakpoint(blockId) ? '✅ 取消断点' : '🔴 设置断点';
    }
  }

  /** 获取积木的所有连接端口信息 */
  function _getDisconnectPorts(block) {
    const ports = [];
    if (!block) return ports;
    const getLabel = (b) => {
      if (!b) return '?';
      return typeof BlockRegistry !== 'undefined' ? (BlockRegistry.getLabel(b) || b.type).substring(0, 20) : (b.type || '?');
    };
    if (block.flowIn) ports.push({ label: '↑ 流入口 ← ' + getLabel(EditorState.blocks[block.flowIn]), portType: 'flowIn' });
    if (block.flowOut) ports.push({ label: '↓ 流出口 → ' + getLabel(EditorState.blocks[block.flowOut]), portType: 'flowOut' });
    if (block.paramConnections) {
      Object.keys(block.paramConnections).forEach(pName => {
        const connId = block.paramConnections[pName];
        if (connId) ports.push({ label: '🔌 ' + pName + ' ← ' + getLabel(EditorState.blocks[connId]), portType: 'param', portName: pName });
      });
    }
    if (block.subBlocks) {
      Object.keys(block.subBlocks).forEach(sName => {
        const subId = block.subBlocks[sName];
        if (subId) ports.push({ label: '📦 ' + sName + ' → ' + getLabel(EditorState.blocks[subId]), portType: 'sub', portName: sName });
      });
    }
    return ports;
  }

  /** 断开指定端口的连接 */
  function _disconnectPort(block, blockId, portType, portName) {
    if (portType === 'flowIn') {
      if (block.flowIn) {
        const parent = EditorState.blocks[block.flowIn];
        if (parent) parent.flowOut = block.flowOut || null;
      }
      if (block.flowOut) {
        const child = EditorState.blocks[block.flowOut];
        if (child) child.flowIn = null;
      }
      // 把 flowOut 链到 flowIn 位置后断开
      if (block.flowIn && block.flowOut) {
        const parent = EditorState.blocks[block.flowIn];
        if (parent) parent.flowOut = block.flowOut;
        const child = EditorState.blocks[block.flowOut];
        if (child) child.flowIn = block.flowIn;
      } else if (block.flowIn) {
        const parent = EditorState.blocks[block.flowIn];
        if (parent) parent.flowOut = null;
      }
      block.flowIn = null;
      block.flowOut = null;
    } else if (portType === 'flowOut') {
      if (block.flowOut) {
        const child = EditorState.blocks[block.flowOut];
        if (child) child.flowIn = null;
      }
      block.flowOut = null;
    } else if (portType === 'param') {
      delete block.paramConnections[portName];
    } else if (portType === 'sub') {
      const subId = block.subBlocks[portName];
      if (subId) {
        const subTop = EditorState.blocks[subId];
        if (subTop) subTop.flowIn = null;
      }
      delete block.subBlocks[portName];
    }
  }

  function hideContextMenu() {
    var menu = _getBlockMenu();
    menu.classList.add('hidden');
    _removeDisconnectPorts(menu);
  }

  /** 移除菜单中动态插入的断开端口项 */
  function _removeDisconnectPorts(menu) {
    if (!menu) return;
    menu.querySelectorAll('.ctx-port-item, .ctx-port-divider').forEach(el => el.remove());
    var dcItem = menu.querySelector('[data-action="disconnect"]');
    if (dcItem) dcItem.textContent = '断开连接 ▸';
  }

  function updateBlockCount() {
    document.getElementById('block-count').textContent = (i18n.isEnglish() ? 'Blocks: ' : '积木: ') + Object.keys(EditorState.blocks).length;
  }

  function updateStatusBar() {
    // 更新缩放显示
    const zoomEl = document.getElementById('zoom-level');
    if (zoomEl) zoomEl.textContent = Math.round(scale * 100) + '%';
  }

  // 右键菜单事件
  document.addEventListener('click', () => hideContextMenu());

  /** 标记/取消重要代码 */
  async function toggleImportant(block) {
    if (block._importantLabel) {
      delete block._importantLabel;
    } else {
      const name = await showCustomPrompt('为这段重要代码命名:', '');
      if (name !== null && name.trim()) {
        block._importantLabel = name.trim();
      }
    }
  }

  /** 显示跳转对话框 */
  function showGotoLabelDialog() {
    const dialog = document.getElementById('goto-label-dialog');
    const list = document.getElementById('goto-label-list');
    if (!dialog || !list) return;
    list.innerHTML = '';
    // 收集所有带标签/重要标记的积木
    const items = [];
    Object.values(EditorState.blocks).forEach(b => {
      if (b.type === 'control_label_run' && b.params && b.params.label) {
        items.push({ id: b.id, name: b.params.label, kind: '标签积木' });
      }
      if (b._importantLabel) {
        const def = BlockRegistry.getBlock(b.type);
        const kind = def ? (def.label || b.type).replace(/\{[^}]+\}/g, '').trim() : b.type;
        items.push({ id: b.id, name: b._importantLabel, kind });
      }
    });
    if (items.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:12px;">暂无重要代码。<br>右键积木可标记为重要代码，或使用“给以下积木贴上标签”积木。</div>';
    } else {
      items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'goto-label-item';
        el.innerHTML = '<span class="goto-label-name">⭐ ' + item.name + '</span><span class="goto-label-type">' + item.kind + '</span>';
        el.addEventListener('click', () => {
          dialog.classList.add('hidden');
          jumpToBlock(item.id);
        });
        list.appendChild(el);
      });
    }
    dialog.classList.remove('hidden');
  }

  /** 跳转到指定积木并居中画布 */
  function jumpToBlock(blockId) {
    const block = EditorState.blocks[blockId];
    if (!block) return;
    selectedBlock = blockId;
    const rect = canvas.getBoundingClientRect();
    // 计算世界坐标，将积木居中
    offsetX = rect.width / 2 - (block.x + 60) * scale;
    offsetY = rect.height / 2 - (block.y + 20) * scale;
  }

  return {
    init, render, resize, addBlockFromPalette, getCanvas: () => canvas, screenToWorld,
    commitParamEdit: () => paramEditorState && commitParamEdit(),
    addListItem, removeListItem, addDynamicParam, removeDynamicParam,
    hasDynamicParams, editComment, toggleImportant, showGotoLabelDialog, jumpToBlock,
    _getDisconnectPorts, _disconnectPort,
  };
})();

// 右键菜单项事件
document.addEventListener('DOMContentLoaded', () => {
  // 优先使用独立的 block-context-menu，避免与场景树/文件系统菜单冲突
  var menuEl = document.getElementById('block-context-menu') || document.getElementById('context-menu');
  if (!menuEl) return;

  menuEl.querySelectorAll('.ctx-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      var menu = document.getElementById('block-context-menu') || document.getElementById('context-menu');
      var blockId = menu.dataset.blockId;
      const action = item.dataset.action;
      if (action === 'delete' && blockId) {
        const b = window.EditorState?.blocks[blockId];
        if (b) {
          if (b.flowIn) { const p = window.EditorState.blocks[b.flowIn]; if (p) p.flowOut = b.flowOut; }
          if (b.flowOut) { const n = window.EditorState.blocks[b.flowOut]; if (n) n.flowIn = b.flowIn; }
          delete window.EditorState.blocks[blockId];
        }
      } else if (action === 'disconnect' && blockId) {
        // 内联展开：在菜单内直接插入端口选项
        const b = window.EditorState?.blocks[blockId];
        if (!b) return;
        const ports = EditorCanvas._getDisconnectPorts(b);
        if (ports.length === 0) {
          // 无连接，直接关闭菜单
          menu.classList.add('hidden');
          return;
        }
        // 如果已经展开了端口列表，则收起并关闭
        if (menu.querySelector('.ctx-port-item')) {
          menu.querySelectorAll('.ctx-port-item, .ctx-port-divider').forEach(el => el.remove());
          menu.classList.add('hidden');
          return;
        }
        // 在断开连接项后面插入端口选项
        const dcItem = menu.querySelector('[data-action="disconnect"]');
        if (!dcItem) return;
        dcItem.textContent = '断开连接 ▾';
        // 全部断开
        const allDiv = document.createElement('div');
        allDiv.className = 'ctx-item ctx-port-item';
        allDiv.style.fontWeight = '600';
        allDiv.style.paddingLeft = '24px';
        allDiv.textContent = '⚡ 全部断开 (' + ports.length + ')';
        allDiv.addEventListener('click', (ev) => {
          ev.stopPropagation();
          ports.forEach(p => EditorCanvas._disconnectPort(b, blockId, p.portType, p.portName));
          menu.querySelectorAll('.ctx-port-item, .ctx-port-divider').forEach(el => el.remove());
          menu.classList.add('hidden');
          EditorCanvas.render();
        });
        dcItem.insertAdjacentElement('afterend', allDiv);
        // 分隔线
        const sepDiv = document.createElement('div');
        sepDiv.className = 'ctx-port-divider';
        sepDiv.style.cssText = 'height:1px;background:var(--border,#313244);margin:2px 12px;';
        allDiv.insertAdjacentElement('afterend', sepDiv);
        // 各端口单独断开
        let lastEl = sepDiv;
        ports.forEach(p => {
          const portDiv = document.createElement('div');
          portDiv.className = 'ctx-item ctx-port-item';
          portDiv.style.paddingLeft = '24px';
          portDiv.style.fontSize = '11px';
          portDiv.textContent = p.label;
          portDiv.addEventListener('click', (ev) => {
            ev.stopPropagation();
            EditorCanvas._disconnectPort(b, blockId, p.portType, p.portName);
            menu.querySelectorAll('.ctx-port-item, .ctx-port-divider').forEach(el => el.remove());
            menu.classList.add('hidden');
            EditorCanvas.render();
          });
          lastEl.insertAdjacentElement('afterend', portDiv);
          lastEl = portDiv;
        });
        return; // 不关闭主菜单
      } else if (action === 'add-list-item' && blockId) {
        const b = window.EditorState?.blocks[blockId];
        if (b && EditorCanvas.hasDynamicParams(b)) {
          // 列表检查已有项是否都填了值
          if (b.type === 'list_create') {
            const extras = b._extraParams || [];
            const allFilled = extras.every(p => {
              const val = b.params[p.name];
              return val !== undefined && val !== null && String(val).trim() !== '';
            });
            if (!allFilled) { alert(i18n.isEnglish() ? 'Please fill in all existing items before adding new ones' : '请先填写所有已有项的值，再添加新项'); return; }
          }
          EditorCanvas.addDynamicParam(b);
        }
      } else if (action === 'remove-list-item' && blockId) {
        const b = window.EditorState?.blocks[blockId];
        if (b && EditorCanvas.hasDynamicParams(b) && b._extraParams && b._extraParams.length > 0) {
          const last = b._extraParams[b._extraParams.length - 1];
          EditorCanvas.removeDynamicParam(b, last.name);
        }
      } else if (action === 'edit-comment' && blockId) {
        const b = window.EditorState?.blocks[blockId];
        if (b) EditorCanvas.editComment(b);
      } else if (action === 'toggle-important' && blockId) {
        const b = window.EditorState?.blocks[blockId];
        if (b) EditorCanvas.toggleImportant(b);
      } else if (action === 'toggle-collapse' && blockId) {
        if (typeof DevMode !== 'undefined') DevMode.toggleCollapse(blockId);
      } else if (action === 'toggle-breakpoint' && blockId) {
        if (typeof DevMode !== 'undefined') DevMode.toggleBreakpoint(blockId);
      } else if (action === 'run-to-here' && blockId) {
        // 运行到此处：设置断点并运行
        if (typeof DevMode !== 'undefined') {
          DevMode.toggleBreakpoint(blockId);
          Executor.clearOutput();
          document.getElementById('output-log').textContent = '';
          Executor.run();
        }
      }
      menu.classList.add('hidden');
    });
  });

  // 跳转对话框关闭按钮
  const gotoCloseBtn = document.getElementById('goto-label-close');
  if (gotoCloseBtn) {
    gotoCloseBtn.addEventListener('click', () => {
      document.getElementById('goto-label-dialog')?.classList.add('hidden');
    });
  }
});
