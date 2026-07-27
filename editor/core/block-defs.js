/**
 * 积木定义注册表
 * 每个积木类型通过 BlockRegistry.register() 注册
 */
const BlockRegistry = (function () {
  const _categories = [];
  const _blocks = {};

  return {
    /** 注册分类（已存在则跳过） */
    registerCategory(id, name, color) {
      if (_categories.some(c => c.id === id)) return;
      _categories.push({ id, name, color });
    },

    /** 注册积木定义
     * def: {
     *   type: 'move_steps',        // 唯一标识
     *   category: 'motion',        // 所属分类
     *   label: '移动 {steps} 步',   // 显示文本，{name} 为参数占位
     *   shape: 'stack',            // stack(普通)|hat(事件帽)|reporter(返回值)|boolean(菱形)|c-block(C形含子代码)
     *   ports: { flowIn, flowOut, params:[], subBlocks:[] },
     *   params: [{ name:'steps', type:'number', default:10 }],
     *   color: '#4C97FF',
     * }
     */
    register(def) {
      _blocks[def.type] = def;
    },

    getCategory(id) { return _categories.find(c => c.id === id); },
    getCategories() { return _categories; },
    getBlock(type) { return _blocks[type]; },
    getAllBlocks() { return _blocks; },
    getBlocksByCategory(catId) {
      return Object.values(_blocks).filter(b => b.category === catId);
    },

    /** 创建积木实例 */
    createBlock(type, x, y) {
      const def = _blocks[type];
      if (!def) return null;
      const params = {};
      (def.params || []).forEach(p => { params[p.name] = p.default; });
      return {
        id: 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        type,
        x: x || 0,
        y: y || 0,
        params,
        flowIn: null,
        flowOut: null,
        paramConnections: {},   // paramName -> blockId (reporter)
        subBlocks: {},          // subName -> blockId (top of sub-stack)
      };
    },

    /** 获取积木的有效标签（支持动态标签 + i18n） */
    getLabel(block) {
      const def = _blocks[block.type];
      if (!def) return '';
      if (typeof def.getLabel === 'function') {
        return def.getLabel(block);
      }
      // i18n: 优先通过 labelKey 查找翻译，fallback 到 label
      if (def.labelKey && typeof i18n !== 'undefined') {
        var translated = i18n.t(def.labelKey, def.label);
        return translated;
      }
      return def.label;
    },
  };
})();
