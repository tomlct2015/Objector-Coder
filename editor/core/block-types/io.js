/** IO类积木 */
(function () {
  const C = '#59C059';
  BlockRegistry.registerCategory('io', 'IO', C);

  BlockRegistry.register({ type: 'io_print', category: 'io', color: C, label: '打印 {text}', labelKey: 'blocks.io.io_print', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'text', type: 'string', default: 'Hello!' }] });
  BlockRegistry.register({ type: 'io_input', category: 'io', color: C, label: '询问 {q} 并等待', labelKey: 'blocks.io.io_input', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'q', type: 'string', default: '你叫什么名字?' }] });
  BlockRegistry.register({ type: 'io_answer', category: 'io', color: C, label: '回答', labelKey: 'blocks.io.io_answer', shape: 'reporter', ports: { flowIn: false, flowOut: false }, params: [] });
  BlockRegistry.register({ type: 'io_read_file', category: 'io', color: C, label: '读取文件 {path}', labelKey: 'blocks.io.io_read_file', shape: 'reporter', ports: { flowIn: false, flowOut: false }, params: [{ name: 'path', type: 'string', default: 'data.txt' }] });
  BlockRegistry.register({ type: 'io_write_file', category: 'io', color: C, label: '写入文件 {path} 内容 {text}', labelKey: 'blocks.io.io_write_file', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'path', type: 'string', default: 'data.txt' }, { name: 'text', type: 'string', default: '' }] });
  BlockRegistry.register({ type: 'io_save_data', category: 'io', color: C, label: '保存数据 {key} = {val}', labelKey: 'blocks.io.io_save_data', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'key', type: 'string', default: '数据' }, { name: 'val', type: 'string', default: '' }] });
  BlockRegistry.register({ type: 'io_load_data', category: 'io', color: C, label: '加载数据 {key}', labelKey: 'blocks.io.io_load_data', shape: 'reporter', ports: { flowIn: false, flowOut: false }, params: [{ name: 'key', type: 'string', default: '数据' }] });

  // 新增 IO 积木
  BlockRegistry.register({ type: 'io_clear_output', category: 'io', color: C, label: '清空输出', labelKey: 'blocks.io.io_clear_output', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [] });
  BlockRegistry.register({ type: 'io_print_line', category: 'io', color: C, label: '打印换行 {text}', labelKey: 'blocks.io.io_print_line', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'text', type: 'string', default: '' }] });
  BlockRegistry.register({ type: 'io_alert', category: 'io', color: C, label: '弹出提示 {msg}', labelKey: 'blocks.io.io_alert', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'msg', type: 'string', default: '提示' }] });
  BlockRegistry.register({ type: 'io_confirm', category: 'io', color: C, label: '确认 {msg}', labelKey: 'blocks.io.io_confirm', shape: 'boolean', ports: { flowIn: false, flowOut: false }, params: [{ name: 'msg', type: 'string', default: '确定吗?' }] });
  BlockRegistry.register({ type: 'io_log', category: 'io', color: C, label: '控制台日志 {text}', labelKey: 'blocks.io.io_log', shape: 'stack', ports: { flowIn: true, flowOut: true }, params: [{ name: 'text', type: 'string', default: '' }] });
})();
