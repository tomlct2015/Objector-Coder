/**
 * 积木渲染器 - Canvas 绘制引擎
 * 负责将积木实例绘制到 Canvas 上
 */
const BlockRenderer = (function () {
  const PORT_RADIUS = 5;
  const PORT_HIT = 20;
  const BLOCK_HEIGHT = 36;
  const BLOCK_PADDING_X = 12;
  const BLOCK_RADIUS = 8;
  const HAT_HEIGHT = 20;
  const C_MOUTH_HEIGHT = 30;
  const PARAM_SLOT_W = 50;
  const PARAM_SLOT_H = 22;
  const FONT = '13px "Segoe UI","Microsoft YaHei",sans-serif';
  const PARAM_FONT = '12px "Segoe UI","Microsoft YaHei",sans-serif';

  /** 获取积木的所有参数定义（含动态扩展参数） */
  function getAllParams(block) {
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return [];
    const base = def.params || [];
    const extra = block._extraParams || [];
    return [...base, ...extra];
  }

  /** 测量积木尺寸 */
  function measureBlock(block) {
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return { w: 120, h: BLOCK_HEIGHT };

    const ctx = _measureCtx;
    ctx.font = FONT;
    const label = BlockRegistry.getLabel(block);
    const parts = parseLabel(label, block.params || {});
    let totalW = BLOCK_PADDING_X * 2;
    parts.forEach(p => {
      if (p.isParam) {
        totalW += Math.max(PARAM_SLOT_W, ctx.measureText(String(p.value)).width + 16);
      } else {
        totalW += ctx.measureText(p.text).width;
      }
    });
    totalW = Math.max(totalW, 100);

    let h = BLOCK_HEIGHT;
    if (def.shape === 'hat') h += HAT_HEIGHT;
    if (def.shape === 'c-block' || def.shape === 'c-block-reporter') {
      const subNames = def.subBlocks || ['body'];
      h += C_MOUTH_HEIGHT * subNames.length;
    }

    return { w: totalW, h };
  }

  /** 解析 label 模板为 parts 数组 */
  function parseLabel(label, params) {
    const parts = [];
    const regex = /\{([^}]+)\}/g;
    let last = 0, match;
    while ((match = regex.exec(label)) !== null) {
      if (match.index > last) parts.push({ isParam: false, text: label.slice(last, match.index) });
      parts.push({ isParam: true, name: match[1], value: params[match[1]] ?? '' });
      last = regex.lastIndex;
    }
    if (last < label.length) parts.push({ isParam: false, text: label.slice(last) });
    return parts;
  }

  // 离屏 Canvas 用于测量
  const _measureCanvas = document.createElement('canvas');
  const _measureCtx = _measureCanvas.getContext('2d');

  /** 获取积木的各端口位置（相对于积木 x,y） */
  function getPorts(block, size) {
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return [];
    const ports = [];
    const cx = size.w / 2;
    const topOff = def.shape === 'hat' ? HAT_HEIGHT : 0;

    // flow-in 端口
    if (def.ports.flowIn) {
      // c-block-reporter 形状: flow-in 在左上角
      if (def.shape === 'c-block-reporter') {
        ports.push({ type: 'flow-in', x: 20, y: topOff, name: 'flowIn' });
      } else {
        ports.push({ type: 'flow-in', x: cx, y: topOff, name: 'flowIn' });
      }
    }
    if (def.ports.flowOut) {
      ports.push({ type: 'flow-out', x: cx, y: size.h, name: 'flowOut' });
    }

    // reporter / boolean: 左侧 param-out 端口
    if (def.shape === 'reporter') {
      ports.push({ type: 'param-out', x: 0, y: size.h / 2, name: 'value' });
    } else if (def.shape === 'boolean') {
      ports.push({ type: 'param-out', x: 0, y: size.h / 2, name: 'value' });
    }
    // c-block-reporter: 正左中 param-out（获取代码块本身）
    if (def.shape === 'c-block-reporter') {
      ports.push({ type: 'param-out', x: 0, y: topOff + BLOCK_HEIGHT / 2, name: 'value' });
    }

    // 参数端口 (右侧) 和 子代码端口 (左侧)
    const label = BlockRegistry.getLabel(block);
    const parts = parseLabel(label, block.params);
    let offsetX = BLOCK_PADDING_X;
    _measureCtx.font = FONT;
    parts.forEach(p => {
      if (p.isParam) {
        const slotW = Math.max(PARAM_SLOT_W, _measureCtx.measureText(String(p.value)).width + 16);
        ports.push({
          type: 'param-in', x: offsetX + slotW, y: topOff + BLOCK_HEIGHT / 2,
          name: p.name,
        });
        offsetX += slotW;
      } else {
        offsetX += _measureCtx.measureText(p.text).width;
      }
    });
    // 子代码端口
    if (def.subBlocks) {
      let subY = topOff + BLOCK_HEIGHT;
      def.subBlocks.forEach(sn => {
        ports.push({ type: 'sub-in', x: 20, y: subY + 4, name: sn });
        subY += C_MOUTH_HEIGHT;
      });
    }
    return ports;
  }

  /** 绘制单个积木 */
  function drawBlock(ctx, block, selected, hoveredPort) {
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return;
    if (!block.params) block.params = {};
    const size = measureBlock(block);
    const color = def.color;
    const x = block.x, y = block.y;

    ctx.save();

    // 绘制积木形状路径
    ctx.beginPath();
    if (def.shape === 'hat') {
      drawHatPath(ctx, x, y, size.w, size.h);
    } else if (def.shape === 'reporter') {
      drawReporterPath(ctx, x, y, size.w, size.h);
    } else if (def.shape === 'boolean') {
      drawBooleanPath(ctx, x, y, size.w, size.h);
    } else if (def.shape === 'c-block' || def.shape === 'c-block-reporter') {
      drawCBlockPath(ctx, x, y, size.w, size.h, def.subBlocks || ['body']);
    } else {
      drawStackPath(ctx, x, y, size.w, size.h);
    }

    // 透明填充 + 彩色边框
    ctx.fillStyle = selected ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.15)';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.stroke();

    // 选中高亮
    if (selected) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 绘制文本和参数槽
    drawLabel(ctx, block, def, size);

    // 绘制端口点
    const ports = getPorts(block, size);
    ports.forEach(port => {
      const px = x + port.x, py = y + port.y;
      ctx.beginPath();
      const isHovered = hoveredPort && hoveredPort.blockId === block.id && hoveredPort.name === port.name;
      ctx.arc(px, py, isHovered ? PORT_RADIUS + 3 : PORT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#fff' : color;
      ctx.globalAlpha = isHovered ? 1 : 0.6;
      ctx.fill();
      ctx.globalAlpha = 1;
      if (port.type === 'flow-in' || port.type === 'flow-out') {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    });

    // C-block 子代码区域：只绘制子代码端口指示点，不强制子积木到框内
    // 子积木保留自己的位置，由 editor-canvas 独立绘制

    ctx.restore();

    // === 开发者模式可视化叠加 ===
    if (typeof DevMode !== 'undefined') {
      // 断点红点
      if (DevMode.isBreakpoint(block.id)) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size.w - 10, y + 10, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#f38ba8';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }
      // 当前执行高亮
      if (DevMode.getExecutingBlock() === block.id) {
        ctx.save();
        ctx.beginPath();
        if (def.shape === 'hat') drawHatPath(ctx, x - 3, y - 3, size.w + 6, size.h + 6);
        else if (def.shape === 'reporter') drawReporterPath(ctx, x - 3, y - 3, size.w + 6, size.h + 6);
        else if (def.shape === 'boolean') drawBooleanPath(ctx, x - 3, y - 3, size.w + 6, size.h + 6);
        else roundRect(ctx, x - 3, y - 3, size.w + 6, size.h + 6, BLOCK_RADIUS + 2);
        ctx.strokeStyle = '#a6e3a1';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#a6e3a1';
        ctx.shadowBlur = 16;
        ctx.stroke();
        ctx.restore();
      }
      // 折叠指示器（帽子积木上的折叠按钮）
      if (def.shape === 'hat' && DevMode.isCollapsed(block.id)) {
        ctx.save();
        const count = DevMode.getCollapsedCount(block.id);
        const fx = x + size.w - 40, fy = y + 6;
        ctx.fillStyle = 'rgba(249,226,175,0.9)';
        ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('▶ +' + count, fx, fy + 8);
        ctx.restore();
      } else if (def.shape === 'hat') {
        // 未折叠的帽子积木显示折叠指示
        ctx.save();
        const fx = x + size.w - 20, fy = y + 6;
        ctx.fillStyle = 'rgba(166,173,200,0.5)';
        ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('▼', fx, fy + 8);
        ctx.restore();
      }
    }

    // === 批注渲染 ===
    if (block._comment) {
      ctx.save();
      const cy = y + size.h + 4;
      ctx.font = '11px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.textBaseline = 'top';
      const text = '💬 ' + block._comment;
      const tw = ctx.measureText(text).width;
      // 背景
      ctx.fillStyle = 'rgba(249,226,175,0.15)';
      roundRect(ctx, x + 4, cy, Math.min(tw + 10, size.w - 8), 18, 3);
      ctx.fill();
      // 文本
      ctx.fillStyle = 'rgba(249,226,175,0.85)';
      ctx.fillText(text, x + 8, cy + 2, size.w - 16);
      ctx.restore();
    }

    // === 重要代码标记渲染 ===
    if (block._importantLabel) {
      ctx.save();
      // 金色边框高亮
      ctx.beginPath();
      if (def.shape === 'hat') drawHatPath(ctx, x - 2, y - 2, size.w + 4, size.h + 4);
      else if (def.shape === 'c-block' || def.shape === 'c-block-reporter') drawCBlockPath(ctx, x - 2, y - 2, size.w + 4, size.h + 4, def.subBlocks || ['body']);
      else roundRect(ctx, x - 2, y - 2, size.w + 4, size.h + 4, BLOCK_RADIUS + 1);
      ctx.strokeStyle = '#f9e2af';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#f9e2af';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 左上角星号标签
      ctx.fillStyle = 'rgba(249,226,175,0.95)';
      ctx.font = 'bold 11px "Segoe UI","Microsoft YaHei",sans-serif';
      ctx.textBaseline = 'bottom';
      const starText = '⭐ ' + block._importantLabel;
      const starTw = ctx.measureText(starText).width;
      roundRect(ctx, x - 4, y - 16, Math.min(starTw + 8, size.w + 8), 14, 3);
      ctx.fillStyle = 'rgba(40,30,0,0.7)';
      ctx.fill();
      ctx.fillStyle = '#f9e2af';
      ctx.fillText(starText, x, y - 3, size.w);
      ctx.restore();
    }
  }

  /** 绘制标签文本和参数槽 */
  function drawLabel(ctx, block, def, size) {
    const label = BlockRegistry.getLabel(block);
    const parts = parseLabel(label, block.params);
    let cx = block.x + BLOCK_PADDING_X;
    const cy = block.y + (def.shape === 'hat' ? HAT_HEIGHT : 0) + BLOCK_HEIGHT / 2;
    ctx.font = FONT;
    ctx.textBaseline = 'middle';

    parts.forEach(p => {
      if (p.isParam) {
        const slotW = Math.max(PARAM_SLOT_W, ctx.measureText(String(p.value)).width + 16);
        const paramDefForDraw = (getAllParams(block)).find(pr => pr.name === p.name);
        // 参数槽背景
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        roundRect(ctx, cx, cy - PARAM_SLOT_H / 2, slotW, PARAM_SLOT_H, 4);
        ctx.fill();
        // block 类型参数特殊边框（双色渐变）
        if (paramDefForDraw?.type === 'block') {
          const grad = ctx.createLinearGradient(cx, cy - PARAM_SLOT_H / 2, cx + slotW, cy + PARAM_SLOT_H / 2);
          grad.addColorStop(0, '#f9e2af');
          grad.addColorStop(1, def.color);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = def.color;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        // 参数值文本
        ctx.fillStyle = '#e0e0e0';
        ctx.font = PARAM_FONT;
        let displayText = String(p.value);
        if (paramDefForDraw?.type === 'dropdown') displayText += ' ▾';
        else if (paramDefForDraw?.type === 'block') displayText = '🧩 ' + displayText;
        ctx.fillText(displayText, cx + 6, cy);
        ctx.font = FONT;
        // 动态参数的移除按钮（小×）
        const isExtra = (block._extraParams || []).some(ep => ep.name === p.name);
        if (isExtra) {
          ctx.fillStyle = 'rgba(255,100,100,0.7)';
          ctx.font = '11px sans-serif';
          ctx.fillText('×', cx + slotW - 12, cy);
          ctx.font = FONT;
        }
        cx += slotW;
      } else {
        ctx.fillStyle = def.color;
        ctx.fillText(p.text, cx, cy);
        cx += ctx.measureText(p.text).width;
      }
    });
  }

  // ===== 形状路径 =====
  function drawStackPath(ctx, x, y, w, h) {
    roundRect(ctx, x, y, w, h, BLOCK_RADIUS);
  }
  function drawHatPath(ctx, x, y, w, h) {
    ctx.moveTo(x + BLOCK_RADIUS, y + HAT_HEIGHT);
    ctx.quadraticCurveTo(x + w * 0.3, y, x + w * 0.5, y);
    ctx.quadraticCurveTo(x + w * 0.7, y, x + w - BLOCK_RADIUS, y + HAT_HEIGHT);
    ctx.arcTo(x + w, y + HAT_HEIGHT, x + w, y + HAT_HEIGHT + BLOCK_RADIUS, BLOCK_RADIUS);
    ctx.lineTo(x + w, y + h - BLOCK_RADIUS);
    ctx.arcTo(x + w, y + h, x + w - BLOCK_RADIUS, y + h, BLOCK_RADIUS);
    ctx.lineTo(x + BLOCK_RADIUS, y + h);
    ctx.arcTo(x, y + h, x, y + h - BLOCK_RADIUS, BLOCK_RADIUS);
    ctx.lineTo(x, y + HAT_HEIGHT + BLOCK_RADIUS);
    ctx.arcTo(x, y + HAT_HEIGHT, x + BLOCK_RADIUS, y + HAT_HEIGHT, BLOCK_RADIUS);
    ctx.closePath();
  }
  function drawReporterPath(ctx, x, y, w, h) {
    const r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x + r, y + h);
    ctx.arc(x + r, y + r, r, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
  }
  function drawBooleanPath(ctx, x, y, w, h) {
    const p = h / 2;
    ctx.moveTo(x + p, y);
    ctx.lineTo(x + w - p, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w - p, y + h);
    ctx.lineTo(x + p, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  }
  function drawCBlockPath(ctx, x, y, w, h, subs) {
    const mouthH = C_MOUTH_HEIGHT;
    let curY = y;
    roundRect(ctx, x, curY, w, BLOCK_HEIGHT, BLOCK_RADIUS);
    curY += BLOCK_HEIGHT;
    subs.forEach(() => {
      ctx.rect(x + 16, curY, w - 32, mouthH - 4);
      curY += mouthH;
    });
    roundRect(ctx, x, curY, w, 8, BLOCK_RADIUS);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /** 获取参数槽的屏幕区域（用于点击检测） */
  function getParamSlots(block) {
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return [];
    const size = measureBlock(block);
    const topOff = def.shape === 'hat' ? HAT_HEIGHT : 0;
    const label = BlockRegistry.getLabel(block);
    const parts = parseLabel(label, block.params);
    const allParams = getAllParams(block);
    const slots = [];
    let offsetX = BLOCK_PADDING_X;
    _measureCtx.font = FONT;
    parts.forEach(p => {
      if (p.isParam) {
        const slotW = Math.max(PARAM_SLOT_W, _measureCtx.measureText(String(p.value)).width + 16);
        const paramDef = allParams.find(pr => pr.name === p.name);
        slots.push({
          name: p.name,
          x: block.x + offsetX,
          y: block.y + topOff + BLOCK_HEIGHT / 2 - PARAM_SLOT_H / 2,
          w: slotW,
          h: PARAM_SLOT_H,
          value: p.value,
          type: paramDef?.type || 'string',
          options: (typeof paramDef?.getOptions === 'function') ? paramDef.getOptions() : (paramDef?.options || null),
          isExtra: (block._extraParams || []).some(ep => ep.name === p.name),
        });
        offsetX += slotW;
      } else {
        offsetX += _measureCtx.measureText(p.text).width;
      }
    });
    return slots;
  }

  /** 获取动态参数的移除按钮区域 */
  function getRemoveButtons(block) {
    const slots = getParamSlots(block);
    return slots.filter(s => s.isExtra).map(s => ({
      name: s.name,
      x: s.x + s.w - 14,
      y: s.y + 2,
      size: 14,
    }));
  }

  return { measureBlock, getPorts, drawBlock, parseLabel, getParamSlots, getRemoveButtons, PORT_HIT, BLOCK_HEIGHT, HAT_HEIGHT, C_MOUTH_HEIGHT };
})();
