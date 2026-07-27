/**
 * 连接管理器 - 处理积木端口之间的连接/断开
 */
const ConnectionManager = (function () {

  /** 判断端口名是否是 sub-in 类型 */
  function isSubPort(def, portName) {
    return def && def.subBlocks && def.subBlocks.includes(portName);
  }

  /** 从所有父级积木的 subBlocks 中移除该积木 */
  function disconnectFromOldSub(blockId) {
    for (const b of Object.values(EditorState.blocks)) {
      if (b.subBlocks) {
        for (const [key, subId] of Object.entries(b.subBlocks)) {
          if (subId === blockId) {
            delete b.subBlocks[key];
          }
        }
      }
    }
  }

  /** 显式连接两个端口 */
  function connect(fromBlockId, fromPort, toBlockId, toPort) {
    const from = EditorState.blocks[fromBlockId];
    const to = EditorState.blocks[toBlockId];
    if (!from || !to) return;

    const fromDef = BlockRegistry.getBlock(from.type);
    const toDef = BlockRegistry.getBlock(to.type);

    const fromIsSub = isSubPort(fromDef, fromPort);
    const toIsSub = isSubPort(toDef, toPort);

    // ===== 子代码连接（最高优先级）=====
    // sub-in → flowIn: 从 C 口拖线到积木顶部
    if (fromIsSub && toPort === 'flowIn') {
      disconnectFromOldSub(to.id);
      from.subBlocks = from.subBlocks || {};
      from.subBlocks[fromPort] = to.id;
      to.flowIn = null;
      return;
    }
    // sub-in → flowOut: 从 C 口拖线到积木底部
    if (fromIsSub && toPort === 'flowOut') {
      disconnectFromOldSub(to.id);
      from.subBlocks = from.subBlocks || {};
      from.subBlocks[fromPort] = to.id;
      // 把 to 整条链的最后一个积木作为入口（整条链都归入）
      return;
    }
    // flowIn → sub-in: 从积木顶部拖线到 C 口
    if (toIsSub && fromPort === 'flowIn') {
      disconnectFromOldSub(from.id);
      to.subBlocks = to.subBlocks || {};
      to.subBlocks[toPort] = from.id;
      from.flowIn = null;
      return;
    }
    // flowOut → sub-in: 从积木底部拖线到 C 口
    if (toIsSub && fromPort === 'flowOut') {
      disconnectFromOldSub(from.id);
      to.subBlocks = to.subBlocks || {};
      to.subBlocks[toPort] = from.id;
      return;
    }
    // 其他 sub-in 组合也归入子代码
    if (fromIsSub) {
      disconnectFromOldSub(to.id);
      from.subBlocks = from.subBlocks || {};
      from.subBlocks[fromPort] = to.id;
      to.flowIn = null;
      return;
    }
    if (toIsSub) {
      disconnectFromOldSub(from.id);
      to.subBlocks = to.subBlocks || {};
      to.subBlocks[toPort] = from.id;
      from.flowIn = null;
      return;
    }

    // ===== flow 连接 =====
    if ((fromPort === 'flowOut' && toPort === 'flowIn') || (fromPort === 'flowIn' && toPort === 'flowOut')) {
      const upper = fromPort === 'flowOut' ? from : to;
      const lower = fromPort === 'flowOut' ? to : from;

      if (upper.flowOut) {
        const old = EditorState.blocks[upper.flowOut];
        if (old) old.flowIn = null;
      }
      if (lower.flowIn) {
        const old = EditorState.blocks[lower.flowIn];
        if (old) old.flowOut = null;
      }

      upper.flowOut = lower.id;
      lower.flowIn = upper.id;

      const usz = BlockRenderer.measureBlock(upper);
      lower.x = upper.x;
      lower.y = upper.y + usz.h;
      shiftChain(lower, lower.x, lower.y);
      return;
    }

    // ===== param-out（reporter/boolean 左侧）→ param-in =====
    if (fromPort === 'value' && toPort !== 'flowIn' && toPort !== 'flowOut') {
      to.paramConnections = to.paramConnections || {};
      to.paramConnections[toPort] = from.id;
      return;
    }
    if (toPort === 'value' && fromPort !== 'flowIn' && fromPort !== 'flowOut') {
      from.paramConnections = from.paramConnections || {};
      from.paramConnections[fromPort] = to.id;
      return;
    }

    // ===== 兜底：reporter/boolean 连接 =====
    if (toDef.shape === 'reporter' || toDef.shape === 'boolean') {
      from.paramConnections = from.paramConnections || {};
      from.paramConnections[fromPort] = to.id;
      return;
    }
    if (fromDef.shape === 'reporter' || fromDef.shape === 'boolean') {
      to.paramConnections = to.paramConnections || {};
      to.paramConnections[toPort] = from.id;
      return;
    }
  }

  function shiftChain(startBlock, x, startY) {
    let cur = startBlock.flowOut;
    let y = startY;
    while (cur) {
      const b = EditorState.blocks[cur];
      if (!b) break;
      const sz = BlockRenderer.measureBlock(b);
      b.x = x;
      b.y = y + sz.h;
      y = b.y;
      cur = b.flowOut;
    }
  }

  return { connect };
})();
