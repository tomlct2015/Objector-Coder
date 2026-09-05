/**
 * AI 助手模块 - 轻量客户端
 * 打开独立的 Electron 窗口进行 AI 对话
 * 编辑器端负责：提供积木数据、执行工具操作
 */
const AIAssistant = (function () {

  /** 获取完整积木目录文本 */
  function _getBlockCatalog() {
    const allBlocks = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getAllBlocks() : {};
    const categories = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getCategories() : [];
    let catalog = '可用积木分类和类型：\n';
    categories.forEach(cat => {
      const blocks = Object.values(allBlocks).filter(b => b.category === cat.id);
      catalog += `\n【${cat.name}】(分类ID: ${cat.id})\n`;
      blocks.forEach(b => {
        const params = (b.params || []).map(p => {
          let typeStr = p.type;
          if (p.default !== undefined) typeStr += '=' + JSON.stringify(p.default);
          return `${p.name}:${typeStr}`;
        }).join(', ');
        const shape = b.shape || 'stack';
        const ports = [];
        if (b.ports?.flowIn) ports.push('flowIn');
        if (b.ports?.flowOut) ports.push('flowOut');
        if (b.subBlocks) ports.push('subBlocks:' + b.subBlocks.join('|'));
        catalog += `  - type="${b.type}" shape=${shape} label="${b.label}"${params ? ' params={' + params + '}' : ''}${ports.length ? ' ports=[' + ports.join(',') + ']' : ''}\n`;
      });
    });
    return catalog;
  }

  /** 获取当前项目积木的文本描述 */
  function _getCurrentBlocksDescription() {
    const blocks = window.EditorState?.blocks || {};
    const count = Object.keys(blocks).length;
    if (count === 0) return '当前项目没有积木。';
    let desc = `当前项目有 ${count} 个积木：\n`;
    Object.values(blocks).forEach(b => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
      const label = def ? def.label : b.type;
      const paramStr = Object.entries(b.params || {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
      desc += `  [${b.id}] type="${b.type}" label="${label}"${paramStr ? ' (' + paramStr + ')' : ''} pos=(${Math.round(b.x)},${Math.round(b.y)})`;
      if (b.flowIn) desc += ` flowIn=${b.flowIn}`;
      if (b.flowOut) desc += ` flowOut=${b.flowOut}`;
      if (b.subBlocks && Object.keys(b.subBlocks).length) desc += ` subBlocks=${JSON.stringify(b.subBlocks)}`;
      if (b.paramConnections && Object.keys(b.paramConnections).length) desc += ` paramConn=${JSON.stringify(b.paramConnections)}`;
      desc += '\n';
    });
    return desc;
  }

  /** 打开 AI 窗口 */
  async function showPanel() {
    const initData = {
      blockCatalog: _getBlockCatalog(),
      currentBlocks: _getCurrentBlocksDescription(),
    };
    if (window.api?.openAIWindow) {
      await window.api.openAIWindow(initData);
    } else {
      alert('AI 窗口功能仅在桌面版可用');
    }
  }

  /** 在编辑器端执行工具操作 */
  function _executeTool(name, args) {
    const blocks = window.EditorState?.blocks;
    if (!blocks) return '编辑器未就绪';

    if (name === 'generate_blocks') {
      const newBlocks = args.blocks || [];
      if (!Array.isArray(newBlocks) || newBlocks.length === 0) return '没有要添加的积木';

      const idMap = {};
      let added = 0;

      newBlocks.forEach((gb, idx) => {
        const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(gb.type) : null;
        if (!def) return;

        const newId = 'ai_' + Date.now().toString(36) + '_' + idx + '_' + Math.random().toString(36).slice(2, 4);
        idMap[idx] = newId;

        const block = {
          id: newId,
          type: gb.type,
          x: gb.x || 100 + idx * 20,
          y: gb.y || 100 + idx * 60,
          params: {},
          flowIn: null,
          flowOut: null,
          paramConnections: {},
          subBlocks: {},
        };

        // 初始化默认参数
        (def.params || []).forEach(p => {
          block.params[p.name] = p.default;
        });
        // 覆盖用户参数
        if (gb.params) {
          Object.entries(gb.params).forEach(([k, v]) => {
            block.params[k] = v;
          });
        }

        blocks[newId] = block;
        added++;
      });

      // 连接 flowOut 链
      const ids = Object.keys(idMap);
      for (let i = 0; i < ids.length - 1; i++) {
        const curBlock = blocks[idMap[ids[i]]];
        const nextBlock = blocks[idMap[ids[i + 1]]];
        if (!curBlock || !nextBlock) continue;
        const curDef = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(curBlock.type) : null;
        const nextDef = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(nextBlock.type) : null;
        if (curDef?.ports?.flowOut && nextDef?.ports?.flowIn) {
          curBlock.flowOut = nextBlock.id;
          nextBlock.flowIn = curBlock.id;
        }
      }

      if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
      if (typeof HistoryManager !== 'undefined') HistoryManager.pushSnapshot();
      const countEl = document.getElementById('block-count');
      if (countEl) countEl.textContent = `积木: ${Object.keys(blocks).length}`;
      return `已添加 ${added} 个积木`;
    }

    if (name === 'modify_blocks') {
      const blockIds = args.blockIds || [];
      const action = args.action;
      let modified = 0;

      if (action === 'delete') {
        blockIds.forEach(id => {
          if (blocks[id]) {
            // 断开连接
            const b = blocks[id];
            if (b.flowIn && blocks[b.flowIn]) blocks[b.flowIn].flowOut = b.flowOut;
            if (b.flowOut && blocks[b.flowOut]) blocks[b.flowOut].flowIn = b.flowIn;
            delete blocks[id];
            modified++;
          }
        });
      } else if (action === 'move') {
        blockIds.forEach((id, i) => {
          if (blocks[id]) {
            if (args.x !== undefined) blocks[id].x = args.x + i * 20;
            if (args.y !== undefined) blocks[id].y = args.y + i * 60;
            modified++;
          }
        });
      } else if (action === 'update') {
        blockIds.forEach(id => {
          if (blocks[id] && args.params) {
            Object.entries(args.params).forEach(([k, v]) => {
              blocks[id].params[k] = v;
            });
            modified++;
          }
        });
      }

      if (modified > 0) {
        if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
        if (typeof HistoryManager !== 'undefined') HistoryManager.pushSnapshot();
      }
      return `已${action === 'delete' ? '删除' : action === 'move' ? '移动' : '更新'} ${modified} 个积木`;
    }

    return '未知操作: ' + name;
  }

  /** 注册编辑器端事件监听 */
  function initEditorListeners() {
    if (!window.api) return;

    // 接收工具执行请求
    if (window.api.onAIExecuteTool) {
      window.api.onAIExecuteTool((name, args) => {
        const result = _executeTool(name, args);
        window.api.aiToolExecResult(result);
      });
    }

    // 接收积木数据请求
    if (window.api.onAIRequestBlocks) {
      window.api.onAIRequestBlocks(() => {
        const desc = _getCurrentBlocksDescription();
        window.api.aiBlocksResponse(desc);
      });
    }
  }

  // 自动初始化
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initEditorListeners);
    } else {
      initEditorListeners();
    }
  }

  return {
    showPanel,
    getBlockCatalog: _getBlockCatalog,
    getCurrentBlocks: _getCurrentBlocksDescription,
    executeTool: _executeTool,
    initEditorListeners,
  };
})();
