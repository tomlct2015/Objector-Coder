/**
 * i18n - 国际化多语言模块
 * 支持 zh-CN / en 双语切换
 */
const i18n = (function () {
  let _locale = 'zh-CN';
  const _data = { 'zh-CN': {}, 'en': {} };

  try { _locale = localStorage.getItem('app-locale') || 'zh-CN'; } catch {}

  return {
    /** 加载翻译数据（覆盖合并） */
    load(locale, data) {
      if (!_data[locale]) _data[locale] = {};
      _merge(_data[locale], data);
    },

    /** 获取当前语言 */
    getLocale() { return _locale; },

    /** 是否为英文 */
    isEnglish() { return _locale === 'en'; },

    /** 切换语言并刷新页面 */
    setLocale(locale) {
      _locale = locale;
      try { localStorage.setItem('app-locale', locale); } catch {}
      location.reload();
    },

    /** 翻译查找（支持嵌套 key 如 'a.b.c'），可传 fallback */
    t(key, fallback) {
      var val = _resolve(_data[_locale], key);
      if (val !== undefined) return val;
      val = _resolve(_data['zh-CN'], key);
      return val !== undefined ? val : (fallback || key);
    },

    /** 将 data-i18n 属性应用到 DOM */
    applyToDOM() {
      document.querySelectorAll('[data-i18n]').forEach(function(el) {
        var key = el.getAttribute('data-i18n');
        el.textContent = i18n.t(key, el.textContent);
      });
      document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-title');
        el.title = i18n.t(key, el.title);
      });
      document.querySelectorAll('[data-i18n-ph]').forEach(function(el) {
        var key = el.getAttribute('data-i18n-ph');
        el.placeholder = i18n.t(key, el.placeholder);
      });
    },

    /** 动态标签构建器（用于 getLabel 函数）
     *  用法: var L = i18n.L;
     *        L('定义函数 {name}', 'Define function {name}')
     */
    L: function(zh, en) {
      return _locale === 'en' ? (en || zh) : zh;
    },
  };

  // --- 内部工具 ---
  function _resolve(obj, path) {
    if (!obj) return undefined;
    var parts = path.split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function _merge(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          _merge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }
})();
