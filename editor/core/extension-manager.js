/**
 * 扩展管理器 - 支持加载自定义扩展积木（JSON 和 JS 两种格式）
 *
 * === 格式一：JSON 文件 ===
 * {
 *   "id": "my-extension",
 *   "name": "我的扩展",
 *   "color": "#FF6B6B",
 *   "blocks": [ { "type": "ext_block", "label": "...", "shape": "stack", "params": [...] } ],
 *   "executors": {
 *     "ext_block": "function(params, scope) { ... }"   // 函数字符串
 *   }
 * }
 *
 * === 格式二：JS 文件 ===
 * ExtensionManager.registerExtension({
 *   id: 'my-extension',
 *   name: '我的扩展',
 *   color: '#FF6B6B',
 *   blocks: [ ... ],
 *   executors: {
 *     ext_block: function(params, scope) { ... }   // 直接写函数，不需要字符串
 *   }
 * });
 */
const ExtensionManager = (function () {
  const _extensions = new Map(); // id -> extension definition
  const _customExecutors = new Map(); // blockType -> executor function

  /**
   * 注册一个扩展
   * @param {Object} extDef - 扩展定义对象
   */
  function registerExtension(extDef) {
    if (!extDef || !extDef.id || !extDef.blocks) {
      console.error('ExtensionManager: 无效的扩展定义', extDef);
      return false;
    }

    // 如果已存在同 id 扩展，先卸载旧版
    if (_extensions.has(extDef.id)) {
      unregisterExtension(extDef.id);
    }

    // 注册分类（避免与内置分类重复时报错）
    if (!_existsCategory(extDef.id)) {
      BlockRegistry.registerCategory(extDef.id, extDef.name || extDef.id, extDef.color || '#888888');
    }

    // 注册积木
    extDef.blocks.forEach(blockDef => {
      blockDef.category = extDef.id;
      if (!blockDef.color) blockDef.color = extDef.color || '#888888';

      if (!blockDef.ports) {
        blockDef.ports = {
          flowIn: blockDef.shape === 'stack' || blockDef.shape === 'c-block',
          flowOut: blockDef.shape === 'stack' || blockDef.shape === 'c-block',
        };
      }

      BlockRegistry.register(blockDef);
    });

    // 注册执行器：支持字符串和函数两种类型
    if (extDef.executors) {
      Object.entries(extDef.executors).forEach(([blockType, executor]) => {
        try {
          let fn;
          if (typeof executor === 'function') {
            // JS 文件：直接传函数对象
            fn = executor;
          } else if (typeof executor === 'string') {
            // JSON 文件：函数字符串，动态解析
            fn = new Function('return ' + executor)();
          } else {
            console.error(`ExtensionManager: 执行器 ${blockType} 类型无效`);
            return;
          }
          _customExecutors.set(blockType, fn);
        } catch (err) {
          console.error(`ExtensionManager: 无法解析执行器 ${blockType}:`, err);
        }
      });
    }

    _extensions.set(extDef.id, extDef);
    console.log(`ExtensionManager: 已注册扩展 "${extDef.name || extDef.id}"，包含 ${extDef.blocks.length} 个积木`);
    return true;
  }

  function _existsCategory(catId) {
    return BlockRegistry.getCategories().some(c => c.id === catId);
  }

  /**
   * 从 JSON 字符串加载扩展
   */
  function loadFromJSON(jsonStr) {
    try {
      const extDef = JSON.parse(jsonStr);
      return registerExtension(extDef);
    } catch (err) {
      console.error('ExtensionManager: JSON 解析失败:', err);
      return false;
    }
  }

  /**
   * 从 JS 文件内容加载扩展（动态执行脚本）
   * JS 文件内应调用 ExtensionManager.registerExtension({...})
   */
  function loadFromJS(jsContent) {
    try {
      // 将 JS 内容注入 script 标签执行
      const script = document.createElement('script');
      script.textContent = jsContent;
      document.head.appendChild(script);
      document.head.removeChild(script);
      return true; // registerExtension 内部会打印日志
    } catch (err) {
      console.error('ExtensionManager: JS 执行失败:', err);
      alert((i18n.isEnglish() ? 'Extension JS execution error: ' : '扩展 JS 文件执行出错：') + err.message);
      return false;
    }
  }

  /**
   * 从文件路径加载扩展（自动检测 JSON / JS 格式）
   * 返回值: { ok: boolean, id: string|null }
   */
  async function loadFromFile(filePath) {
    const content = await window.api.readFile(filePath);
    if (!content) return { ok: false, id: null };

    if (filePath.endsWith('.js')) {
      const before = new Set(_extensions.keys());
      const result = loadFromJS(content);
      const after = new Set(_extensions.keys());
      let id = null;
      for (const k of after) {
        if (!before.has(k)) { id = k; break; }
      }
      return { ok: result, id };
    }

    // JSON 格式：先解析拿 id，再注册
    try {
      const extDef = JSON.parse(content);
      const ok = registerExtension(extDef);
      return { ok, id: extDef.id || null };
    } catch (err) {
      console.error('ExtensionManager: JSON 解析失败:', err);
      return { ok: false, id: null };
    }
  }

  /**
   * 从项目的 extensions 目录加载所有扩展（支持 .json 和 .js）
   */
  async function loadFromProject(projectPath) {
    const extDir = projectPath + '/extensions';
    await window.api.ensureDir(extDir);
    const files = await window.api.listDir(extDir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.js')) {
        const result = await loadFromFile(extDir + '/' + file);
        if (result.ok) count++;
      }
    }
    return count;
  }

  /**
   * 获取自定义执行器
   */
  function getExecutor(blockType) {
    return _customExecutors.get(blockType) || null;
  }

  /**
   * 获取所有已加载的扩展
   */
  function getExtensions() {
    return Array.from(_extensions.values());
  }

  /**
   * 卸载扩展
   */
  function unregisterExtension(extId) {
    const ext = _extensions.get(extId);
    if (!ext) return false;
    ext.blocks.forEach(b => _customExecutors.delete(b.type));
    _extensions.delete(extId);
    return true;
  }

  return {
    registerExtension,
    loadFromJSON,
    loadFromJS,
    loadFromFile,
    loadFromProject,
    getExecutor,
    getExtensions,
    unregisterExtension,
  };
})();
