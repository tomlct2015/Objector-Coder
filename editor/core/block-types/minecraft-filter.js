/**
 * Minecraft 模式积木过滤
 * 定义在 Minecraft 模式下需要隐藏的积木和分类
 */
const MinecraftFilter = (function () {

  /** 需要隐藏的整个分类 */
  const HIDDEN_CATEGORIES = [
    '3d',  // 3D 网格 -- Minecraft 有自己的方块系统
  ];

  /** 需要隐藏的内置扩展 */
  const HIDDEN_EXTENSIONS = [
    'ext_drawing',  // 绘图 -- 2D Canvas 绘图，MC 无法使用
  ];

  /** 需要隐藏的具体积木 (按分类) */
  const HIDDEN_BLOCKS = {
    // 运动 -- 鼠标/舞台/精灵相关不可用
    motion: [
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
    ],
    // 外观 -- 2D 精灵概念不可用（保留 looks_say 映射为聊天）
    looks: [
      'looks_show', 'looks_hide', 'looks_next_costume',
      'looks_set_size', 'looks_change_size',
      'looks_set_color', 'looks_clear_effects',
      'looks_think',
    ],
    // 侦测 -- 鼠标/精灵/舞台相关不可用
    sensing: [
      'sensing_touching_edge', 'sensing_touching_sprite',
      'sensing_mouse_x', 'sensing_mouse_y', 'sensing_mouse_down',
      'sensing_distance_to', 'sensing_sprite_x', 'sensing_sprite_y',
      'sensing_sprite_direction', 'sensing_sprite_size',
      'sensing_stage_width', 'sensing_stage_height',
      'sensing_sprite_count',
    ],
    // IO -- 文件操作在 MC 中不可用
    io: [
      'io_read_file', 'io_write_file', 'io_save_data', 'io_load_data',
      'io_alert', 'io_confirm', 'io_input',
    ],
    // 声音 -- MC 有自己的声音系统
    sound: [
      'sound_play', 'sound_stop', 'sound_set_volume',
    ],
  };

  /** 检查是否为 Minecraft 模式 */
  function isMinecraftMode() {
    return typeof EditorState !== 'undefined' && EditorState.projectMode === 'minecraft';
  }

  /** 过滤分类列表 */
  function filterCategories(cats) {
    if (!isMinecraftMode()) return cats;
    return cats.filter(c => !HIDDEN_CATEGORIES.includes(c.id));
  }

  /** 过滤积木列表 */
  function filterBlocks(blocks, catId) {
    if (!isMinecraftMode()) return blocks;
    const hidden = HIDDEN_BLOCKS[catId] || [];
    return blocks.filter(b => !hidden.includes(b.type));
  }

  /** 检查积木是否应该隐藏 */
  function isBlockHidden(type) {
    if (!isMinecraftMode()) return false;
    for (const cat in HIDDEN_BLOCKS) {
      if (HIDDEN_BLOCKS[cat].includes(type)) return true;
    }
    return false;
  }

  /** 检查分类是否应该隐藏 */
  function isCategoryHidden(catId) {
    if (!isMinecraftMode()) return false;
    return HIDDEN_CATEGORIES.includes(catId);
  }

  /** 检查扩展是否应该隐藏 */
  function isExtensionHidden(extId) {
    if (!isMinecraftMode()) return false;
    return HIDDEN_EXTENSIONS.includes(extId);
  }

  return {
    filterCategories,
    filterBlocks,
    isBlockHidden,
    isCategoryHidden,
    isExtensionHidden,
    HIDDEN_CATEGORIES,
    HIDDEN_EXTENSIONS,
    HIDDEN_BLOCKS,
  };
})();
