/**
 * Minecraft 兼容层
 * 当在 Minecraft 模式下加载普通项目时，自动映射不兼容的积木
 */
const MinecraftCompat = (function () {

  /** 积木类型映射：原版积木 -> Minecraft 等价积木/操作 */
  const BLOCK_MAPPING = {
    // 外观 -> MC 聊天
    'looks_say': 'mc_send_message',
    'looks_say_nowait': 'mc_send_message',

    // 运动 -> MC 传送（简化映射）
    'move_steps': 'mc_teleport',
    'go_to_xy': 'mc_teleport',
    'set_x': 'mc_teleport',
    'set_y': 'mc_teleport',
    'change_x': 'mc_teleport',
    'change_y': 'mc_teleport',

    // 声音 -> MC 播放音效
    'sound_play': 'mc_play_sound',
    'sound_play_wait': 'mc_play_sound',
  };

  /** 应该直接跳过（不报错）的积木类型 */
  const SKIP_BLOCKS = [
    'looks_show', 'looks_hide', 'looks_next_costume',
    'looks_set_size', 'looks_change_size',
    'looks_set_color', 'looks_clear_effects',
    'looks_think',
    'sensing_touching_edge', 'sensing_touching_sprite',
    'sensing_mouse_x', 'sensing_mouse_y', 'sensing_mouse_down',
    'sensing_distance_to', 'sensing_sprite_x', 'sensing_sprite_y',
    'sensing_sprite_direction', 'sensing_sprite_size',
    'sensing_stage_width', 'sensing_stage_height',
    'sensing_sprite_count',
    'go_to_mouse', 'glide_to_mouse', 'point_towards_mouse',
    'move_towards_mouse', 'bounce_edge', 'bounce_edge_velocity',
    'rotation_style', 'clamp_to_stage', 'wrap_around',
    'is_at_edge', 'distance_to_mouse', 'direction_to_mouse',
    'go_to_sprite', 'glide_to_sprite', 'point_towards_sprite',
    'move_towards_sprite', 'move_away_from_sprite',
    'orbit_sprite', 'distance_to_sprite', 'direction_to_sprite',
    'go_back',
    'set_velocity', 'change_velocity', 'set_speed_dir',
    'apply_friction', 'apply_gravity', 'update_velocity',
    'io_read_file', 'io_write_file', 'io_save_data', 'io_load_data',
    'io_alert', 'io_confirm', 'io_input',
    'sound_stop', 'sound_set_volume', 'sound_change_volume', 'sound_load',
    // 3D 积木
    '3d_create_box', '3d_create_sphere', '3d_create_cylinder',
    '3d_create_cone', '3d_create_plane',
    '3d_clear_meshes', '3d_mesh_get_attr', '3d_mesh_set_attr',
    '3d_camera_position', '3d_camera_lookat',
    '3d_set_bgcolor', '3d_set_ground_color', '3d_toggle_grid',
    '3d_camera_x', '3d_camera_y', '3d_camera_z',
  ];

  /** 检查是否为 Minecraft 模式 */
  function isMinecraftMode() {
    return typeof EditorState !== 'undefined' && EditorState.projectMode === 'minecraft';
  }

  /** 获取积木映射（如果有的话） */
  function getMapping(blockType) {
    if (!isMinecraftMode()) return null;
    return BLOCK_MAPPING[blockType] || null;
  }

  /** 检查积木是否应该跳过 */
  function shouldSkip(blockType) {
    if (!isMinecraftMode()) return false;
    return SKIP_BLOCKS.includes(blockType);
  }

  /** 处理不兼容积木（在 executor 中调用） */
  function handleIncompatibleBlock(type, params) {
    if (!isMinecraftMode()) return false;

    // 检查是否有映射
    const mapped = BLOCK_MAPPING[type];
    if (mapped) {
      // 执行映射后的积木（简化：直接输出日志）
      if (mapped === 'mc_send_message') {
        const msg = params.text || params.msg || '';
        if (typeof Executor !== 'undefined') {
          Executor.log('[MC聊天] ' + msg);
        }
      } else if (mapped === 'mc_teleport') {
        if (typeof Executor !== 'undefined') {
          Executor.log('/tp @p ' + (params.x || 0) + ' ' + (params.y || 64) + ' ' + (params.z || 0));
        }
      }
      return true; // 已处理
    }

    // 检查是否应该跳过
    if (SKIP_BLOCKS.includes(type)) {
      return true; // 跳过不报错
    }

    return false; // 未处理
  }

  return {
    isMinecraftMode,
    getMapping,
    shouldSkip,
    handleIncompatibleBlock,
    BLOCK_MAPPING,
    SKIP_BLOCKS,
  };
})();
