/** 外观类积木 */
(function () {
  const C = '#9966FF';
  BlockRegistry.registerCategory('looks', '外观', C);

  BlockRegistry.register({
    type: 'looks_show', category: 'looks', color: C,
    label: '显示', labelKey: 'blocks.looks.looks_show', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'looks_hide', category: 'looks', color: C,
    label: '隐藏', labelKey: 'blocks.looks.looks_hide', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'looks_say', category: 'looks', color: C,
    label: '说 {text} {sec} 秒', labelKey: 'blocks.looks.looks_say', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: '你好!' }, { name: 'sec', type: 'number', default: 2 }],
  });
  BlockRegistry.register({
    type: 'looks_say_nowait', category: 'looks', color: C,
    label: '说 {text}', labelKey: 'blocks.looks.looks_say_nowait', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: '你好!' }],
  });
  BlockRegistry.register({
    type: 'looks_think', category: 'looks', color: C,
    label: '思考 {text}', labelKey: 'blocks.looks.looks_think', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'text', type: 'string', default: '嗯...' }],
  });
  BlockRegistry.register({
    type: 'looks_next_costume', category: 'looks', color: C,
    label: '下一个造型', labelKey: 'blocks.looks.looks_next_costume', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'looks_set_size', category: 'looks', color: C,
    label: '将大小设为 {size}%', labelKey: 'blocks.looks.looks_set_size', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'size', type: 'number', default: 100 }],
  });
  BlockRegistry.register({
    type: 'looks_change_size', category: 'looks', color: C,
    label: '大小增加 {n}', labelKey: 'blocks.looks.looks_change_size', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'n', type: 'number', default: 10 }],
  });
  BlockRegistry.register({
    type: 'looks_set_color', category: 'looks', color: C,
    label: '将颜色特效设为 {val}', labelKey: 'blocks.looks.looks_set_color', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'val', type: 'number', default: 0 }],
  });
  BlockRegistry.register({
    type: 'looks_clear_effects', category: 'looks', color: C,
    label: '清除图形特效', labelKey: 'blocks.looks.looks_clear_effects', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'looks_set_costume', category: 'looks', color: C,
    label: '切换造型为 {name}', labelKey: 'blocks.looks.looks_set_costume', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'name', type: 'dropdown', default: 'default', getOptions: function() {
      if (typeof CostumeManager !== 'undefined') {
        const names = CostumeManager.getAllNames();
        return names.length > 0 ? ['default', ...names] : ['default'];
      }
      return ['default'];
    }}],
  });
  BlockRegistry.register({
    type: 'looks_get_size', category: 'looks', color: C,
    label: '大小', labelKey: 'blocks.looks.looks_get_size', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
})();
