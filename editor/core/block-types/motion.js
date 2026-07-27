/**
 * 运动类积木 - 超越 Scratch 的增强运动系统
 */
(function () {
  const C = '#4C97FF';
  BlockRegistry.registerCategory('motion', '运动', C);

  // ===== 基础移动 =====
  BlockRegistry.register({
    type: 'move_steps', category: 'motion', color: C,
    label: '移动 {steps} 步', labelKey: 'blocks.motion.move_steps', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'steps', type: 'number', default: 10 }],
  });
  BlockRegistry.register({
    type: 'turn_right', category: 'motion', color: C,
    label: '右转 {deg} 度', labelKey: 'blocks.motion.turn_right', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'deg', type: 'number', default: 15 }],
  });
  BlockRegistry.register({
    type: 'turn_left', category: 'motion', color: C,
    label: '左转 {deg} 度', labelKey: 'blocks.motion.turn_left', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'deg', type: 'number', default: 15 }],
  });

  // ===== 位置控制 =====
  BlockRegistry.register({
    type: 'go_to_xy', category: 'motion', color: C,
    label: '移到 x:{x} y:{y}', labelKey: 'blocks.motion.go_to_xy', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: 0 }],
  });
  BlockRegistry.register({
    type: 'go_to_random', category: 'motion', color: C,
    label: '移到随机位置', labelKey: 'blocks.motion.go_to_random', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'go_to_mouse', category: 'motion', color: C,
    label: '移到鼠标位置', labelKey: 'blocks.motion.go_to_mouse', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'go_to_sprite', category: 'motion', color: C,
    label: '移到 {sprite} 的位置', labelKey: 'blocks.motion.go_to_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });
  BlockRegistry.register({
    type: 'change_x', category: 'motion', color: C,
    label: '将 x 坐标增加 {dx}', labelKey: 'blocks.motion.change_x', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'dx', type: 'number', default: 10 }],
  });
  BlockRegistry.register({
    type: 'set_x', category: 'motion', color: C,
    label: '将 x 坐标设为 {x}', labelKey: 'blocks.motion.set_x', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'x', type: 'number', default: 0 }],
  });
  BlockRegistry.register({
    type: 'change_y', category: 'motion', color: C,
    label: '将 y 坐标增加 {dy}', labelKey: 'blocks.motion.change_y', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'dy', type: 'number', default: 10 }],
  });
  BlockRegistry.register({
    type: 'set_y', category: 'motion', color: C,
    label: '将 y 坐标设为 {y}', labelKey: 'blocks.motion.set_y', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'y', type: 'number', default: 0 }],
  });

  // ===== 滑行 =====
  BlockRegistry.register({
    type: 'glide_to', category: 'motion', color: C,
    label: '滑行 {sec} 秒到 x:{x} y:{y}', labelKey: 'blocks.motion.glide_to', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }, { name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: 0 }],
  });
  BlockRegistry.register({
    type: 'glide_to_random', category: 'motion', color: C,
    label: '滑行 {sec} 秒到随机位置', labelKey: 'blocks.motion.glide_to_random', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'glide_to_mouse', category: 'motion', color: C,
    label: '滑行 {sec} 秒到鼠标位置', labelKey: 'blocks.motion.glide_to_mouse', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }],
  });
  BlockRegistry.register({
    type: 'glide_to_sprite', category: 'motion', color: C,
    label: '滑行 {sec} 秒到 {sprite}', labelKey: 'blocks.motion.glide_to_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sec', type: 'number', default: 1 }, { name: 'sprite', type: 'string', default: '精灵1' }],
  });

  // ===== 方向控制 =====
  BlockRegistry.register({
    type: 'set_direction', category: 'motion', color: C,
    label: '面向 {deg} 度', labelKey: 'blocks.motion.set_direction', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'deg', type: 'number', default: 90 }],
  });
  BlockRegistry.register({
    type: 'point_towards_mouse', category: 'motion', color: C,
    label: '面向鼠标', labelKey: 'blocks.motion.point_towards_mouse', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'point_towards_sprite', category: 'motion', color: C,
    label: '面向 {sprite}', labelKey: 'blocks.motion.point_towards_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });
  BlockRegistry.register({
    type: 'change_direction', category: 'motion', color: C,
    label: '将方向增加 {ddir} 度', labelKey: 'blocks.motion.change_direction', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'ddir', type: 'number', default: 15 }],
  });

  // ===== 反弹 =====
  BlockRegistry.register({
    type: 'bounce_edge', category: 'motion', color: C,
    label: '碰到边缘就反弹', labelKey: 'blocks.motion.bounce_edge', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'rotation_style', category: 'motion', color: C,
    label: '设置旋转模式为 {mode}', labelKey: 'blocks.motion.rotation_style', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'mode', type: 'dropdown', default: '任意旋转', options: ['任意旋转', '左右翻转', '不旋转'] }],
  });

  // ===== 超越 Scratch：速度系统 =====
  BlockRegistry.register({
    type: 'set_velocity', category: 'motion', color: C,
    label: '设置速度 vx:{vx} vy:{vy}', labelKey: 'blocks.motion.set_velocity', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'vx', type: 'number', default: 5 }, { name: 'vy', type: 'number', default: 0 }],
  });
  BlockRegistry.register({
    type: 'change_velocity', category: 'motion', color: C,
    label: '将速度改变 vx:{vx} vy:{vy}', labelKey: 'blocks.motion.change_velocity', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'vx', type: 'number', default: 0 }, { name: 'vy', type: 'number', default: -1 }],
  });
  BlockRegistry.register({
    type: 'set_speed_dir', category: 'motion', color: C,
    label: '以速度 {speed} 向 {deg} 度方向运动', labelKey: 'blocks.motion.set_speed_dir', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'speed', type: 'number', default: 5 }, { name: 'deg', type: 'number', default: 90 }],
  });
  BlockRegistry.register({
    type: 'apply_friction', category: 'motion', color: C,
    label: '施加摩擦力 {f}', labelKey: 'blocks.motion.apply_friction', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'f', type: 'number', default: 0.9 }],
  });
  BlockRegistry.register({
    type: 'apply_gravity', category: 'motion', color: C,
    label: '施加重力 {g}', labelKey: 'blocks.motion.apply_gravity', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'g', type: 'number', default: -0.5 }],
  });
  BlockRegistry.register({
    type: 'update_velocity', category: 'motion', color: C,
    label: '按速度移动一步', labelKey: 'blocks.motion.update_velocity', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'bounce_edge_velocity', category: 'motion', color: C,
    label: '碰到边缘反弹速度（弹性 {e}）', labelKey: 'blocks.motion.bounce_edge_velocity', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'e', type: 'number', default: 1 }],
  });

  // ===== 超越 Scratch：追踪系统 =====
  BlockRegistry.register({
    type: 'move_towards_mouse', category: 'motion', color: C,
    label: '向鼠标移动 {steps} 步', labelKey: 'blocks.motion.move_towards_mouse', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'steps', type: 'number', default: 5 }],
  });
  BlockRegistry.register({
    type: 'move_towards_sprite', category: 'motion', color: C,
    label: '向 {sprite} 移动 {steps} 步', labelKey: 'blocks.motion.move_towards_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }, { name: 'steps', type: 'number', default: 5 }],
  });
  BlockRegistry.register({
    type: 'move_away_from_sprite', category: 'motion', color: C,
    label: '远离 {sprite} {steps} 步', labelKey: 'blocks.motion.move_away_from_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }, { name: 'steps', type: 'number', default: 5 }],
  });

  // ===== 超越 Scratch：圆周运动 =====
  BlockRegistry.register({
    type: 'orbit_sprite', category: 'motion', color: C,
    label: '绕 {sprite} 旋转 {deg} 度（半径 {r}）', labelKey: 'blocks.motion.orbit_sprite', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }, { name: 'deg', type: 'number', default: 10 }, { name: 'r', type: 'number', default: 80 }],
  });

  // ===== 超越 Scratch：随机移动 =====
  BlockRegistry.register({
    type: 'random_move', category: 'motion', color: C,
    label: '随机移动 {min}~{max} 步', labelKey: 'blocks.motion.random_move', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'min', type: 'number', default: 1 }, { name: 'max', type: 'number', default: 20 }],
  });
  BlockRegistry.register({
    type: 'random_turn', category: 'motion', color: C,
    label: '随机转向 {min}~{max} 度', labelKey: 'blocks.motion.random_turn', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [{ name: 'min', type: 'number', default: -30 }, { name: 'max', type: 'number', default: 30 }],
  });

  // ===== 超越 Scratch：位置历史 =====
  BlockRegistry.register({
    type: 'go_back', category: 'motion', color: C,
    label: '返回上一步位置', labelKey: 'blocks.motion.go_back', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });

  // ===== 超越 Scratch：边界 =====
  BlockRegistry.register({
    type: 'clamp_to_stage', category: 'motion', color: C,
    label: '限制在舞台内', labelKey: 'blocks.motion.clamp_to_stage', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });
  BlockRegistry.register({
    type: 'wrap_around', category: 'motion', color: C,
    label: '超出舞台从另一侧进入', labelKey: 'blocks.motion.wrap_around', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [],
  });

  // ===== Reporter 积木 =====
  BlockRegistry.register({
    type: 'get_x', category: 'motion', color: C,
    label: 'x 坐标', labelKey: 'blocks.motion.get_x', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'get_y', category: 'motion', color: C,
    label: 'y 坐标', labelKey: 'blocks.motion.get_y', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'get_direction', category: 'motion', color: C,
    label: '面向方向', labelKey: 'blocks.motion.get_direction', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  // 超越 Scratch reporter
  BlockRegistry.register({
    type: 'get_vx', category: 'motion', color: C,
    label: 'x 速度', labelKey: 'blocks.motion.get_vx', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'get_vy', category: 'motion', color: C,
    label: 'y 速度', labelKey: 'blocks.motion.get_vy', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'get_speed', category: 'motion', color: C,
    label: '当前速度', labelKey: 'blocks.motion.get_speed', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'distance_to_mouse', category: 'motion', color: C,
    label: '到鼠标的距离', labelKey: 'blocks.motion.distance_to_mouse', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'direction_to_mouse', category: 'motion', color: C,
    label: '到鼠标的方向', labelKey: 'blocks.motion.direction_to_mouse', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
  BlockRegistry.register({
    type: 'distance_to_sprite', category: 'motion', color: C,
    label: '到 {sprite} 的距离', labelKey: 'blocks.motion.distance_to_sprite', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });
  BlockRegistry.register({
    type: 'direction_to_sprite', category: 'motion', color: C,
    label: '到 {sprite} 的方向', labelKey: 'blocks.motion.direction_to_sprite', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [{ name: 'sprite', type: 'string', default: '精灵1' }],
  });
  BlockRegistry.register({
    type: 'is_at_edge', category: 'motion', color: C,
    label: '在舞台边缘?', labelKey: 'blocks.motion.is_at_edge', shape: 'boolean',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });
})();

