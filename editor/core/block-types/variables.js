/** 变量类积木 */
(function () {
  const C = '#FF8C1A';
  BlockRegistry.registerCategory('variables', '变量', C);

  BlockRegistry.register({
    type: 'var_set', category: 'variables', color: C,
    label: '将 {name} 设为 {val}', labelKey: 'blocks.variables.var_set', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '变量' }, { name: 'val', type: 'string', default: 0 }],
  });
  BlockRegistry.register({
    type: 'var_change', category: 'variables', color: C,
    label: '将 {name} 增加 {val}', labelKey: 'blocks.variables.var_change', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '变量' }, { name: 'val', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'var_get', category: 'variables', color: C,
    label: '{name}', labelKey: 'blocks.variables.var_get', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'name', type: 'string', default: '变量' }],
  });
  BlockRegistry.register({
    type: 'var_show', category: 'variables', color: C,
    label: '显示变量 {name}', labelKey: 'blocks.variables.var_show', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '变量' }],
  });
  BlockRegistry.register({
    type: 'var_hide', category: 'variables', color: C,
    label: '隐藏变量 {name}', labelKey: 'blocks.variables.var_hide', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'string', default: '变量' }],
  });

  // 局部域 - C 型槽积木，内部创建的变量只能在此区域内访问
  BlockRegistry.register({
    type: 'scope_local', category: 'variables', color: C,
    label: '局部域', labelKey: 'blocks.variables.scope_local', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [],
    subBlocks: ['body'],
  });
})();
