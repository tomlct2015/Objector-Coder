/** 控制类积木 */
(function () {
  const C = '#FFBF00';
  BlockRegistry.registerCategory('control', '控制', C);

  BlockRegistry.register({
    type: 'wait', category: 'control', color: C,
    label: '等待 {sec} 秒', labelKey: 'blocks.control.wait', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'repeat', category: 'control', color: C,
    label: '重复 {times} 次', labelKey: 'blocks.control.repeat', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'times', type: 'number', default: 10 }],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'forever', category: 'control', color: C,
    label: '重复执行', labelKey: 'blocks.control.forever', shape: 'c-block',
    ports: { flowIn: true, flowOut: false },
    params: [], subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'if_then', category: 'control', color: C,
    label: '如果 {cond} 那么', labelKey: 'blocks.control.if_then', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'cond', type: 'boolean', default: false }],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'if_else', category: 'control', color: C,
    label: '如果 {cond} 那么 / 否则', labelKey: 'blocks.control.if_else', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'cond', type: 'boolean', default: false }],
    subBlocks: ['then', 'else'],
  });
  BlockRegistry.register({
    type: 'repeat_until', category: 'control', color: C,
    label: '重复直到 {cond}', labelKey: 'blocks.control.repeat_until', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'cond', type: 'boolean', default: false }],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'stop_all', category: 'control', color: C,
    label: '停止全部', labelKey: 'blocks.control.stop_all', shape: 'stack',
    ports: { flowIn: true, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'clone_self', category: 'control', color: C,
    label: '创建自己的克隆', labelKey: 'blocks.control.clone_self', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });
  BlockRegistry.register({
    type: 'delete_clone', category: 'control', color: C,
    label: '删除此克隆', labelKey: 'blocks.control.delete_clone', shape: 'stack',
    ports: { flowIn: true, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'control_label_run', category: 'control', color: C,
    label: '给以下积木贴上标签 {label} 并运行', labelKey: 'blocks.control.control_label_run', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'label', type: 'string', default: '标签1' }],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'control_turbo', category: 'control', color: C,
    label: '⚡ 一帧内执行', labelKey: 'blocks.control.control_turbo', shape: 'c-block',
    ports: { flowIn: true, flowOut: true },
    params: [],
    subBlocks: ['body'],
  });
  BlockRegistry.register({
    type: 'control_goto_label', category: 'control', color: C,
    label: '从代码标签 {label} 开始往后运行', labelKey: 'blocks.control.control_goto_label', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'label', type: 'dropdown', default: '标签1', getOptions: function() {
      const labels = ['标签1'];
      if (typeof EditorState !== 'undefined') {
        Object.values(EditorState.blocks).forEach(b => {
          if (b.type === 'control_label_run' && b.params && b.params.label) {
            if (!labels.includes(b.params.label)) labels.push(b.params.label);
          }
          if (b._importantLabel && !labels.includes(b._importantLabel)) {
            labels.push(b._importantLabel);
          }
        });
      }
      return labels;
    }}],
  });
  // === 元编程：积木本身作为值 ===
  // 代码块 - C型返回值积木，左上角 flow-in（被调用），正左中 param-out（获取子代码）
  BlockRegistry.register({
    type: 'control_code_block', category: 'control', color: C,
    label: '代码块', labelKey: 'blocks.control.control_code_block', shape: 'c-block-reporter',
    ports: { flowIn: true, flowOut: false },
    params: [],
    subBlocks: ['body'],
  });
  // 运行 [积木本身]
  BlockRegistry.register({
    type: 'control_run_block', category: 'control', color: C,
    label: '运行 {block}', labelKey: 'blocks.control.control_run_block', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'block', type: 'block' }],
  });
  // 运行 [积木本身] 并返回
  BlockRegistry.register({
    type: 'control_run_return_block', category: 'control', color: C,
    label: '运行 {block} 并返回', labelKey: 'blocks.control.control_run_return_block', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'block', type: 'block' }],
  });
})();
