/** 列表类积木 - 列表作为对象存储在变量中 */
(function () {
  const C = '#FF661A';
  BlockRegistry.registerCategory('lists', '列表', C);

  // 创建列表 - reporter 积木，返回列表对象，可赋值给变量
  // 动态参数槽：默认 0 项，通过右键菜单按需添加，填完现有项才可继续添加
  BlockRegistry.register({
    type: 'list_create', category: 'lists', color: C,
    label: '列表', labelKey: 'blocks.lists.list_create', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
    getLabel(block) {
      var L = i18n.L;
      const all = block._extraParams || [];
      if (all.length === 0) return L('列表', 'List');
      return L('列表', 'List') + ' ' + all.map(p => '{' + p.name + '}').join(' ');
    },
  });

  // 以下操作都通过变量名引用列表对象
  BlockRegistry.register({
    type: 'list_push', category: 'lists', color: C,
    label: '向 {list} 添加 {val}', labelKey: 'blocks.lists.list_push', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'list_delete', category: 'lists', color: C,
    label: '删除 {list} 第 {idx} 项', labelKey: 'blocks.lists.list_delete', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'idx', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'list_insert', category: 'lists', color: C,
    label: '在 {list} 第 {idx} 位插入 {val}', labelKey: 'blocks.lists.list_insert', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'idx', type: 'number', default: 1 }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'list_set', category: 'lists', color: C,
    label: '设置 {list}[{idx}] = {val}', labelKey: 'blocks.lists.list_set', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'idx', type: 'number', default: 1 }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'list_get', category: 'lists', color: C,
    label: '{list}[{idx}]', labelKey: 'blocks.lists.list_get', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'idx', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'list_length', category: 'lists', color: C,
    label: '{list} 的长度', labelKey: 'blocks.lists.list_length', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'list', type: 'string', default: '列表' }],
  });
  BlockRegistry.register({
    type: 'list_contains', category: 'lists', color: C,
    label: '{list} 包含 {val}', labelKey: 'blocks.lists.list_contains', shape: 'boolean',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'list_clear', category: 'lists', color: C,
    label: '清空 {list}', labelKey: 'blocks.lists.list_clear', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }],
  });
  BlockRegistry.register({
    type: 'list_foreach', category: 'lists', color: C,
    label: '遍历 {list} 中每项 {var}', labelKey: 'blocks.lists.list_foreach', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'var', type: 'string', default: 'item' }],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'list_index_of', category: 'lists', color: C,
    label: '{list} 中 {val} 的位置', labelKey: 'blocks.lists.list_index_of', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'val', type: 'string', default: '' }],
  });
  BlockRegistry.register({
    type: 'list_join', category: 'lists', color: C,
    label: '用 {sep} 连接 {list}', labelKey: 'blocks.lists.list_join', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'sep', type: 'string', default: ',' }],
  });
  BlockRegistry.register({
    type: 'list_sort', category: 'lists', color: C,
    label: '排序 {list} {order}', labelKey: 'blocks.lists.list_sort', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }, { name: 'order', type: 'dropdown', default: '升序', options: ['升序', '降序'] }],
  });
  BlockRegistry.register({
    type: 'list_reverse', category: 'lists', color: C,
    label: '反转 {list}', labelKey: 'blocks.lists.list_reverse', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'list', type: 'string', default: '列表' }],
  });
})();
