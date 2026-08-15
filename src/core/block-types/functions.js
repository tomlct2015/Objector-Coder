/** 函数类积木 - 支持多参数定义与调用 */
(function () {
  const C = '#FF6680';
  BlockRegistry.registerCategory('functions', '函数', C);

  BlockRegistry.register({
    type: 'func_define', category: 'functions', color: C,
    label: '定义函数 {name}', labelKey: 'blocks.functions.func_define',
    shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '我的函数' }],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('定义函数 {name}', 'Define function {name}');
      const extras = block._extraParams || [];
      if (extras.length > 0) {
        label += '(';
        extras.forEach((ep, i) => {
          label += '{' + ep.name + '}';
          if (i < extras.length - 1) label += ', ';
        });
        label += ')';
      }
      return label;
    },
  });

  BlockRegistry.register({
    type: 'func_call', category: 'functions', color: C,
    label: '调用 {name}', labelKey: 'blocks.functions.func_call',
    shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '我的函数' }],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('调用 {name}', 'Call {name}');
      const extras = block._extraParams || [];
      if (extras.length > 0) {
        label += '(';
        extras.forEach((ep, i) => {
          label += '{' + ep.name + '}';
          if (i < extras.length - 1) label += ', ';
        });
        label += ')';
      }
      return label;
    },
  });

  BlockRegistry.register({
    type: 'func_call_reporter', category: 'functions', color: C,
    label: '调用 {name} 的返回值', labelKey: 'blocks.functions.func_call_reporter',
    shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'name', type: 'string', default: '我的函数' }],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('调用 {name}', 'Call {name}');
      const extras = block._extraParams || [];
      if (extras.length > 0) {
        label += '(';
        extras.forEach((ep, i) => {
          label += '{' + ep.name + '}';
          if (i < extras.length - 1) label += ', ';
        });
        label += ')';
      }
      label += L(' 的返回值', ' return value');
      return label;
    },
  });

  BlockRegistry.register({
    type: 'func_return', category: 'functions', color: C,
    label: '返回 {val}', labelKey: 'blocks.functions.func_return', shape: 'stack',
    ports: { flowIn: true, flowOut: false },
    params: [{ name: 'val', type: 'string', default: '' }],
  });

  BlockRegistry.register({
    type: 'func_param_get', category: 'functions', color: C,
    label: '参数 {name}', labelKey: 'blocks.functions.func_param_get', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'name', type: 'string', default: '' }],
  });

  // 动态函数定义：将代码块本身注册为函数
  BlockRegistry.register({
    type: 'func_set_define', category: 'functions', color: C,
    label: '设置函数 {name} 定义为 {code}', labelKey: 'blocks.functions.func_set_define',
    shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'name', type: 'string', default: '动态函数' },
      { name: 'code', type: 'block' },
    ],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('设置函数 {name}', 'Set function {name}');
      const extras = block._extraParams || [];
      if (extras.length > 0) {
        label += '(';
        extras.forEach((ep, i) => {
          label += '{' + ep.name + '}';
          if (i < extras.length - 1) label += ', ';
        });
        label += ')';
      }
      label += L(' 定义为 {code}', ' defined as {code}');
      return label;
    },
  });
})();
