/**
 * Minecraft 模组开发积木
 * 仅在 MC 模组模式下可见
 */
(function () {
  const C = '#4CAF50'; // MC 草地绿
  BlockRegistry.registerCategory('minecraft', 'Minecraft', C);

  // ===== 事件积木 =====

  BlockRegistry.register({
    type: 'mc_player_join', category: 'minecraft', color: C, mcOnly: true,
    label: '👤 当玩家加入时', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [],
  });

  BlockRegistry.register({
    type: 'mc_player_chat', category: 'minecraft', color: C, mcOnly: true,
    label: '💬 当玩家聊天 {msg} 时', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'msg', type: 'string', default: 'hello' }],
  });

  BlockRegistry.register({
    type: 'mc_block_break', category: 'minecraft', color: C, mcOnly: true,
    label: '⛏ 当方块被破坏时', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [],
  });

  BlockRegistry.register({
    type: 'mc_timer_tick', category: 'minecraft', color: C, mcOnly: true,
    label: '⏱ 每隔 {ticks} tick', shape: 'hat',
    ports: { flowIn: false, flowOut: true },
    params: [{ name: 'ticks', type: 'number', default: 20 }],
  });

  // ===== 方块操作 =====

  BlockRegistry.register({
    type: 'mc_place_block', category: 'minecraft', color: C, mcOnly: true,
    label: '📦 在 {x} {y} {z} 放置 {block}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'x', type: 'string', default: '~' },
      { name: 'y', type: 'string', default: '~1' },
      { name: 'z', type: 'string', default: '~' },
      { name: 'block', type: 'dropdown', default: 'stone',
        options: ['stone', 'dirt', 'grass', 'cobblestone', 'oak_planks', 'oak_log',
                  'sand', 'glass', 'obsidian', 'iron_block', 'gold_block',
                  'diamond_block', 'emerald_block', 'redstone_block', 'tnt', 'air'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_fill_area', category: 'minecraft', color: C, mcOnly: true,
    label: '📦 填充 {x1} {y1} {z1} 到 {x2} {y2} {z2} 为 {block}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'x1', type: 'string', default: '~-3' },
      { name: 'y1', type: 'string', default: '~' },
      { name: 'z1', type: 'string', default: '~-3' },
      { name: 'x2', type: 'string', default: '~3' },
      { name: 'y2', type: 'string', default: '~3' },
      { name: 'z2', type: 'string', default: '~3' },
      { name: 'block', type: 'dropdown', default: 'stone',
        options: ['stone', 'dirt', 'grass', 'cobblestone', 'oak_planks', 'oak_log',
                  'sand', 'glass', 'obsidian', 'iron_block', 'gold_block',
                  'diamond_block', 'emerald_block', 'redstone_block', 'tnt', 'air'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_replace_blocks', category: 'minecraft', color: C, mcOnly: true,
    label: '🔄 将区域内 {from} 替换为 {to}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'from', type: 'dropdown', default: 'stone',
        options: ['stone', 'dirt', 'grass', 'cobblestone', 'oak_planks', 'oak_log',
                  'sand', 'glass', 'obsidian', 'air'] },
      { name: 'to', type: 'dropdown', default: 'dirt',
        options: ['stone', 'dirt', 'grass', 'cobblestone', 'oak_planks', 'oak_log',
                  'sand', 'glass', 'obsidian', 'air'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_clear_area', category: 'minecraft', color: C, mcOnly: true,
    label: '🗑 清除 {x1} {y1} {z1} 到 {x2} {y2} {z2}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'x1', type: 'string', default: '~-3' },
      { name: 'y1', type: 'string', default: '~' },
      { name: 'z1', type: 'string', default: '~-3' },
      { name: 'x2', type: 'string', default: '~3' },
      { name: 'y2', type: 'string', default: '~5' },
      { name: 'z2', type: 'string', default: '~3' },
    ],
  });

  // ===== 实体操作 =====

  BlockRegistry.register({
    type: 'mc_spawn_entity', category: 'minecraft', color: C, mcOnly: true,
    label: '🐾 在 {x} {y} {z} 生成 {count} 只 {entity}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'x', type: 'string', default: '~' },
      { name: 'y', type: 'string', default: '~1' },
      { name: 'z', type: 'string', default: '~' },
      { name: 'count', type: 'number', default: 1 },
      { name: 'entity', type: 'dropdown', default: 'zombie',
        options: ['zombie', 'skeleton', 'creeper', 'spider', 'enderman',
                  'cow', 'pig', 'chicken', 'sheep', 'horse', 'wolf', 'cat',
                  'villager', 'iron_golem', 'snow_golem', 'blaze', 'ghast',
                  'slime', 'guardian', 'phantom', 'drowned', 'bat', 'bee',
                  'fox', 'rabbit', 'panda', 'armor_stand'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_kill_nearby', category: 'minecraft', color: C, mcOnly: true,
    label: '💀 杀死 {radius} 格内的 {entity}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'radius', type: 'number', default: 10 },
      { name: 'entity', type: 'dropdown', default: '*',
        options: ['*', 'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
                  'cow', 'pig', 'chicken', 'sheep', 'villager'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_teleport_entity', category: 'minecraft', color: C, mcOnly: true,
    label: '🌀 传送 {target} 到 {x} {y} {z}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'target', type: 'string', default: '@e[type=zombie,r=10]' },
      { name: 'x', type: 'string', default: '~' },
      { name: 'y', type: 'string', default: '~5' },
      { name: 'z', type: 'string', default: '~' },
    ],
  });

  // ===== 玩家操作 =====

  BlockRegistry.register({
    type: 'mc_teleport_player', category: 'minecraft', color: C, mcOnly: true,
    label: '🌀 传送玩家到 {x} {y} {z}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'x', type: 'string', default: '0' },
      { name: 'y', type: 'string', default: '64' },
      { name: 'z', type: 'string', default: '0' },
    ],
  });

  BlockRegistry.register({
    type: 'mc_give_item', category: 'minecraft', color: C, mcOnly: true,
    label: '🎁 给予 {count} 个 {item}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'count', type: 'number', default: 1 },
      { name: 'item', type: 'dropdown', default: 'diamond_sword',
        options: ['diamond_sword', 'diamond_pickaxe', 'diamond_axe', 'diamond_shovel',
                  'iron_sword', 'iron_pickaxe', 'bow', 'crossbow', 'trident', 'shield',
                  'diamond_helmet', 'diamond_chestplate', 'diamond_leggings', 'diamond_boots',
                  'diamond', 'emerald', 'gold_ingot', 'iron_ingot',
                  'apple', 'golden_apple', 'bread', 'steak',
                  'torch', 'lantern', 'bucket', 'ender_pearl', 'elytra'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_set_gamemode', category: 'minecraft', color: C, mcOnly: true,
    label: '🎮 设置游戏模式为 {mode}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'mode', type: 'dropdown', default: 'survival',
        options: ['survival', 'creative', 'adventure', 'spectator'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_add_effect', category: 'minecraft', color: C, mcOnly: true,
    label: '✨ 添加 {effect} 效果 {duration} 秒 {level} 级', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'effect', type: 'dropdown', default: 'speed',
        options: ['speed', 'strength', 'jump_boost', 'regeneration', 'resistance',
                  'fire_resistance', 'night_vision', 'invisibility', 'haste', 'slow_falling'] },
      { name: 'duration', type: 'number', default: 30 },
      { name: 'level', type: 'number', default: 1 },
    ],
  });

  // ===== 世界操作 =====

  BlockRegistry.register({
    type: 'mc_set_time', category: 'minecraft', color: C, mcOnly: true,
    label: '🕐 设置时间为 {time}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'time', type: 'dropdown', default: 'day',
        options: ['day', 'noon', 'night', 'midnight'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_set_weather', category: 'minecraft', color: C, mcOnly: true,
    label: '🌤 设置天气为 {weather}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'weather', type: 'dropdown', default: 'clear',
        options: ['clear', 'rain', 'thunder'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_set_gamerule', category: 'minecraft', color: C, mcOnly: true,
    label: '⚙ 设置 {rule} 为 {value}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'rule', type: 'dropdown', default: 'keepinventory',
        options: ['keepinventory', 'dodaylightcycle', 'doweathercycle',
                  'domobspawning', 'dofiretick', 'mobgriefing', 'pvp',
                  'dotiledrops', 'naturalregeneration', 'showcoordinates'] },
      { name: 'value', type: 'dropdown', default: 'true',
        options: ['true', 'false'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_send_message', category: 'minecraft', color: C, mcOnly: true,
    label: '💬 广播消息 {msg}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'msg', type: 'string', default: 'Hello from Objector!' },
    ],
  });

  // ===== 建筑操作 =====

  BlockRegistry.register({
    type: 'mc_build_wall', category: 'minecraft', color: C, mcOnly: true,
    label: '🧱 生成 {block} 墙壁 长{length} 高{height} 方向{dir}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'block', type: 'dropdown', default: 'cobblestone',
        options: ['stone', 'cobblestone', 'oak_planks', 'oak_log', 'sand',
                  'glass', 'obsidian', 'iron_block', 'gold_block', 'diamond_block'] },
      { name: 'length', type: 'number', default: 5 },
      { name: 'height', type: 'number', default: 3 },
      { name: 'dir', type: 'dropdown', default: 'x', options: ['x', 'z'] },
    ],
  });

  BlockRegistry.register({
    type: 'mc_build_floor', category: 'minecraft', color: C, mcOnly: true,
    label: '🟫 生成 {block} 地板 {size}x{size}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'block', type: 'dropdown', default: 'oak_planks',
        options: ['stone', 'cobblestone', 'oak_planks', 'oak_log', 'sand',
                  'glass', 'obsidian', 'iron_block', 'gold_block', 'diamond_block'] },
      { name: 'size', type: 'number', default: 5 },
    ],
  });

  BlockRegistry.register({
    type: 'mc_build_house', category: 'minecraft', color: C, mcOnly: true,
    label: '🏠 生成简易房屋 墙{wall} 顶{roof} 大小{size}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'wall', type: 'dropdown', default: 'oak_planks',
        options: ['stone', 'cobblestone', 'oak_planks', 'oak_log', 'sand',
                  'glass', 'obsidian', 'iron_block'] },
      { name: 'roof', type: 'dropdown', default: 'oak_log',
        options: ['stone', 'cobblestone', 'oak_planks', 'oak_log', 'sand',
                  'glass', 'obsidian', 'iron_block'] },
      { name: 'size', type: 'number', default: 7 },
    ],
  });

  // ===== 逻辑操作 =====

  BlockRegistry.register({
    type: 'mc_loop_command', category: 'minecraft', color: C, mcOnly: true,
    label: '🔁 循环执行 {cmd} {times} 次 (间隔 {delay} 秒)', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'cmd', type: 'string', default: 'say Hello' },
      { name: 'times', type: 'number', default: 5 },
      { name: 'delay', type: 'number', default: 1 },
    ],
  });

  BlockRegistry.register({
    type: 'mc_delay_command', category: 'minecraft', color: C, mcOnly: true,
    label: '⏳ 延迟 {delay} 秒后执行 {cmd}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'delay', type: 'number', default: 3 },
      { name: 'cmd', type: 'string', default: 'say Done!' },
    ],
  });

  BlockRegistry.register({
    type: 'mc_custom_command', category: 'minecraft', color: C, mcOnly: true,
    label: '⚡ 执行命令 {cmd}', shape: 'stack',
    ports: { flowIn: true, flowOut: true },
    params: [
      { name: 'cmd', type: 'string', default: 'say Custom command' },
    ],
  });

  // ===== Reporter 积木 =====

  BlockRegistry.register({
    type: 'mc_get_player_x', category: 'minecraft', color: C, mcOnly: true,
    label: '玩家 X 坐标', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });

  BlockRegistry.register({
    type: 'mc_get_player_y', category: 'minecraft', color: C, mcOnly: true,
    label: '玩家 Y 坐标', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });

  BlockRegistry.register({
    type: 'mc_get_player_z', category: 'minecraft', color: C, mcOnly: true,
    label: '玩家 Z 坐标', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });

  BlockRegistry.register({
    type: 'mc_get_player_name', category: 'minecraft', color: C, mcOnly: true,
    label: '玩家名称', shape: 'reporter',
    ports: { flowIn: false, flowOut: false },
    params: [],
  });

})();
