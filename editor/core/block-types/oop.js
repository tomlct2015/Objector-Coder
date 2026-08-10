/** 面向对象类积木 - 支持可扩展参数 */
(function () {
  const C = '#CF63CF';
  BlockRegistry.registerCategory('oop', '类/OOP', C);

  BlockRegistry.register({
    type: 'class_define', category: 'oop', color: C,
    label: '定义类 {name}', labelKey: 'blocks.oop.class_define', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '我的类' }],
  });
  BlockRegistry.register({
    type: 'class_init', category: 'oop', color: C,
    label: '初始化方法', labelKey: 'blocks.oop.class_init', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [],
    subBlocks: ['body'],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('初始化方法', 'Initialize');
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
    type: 'class_method', category: 'oop', color: C,
    label: '方法 {name}', labelKey: 'blocks.oop.class_method', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '方法1' }],
    subBlocks: ['body'],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('方法 {name}', 'Method {name}');
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
    type: 'class_param_get', category: 'oop', color: C,
    label: '参数 {name}', labelKey: 'blocks.oop.class_param_get', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'name', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'class_set_attr', category: 'oop', color: C,
    label: '设置属性 self.{attr} = {val}', labelKey: 'blocks.oop.class_set_attr', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'attr', type: 'string', default: '属性' }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'class_set_attr_external', category: 'oop', color: C,
    label: '设置 {obj}.{attr} = {val}', labelKey: 'blocks.oop.class_set_attr_external', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'obj', type: 'string', default: '' },
      { name: 'attr', type: 'string', default: '属性' },
      { name: 'val', type: 'string', default: '' },
    ],
  });
  BlockRegistry.register({
    type: 'class_get_attr', category: 'oop', color: C,
    label: '{obj}.{attr}', labelKey: 'blocks.oop.class_get_attr', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'obj', type: 'string', default: 'self' }, { name: 'attr', type: 'string', default: '属性' }],
  });
  BlockRegistry.register({
    type: 'class_create', category: 'oop', color: C,
    label: '创建 {cls} 对象', labelKey: 'blocks.oop.class_create', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'cls', type: 'string', default: '我的类' }],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('创建 {cls} 对象', 'Create {cls}');
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
    type: 'class_call_method', category: 'oop', color: C,
    label: '{obj}.{method}', labelKey: 'blocks.oop.class_call_method', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'obj', type: 'string', default: '' }, { name: 'method', type: 'string', default: '方法1' }],
    getLabel: function(block) {
      let label = '{obj}.{method}';
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
    type: 'class_call_method_reporter', category: 'oop', color: C,
    label: '{obj}.{method} 返回值', labelKey: 'blocks.oop.class_call_method_reporter', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'obj', type: 'string', default: '' }, { name: 'method', type: 'string', default: '方法1' }],
    getLabel: function(block) {
      var L = i18n.L;
      let label = '{obj}.{method}';
      const extras = block._extraParams || [];
      if (extras.length > 0) {
        label += '(';
        extras.forEach((ep, i) => {
          label += '{' + ep.name + '}';
          if (i < extras.length - 1) label += ', ';
        });
        label += ')';
      }
      label += L(' 返回值', ' return');
      return label;
    },
  });
  // 新建类：运行时动态定义类（类似 func_set_define 的类版本）
  BlockRegistry.register({
    type: 'class_new', category: 'oop', color: C,
    label: '新建类 {name} 定义为 {code}', labelKey: 'blocks.oop.class_new',
    shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'name', type: 'string', default: '新类' },
      { name: 'code', type: 'block' },
    ],
    getLabel: function(block) {
      var L = i18n.L;
      let label = L('新建类 {name}', 'New class {name}');
      label += L(' 定义为 {code}', ' defined as {code}');
      return label;
    },
  });
  BlockRegistry.register({
    type: 'class_self', category: 'oop', color: C,
    label: 'self', labelKey: 'blocks.oop.class_self', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
})();
