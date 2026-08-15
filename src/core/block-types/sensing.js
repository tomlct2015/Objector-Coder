/** 侦测类积木（类似 Scratch） */
(function () {
  const C = '#5CB1D6';
  BlockRegistry.registerCategory('sensing', '侦测', C);

  // === 碰撞侦测 ===
  BlockRegistry.register({
    type: 'sensing_touching_edge', category: 'sensing', color: C,
    label: '碰到边缘?', labelKey: 'blocks.sensing.sensing_touching_edge', shape: 'boolean',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({
    type: 'sensing_touching_sprite', category: 'sensing', color: C,
    label: '碰到 {sprite}?', labelKey: 'blocks.sensing.sensing_touching_sprite', shape: 'boolean',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵2' }],
  });

  // === 鼠标侦测 ===
  BlockRegistry.register({
    type: 'sensing_mouse_x', category: 'sensing', color: C,
    label: '鼠标的 x', labelKey: 'blocks.sensing.sensing_mouse_x', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({
    type: 'sensing_mouse_y', category: 'sensing', color: C,
    label: '鼠标的 y', labelKey: 'blocks.sensing.sensing_mouse_y', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({
    type: 'sensing_mouse_down', category: 'sensing', color: C,
    label: '鼠标按下?', labelKey: 'blocks.sensing.sensing_mouse_down', shape: 'boolean',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 键盘侦测 ===
  BlockRegistry.register({
    type: 'sensing_key_pressed', category: 'sensing', color: C,
    label: '按下 {key} 键?', labelKey: 'blocks.sensing.sensing_key_pressed', shape: 'boolean',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'key', type: 'dropdown', default: 'space', options: ['space', 'up', 'down', 'left', 'right', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'enter', 'shift', 'control', 'alt', 'escape', 'tab', 'backspace'] }],
  });

  // === 距离侦测 ===
  BlockRegistry.register({
    type: 'sensing_distance_to', category: 'sensing', color: C,
    label: '到 {sprite} 的距离', labelKey: 'blocks.sensing.sensing_distance_to', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵2' }],
  });

  // === 计时器 ===
  BlockRegistry.register({
    type: 'sensing_timer', category: 'sensing', color: C,
    label: '计时器', labelKey: 'blocks.sensing.sensing_timer', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  BlockRegistry.register({
    type: 'sensing_reset_timer', category: 'sensing', color: C,
    label: '计时器归零', labelKey: 'blocks.sensing.sensing_reset_timer', shape: 'stack',
    ports: { flowIn: true, flowOut: true }, params: [],
  });

  // === 精灵属性侦测 ===
  BlockRegistry.register({
    type: 'sensing_sprite_x', category: 'sensing', color: C,
    label: '{sprite} 的 x 坐标', labelKey: 'blocks.sensing.sensing_sprite_x', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({
    type: 'sensing_sprite_y', category: 'sensing', color: C,
    label: '{sprite} 的 y 坐标', labelKey: 'blocks.sensing.sensing_sprite_y', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({
    type: 'sensing_sprite_direction', category: 'sensing', color: C,
    label: '{sprite} 的方向', labelKey: 'blocks.sensing.sensing_sprite_direction', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  BlockRegistry.register({
    type: 'sensing_sprite_size', category: 'sensing', color: C,
    label: '{sprite} 的大小', labelKey: 'blocks.sensing.sensing_sprite_size', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });

  // === 询问回答（IO 已有 io_input，这里补充回答 reporter）===
  BlockRegistry.register({
    type: 'sensing_answer', category: 'sensing', color: C,
    label: '回答', labelKey: 'blocks.sensing.sensing_answer', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 当前时间 ===
  BlockRegistry.register({
    type: 'sensing_current', category: 'sensing', color: C,
    label: '当前 {unit}', labelKey: 'blocks.sensing.sensing_current', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'unit', type: 'string', default: '秒' }],
  });

  // === 用户名 ===
  BlockRegistry.register({
    type: 'sensing_username', category: 'sensing', color: C,
    label: '用户名', labelKey: 'blocks.sensing.sensing_username', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 舞台尺寸 ===
  BlockRegistry.register({
    type: 'sensing_stage_width', category: 'sensing', color: C,
    label: '舞台宽度', labelKey: 'blocks.sensing.sensing_stage_width', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });
  BlockRegistry.register({
    type: 'sensing_stage_height', category: 'sensing', color: C,
    label: '舞台高度', labelKey: 'blocks.sensing.sensing_stage_height', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 精灵数量 ===
  BlockRegistry.register({
    type: 'sensing_sprite_count', category: 'sensing', color: C,
    label: '精灵数量', labelKey: 'blocks.sensing.sensing_sprite_count', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 时间戳 ===
  BlockRegistry.register({
    type: 'sensing_timestamp', category: 'sensing', color: C,
    label: '当前时间戳 (毫秒)', labelKey: 'blocks.sensing.sensing_timestamp', shape: 'reporter',
    ports: { flowIn: false, flowOut: false }, params: [],
  });

  // === 格式化时间 ===
  BlockRegistry.register({
    type: 'sensing_format_time', category: 'sensing', color: C,
    label: '格式化时间 {fmt}', labelKey: 'blocks.sensing.sensing_format_time', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'fmt', type: 'string', default: 'yyyy-MM-dd HH:mm:ss' }],
  });
})();
