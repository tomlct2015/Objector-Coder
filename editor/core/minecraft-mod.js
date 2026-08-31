/**
 * MinecraftMod - Minecraft 模组开发模块
 * 提供积木拖拽 + 代码预览的方式生成 Minecraft 模组代码
 * 支持三个平台：基岩版 (Bedrock Script API)、网易版 (ModSDK Python 2.7)、Java 版 (Fabric)
 */
const MinecraftMod = (function () {
  let _editor = null;        // CodeMirror 实例（只读预览）
  let _initialized = false;
  let _currentPlatform = 'bedrock';  // bedrock | netease | fabric | mcfunction

  /** 初始化 Minecraft 模组模式 */
  function init() {
    if (_initialized) return;
    _initialized = true;

    // 先将面板恢复到 main-layout（可能被高级模式或上次模式移走了）
    const mainLayout = document.getElementById('main-layout');
    const palettePanel = document.getElementById('palette-panel');
    const editorPanel = document.getElementById('editor-panel');
    const stagePanel = document.getElementById('stage-panel');
    if (mainLayout && palettePanel && palettePanel.parentNode !== mainLayout) {
      palettePanel.parentNode?.insertBefore(palettePanel, mainLayout.firstChild);
    }
    if (mainLayout && editorPanel && editorPanel.parentNode !== mainLayout) {
      palettePanel?.parentNode?.insertBefore(editorPanel, palettePanel.nextSibling);
    }
    if (mainLayout && stagePanel && stagePanel.parentNode !== mainLayout) {
      mainLayout.appendChild(stagePanel);
    }

    // 显示 MC 模组布局，隐藏其他布局
    mainLayout?.classList.add('hidden');
    document.getElementById('advanced-layout')?.classList.add('hidden');
    document.getElementById('data-layout')?.classList.add('hidden');
    document.getElementById('mc-layout')?.classList.remove('hidden');

    // 隐藏普通工具栏和舞台面板
    document.getElementById('toolbar')?.classList.add('hidden');
    stagePanel?.classList.add('hidden');

    // 将积木面板和编辑器移入 MC 布局左侧（不要清空 mcEditorPanel，会销毁面板！）
    const mcEditorPanel = document.getElementById('mc-editor-panel');
    if (mcEditorPanel && palettePanel && editorPanel) {
      mcEditorPanel.appendChild(palettePanel);
      mcEditorPanel.appendChild(editorPanel);
    }

    // 重新初始化积木面板
    if (typeof Palette !== 'undefined') {
      Palette.init();
    }

    // 画布移入新容器后，重新计算尺寸
    setTimeout(() => {
      if (typeof EditorCanvas !== 'undefined') {
        EditorCanvas.resize();
        EditorCanvas.render();
      }
    }, 50);

    // 初始化 CodeMirror 预览区（只读）
    const editorEl = document.getElementById('mc-code-preview');
    if (editorEl && typeof CodeMirror !== 'undefined') {
      // 关键：在 hidden 容器中初始化 CodeMirror 会导致无法计算尺寸
      // 先临时显示 mc-layout，初始化完再隐藏回来
      const mcLayout = document.getElementById('mc-layout');
      const wasHidden = mcLayout?.classList.contains('hidden');
      if (wasHidden) {
        mcLayout.style.visibility = 'hidden';
        mcLayout.style.position = 'absolute';
        mcLayout.classList.remove('hidden');
      }

      _editor = CodeMirror(editorEl, {
        mode: 'javascript',
        theme: 'material-darker',
        lineNumbers: true,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        readOnly: true,  // 只读模式
        value: '// Minecraft 模组代码预览\n// 在左侧拖拽积木，代码将自动生成\n',
      });

      // 恢复原始状态
      if (wasHidden) {
        mcLayout.classList.add('hidden');
        mcLayout.style.visibility = '';
        mcLayout.style.position = '';
      }

      // 延迟刷新确保正确渲染（布局变为可见时重新计算尺寸）
      setTimeout(() => {
        if (_editor) _editor.refresh();
      }, 200);
    }

    // 绑定工具栏按钮
    document.getElementById('mc-generate')?.addEventListener('click', generateCode);
    document.getElementById('mc-export')?.addEventListener('click', exportAddon);
    
    // 帮助按钮 - 打开 Minecraft API 文档
    document.getElementById('mc-help-btn')?.addEventListener('click', () => {
      const helpUrl = window.api?._isWebShim ? '../minecraft-api/index.html' : '../../minecraft-api/index.html';
      if (window.api?.openExternal) {
        window.api.openExternal(helpUrl);
      } else {
        window.open(helpUrl, '_blank');
      }
    });

    // 平台选择
    const platformSelect = document.getElementById('mc-platform-select');
    if (platformSelect) {
      platformSelect.addEventListener('change', (e) => {
        _currentPlatform = e.target.value;
        generateCode();  // 切换平台时重新生成代码
      });
    }

    // 积木变化时自动更新代码预览
    if (typeof EditorCanvas !== 'undefined' && EditorCanvas.getCanvas) {
      const canvas = EditorCanvas.getCanvas();
      if (canvas) {
        canvas.addEventListener('mouseup', () => { setTimeout(generateCode, 50); });
      }
    }

    // 分割条拖拽
    _initDivider();

    // 窗口大小改变时刷新 CodeMirror
    window.addEventListener('resize', () => {
      if (_editor) {
        setTimeout(() => _editor.refresh(), 100);
      }
    });

    // 初始生成代码
    setTimeout(generateCode, 100);
  }

  /** 分割条拖拽 */
  function _initDivider() {
    const divider = document.getElementById('mc-divider');
    const codePanel = document.getElementById('mc-code-panel');
    if (!divider || !codePanel) return;

    let dragging = false;
    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const main = document.getElementById('mc-main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;
      const minW = 300, maxW = rect.width - 300;
      codePanel.style.width = Math.max(minW, Math.min(newWidth, maxW)) + 'px';
      if (_editor) _editor.refresh();
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  /** 生成代码 */
  function generateCode() {
    if (!_editor) return;

    const blocks = EditorState.blocks || {};
    let code = '';

    // 根据平台生成代码
    switch (_currentPlatform) {
      case 'bedrock':
        code = _generateBedrockCode(blocks);
        break;
      case 'netease':
        code = _generateNeteaseCode(blocks);
        break;
      case 'fabric':
        code = _generateFabricCode(blocks);
        break;
      case 'mcfunction':
        code = _generateMcfunctionPreview(blocks);
        break;
    }

    _editor.setValue(code);
    // 确保代码变更后正确渲染
    _editor.refresh();
  }

  /** 生成基岩版代码 (JavaScript - Script API) */
  function _generateBedrockCode(blocks) {
    let code = '// Minecraft Bedrock Add-on\n';
    code += '// Generated by Objector\n\n';
    code += 'import { world, system } from "@minecraft/server";\n';
    code += 'import { ActionFormData, ModalFormData } from "@minecraft/server-ui";\n\n';

    // 遍历所有 hat 积木（事件）
    const hatBlocks = Object.values(blocks).filter(b => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
      return def && def.shape === 'hat' && def.category === 'minecraft';
    });

    hatBlocks.forEach(hat => {
      const def = BlockRegistry.getBlock(hat.type);
      code += _generateBedrockEvent(hat, def, blocks);
      code += '\n';
    });

    return code;
  }

  /** 生成基岩版事件代码 */
  function _generateBedrockEvent(hat, def, blocks) {
    let code = '';
    const indent = '  ';

    // 根据事件类型生成代码
    switch (hat.type) {
      case 'mc_player_join':
        code += 'world.afterEvents.playerSpawn.subscribe((event) => {\n';
        code += indent + 'if (event.initialSpawn) {\n';
        code += indent + indent + 'const player = event.player;\n';
        code += _generateBedrockBlockChain(hat, blocks, indent + indent);
        code += indent + '}\n';
        code += '});\n';
        break;

      case 'mc_player_chat':
        const msg = hat.params.msg || 'hello';
        code += 'world.beforeEvents.chatSend.subscribe((event) => {\n';
        code += indent + `if (event.message.includes("${msg}")) {\n`;
        code += indent + indent + 'const player = event.sender;\n';
        code += _generateBedrockBlockChain(hat, blocks, indent + indent);
        code += indent + '}\n';
        code += '});\n';
        break;

      case 'mc_block_break':
        code += 'world.afterEvents.playerBreakBlock.subscribe((event) => {\n';
        code += indent + 'const player = event.player;\n';
        code += indent + 'const block = event.block;\n';
        code += _generateBedrockBlockChain(hat, blocks, indent);
        code += '});\n';
        break;

      case 'mc_timer_tick':
        const ticks = hat.params.ticks || 20;
        code += `system.runInterval(() => {\n`;
        code += _generateBedrockBlockChain(hat, blocks, indent);
        code += `}, ${ticks});\n`;
        break;

      default:
        code += '// Unknown event: ' + hat.type + '\n';
    }

    return code;
  }

  /** 生成基岩版积木链代码 */
  function _generateBedrockBlockChain(startBlock, blocks, indent) {
    let code = '';
    let current = startBlock;

    while (current && current.flowOut) {
      const nextBlock = blocks[current.flowOut];
      if (!nextBlock) break;

      const def = BlockRegistry.getBlock(nextBlock.type);
      if (!def || def.category !== 'minecraft') break;

      code += _generateBedrockBlock(nextBlock, def, indent);
      current = nextBlock;
    }

    return code;
  }

  /** 生成单个基岩版积木代码 */
  function _generateBedrockBlock(block, def, indent) {
    const p = block.params || {};
    let code = '';

    switch (block.type) {
      case 'mc_place_block':
        code += `${indent}player.dimension.runCommand("setblock ${p.x} ${p.y} ${p.z} ${p.block}");\n`;
        break;
      case 'mc_fill_area':
        code += `${indent}player.dimension.runCommand("fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.block}");\n`;
        break;
      case 'mc_replace_blocks':
        code += `${indent}player.dimension.runCommand("fill ~-5 ~ ~-5 ~5 ~5 ~5 ${p.to} replace ${p.from}");\n`;
        break;
      case 'mc_clear_area':
        code += `${indent}player.dimension.runCommand("fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} air");\n`;
        break;
      case 'mc_spawn_entity':
        for (let i = 0; i < (p.count || 1); i++) {
          code += `${indent}player.dimension.runCommand("summon ${p.entity} ${p.x} ${p.y} ${p.z}");\n`;
        }
        break;
      case 'mc_kill_nearby':
        code += `${indent}player.dimension.runCommand("kill @e[type=${p.entity},r=${p.radius}]");\n`;
        break;
      case 'mc_teleport_entity':
        code += `${indent}player.dimension.runCommand("tp ${p.target} ${p.x} ${p.y} ${p.z}");\n`;
        break;
      case 'mc_teleport_player':
        code += `${indent}player.dimension.runCommand("tp @s ${p.x} ${p.y} ${p.z}");\n`;
        break;
      case 'mc_give_item':
        code += `${indent}player.dimension.runCommand("give @s ${p.item} ${p.count}");\n`;
        break;
      case 'mc_set_gamemode':
        code += `${indent}player.dimension.runCommand("gamemode ${p.mode} @s");\n`;
        break;
      case 'mc_add_effect':
        code += `${indent}player.dimension.runCommand("effect @s ${p.effect} ${p.duration} ${p.level}");\n`;
        break;
      case 'mc_set_time':
        code += `${indent}player.dimension.runCommand("time set ${p.time}");\n`;
        break;
      case 'mc_set_weather':
        code += `${indent}player.dimension.runCommand("weather ${p.weather}");\n`;
        break;
      case 'mc_set_gamerule':
        code += `${indent}player.dimension.runCommand("gamerule ${p.rule} ${p.value}");\n`;
        break;
      case 'mc_send_message':
        code += `${indent}player.dimension.runCommand("say ${p.msg}");\n`;
        break;
      case 'mc_build_wall':
        code += `${indent}// Build wall: ${p.block} ${p.length}x${p.height}\n`;
        code += `${indent}player.dimension.runCommand("fill ~ ~ ~ ~${p.length - 1} ~${p.height - 1} ~ ${p.block}");\n`;
        break;
      case 'mc_build_floor':
        code += `${indent}// Build floor: ${p.block} ${p.size}x${p.size}\n`;
        code += `${indent}player.dimension.runCommand("fill ~ ~-1 ~ ~${p.size - 1} ~-1 ~${p.size - 1} ${p.block}");\n`;
        break;
      case 'mc_build_house':
        code += `${indent}// Build house: wall=${p.wall}, roof=${p.roof}, size=${p.size}\n`;
        code += `${indent}player.dimension.runCommand("fill ~ ~ ~ ~${p.size} ~3 ~${p.size} ${p.wall} hollow");\n`;
        code += `${indent}player.dimension.runCommand("fill ~-1 ~4 ~-1 ~${p.size + 1} ~4 ~${p.size + 1} ${p.roof}");\n`;
        break;
      case 'mc_loop_command':
        code += `${indent}// Loop: ${p.cmd} (${p.times} times, ${p.delay}s delay)\n`;
        code += `${indent}for (let i = 0; i < ${p.times}; i++) {\n`;
        code += `${indent}  player.dimension.runCommand("${p.cmd}");\n`;
        code += `${indent}  await new Promise(r => setTimeout(r, ${p.delay} * 1000));\n`;
        code += `${indent}}\n`;
        break;
      case 'mc_delay_command':
        code += `${indent}// Delay: ${p.delay}s then ${p.cmd}\n`;
        code += `${indent}await new Promise(r => setTimeout(r, ${p.delay} * 1000));\n`;
        code += `${indent}player.dimension.runCommand("${p.cmd}");\n`;
        break;
      case 'mc_custom_command':
        code += `${indent}player.dimension.runCommand("${p.cmd}");\n`;
        break;
      default:
        code += `${indent}// Unknown block: ${block.type}\n`;
    }

    return code;
  }

  /** 生成网易版代码 (Python 2.7 - ModSDK) */
  function _generateNeteaseCode(blocks) {
    let code = '# -*- coding: utf-8 -*-\n';
    code += '# Minecraft 网易版模组 (ModSDK Python 2.7)\n';
    code += '# Generated by Objector\n\n';
    code += 'import mod.server.extraServerApi as serverApi\n\n';
    code += 'ServerApi = serverApi.GetServerApi()\n';
    code += 'compFactory = ServerApi.GetEngineCompFactory()\n\n';

    // 遍历所有 hat 积木
    const hatBlocks = Object.values(blocks).filter(b => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
      return def && def.shape === 'hat' && def.category === 'minecraft';
    });

    hatBlocks.forEach(hat => {
      const def = BlockRegistry.getBlock(hat.type);
      code += _generateNeteaseEvent(hat, def, blocks);
      code += '\n';
    });

    return code;
  }

  /** 生成网易版事件代码 */
  function _generateNeteaseEvent(hat, def, blocks) {
    let code = '';
    const indent = '  ';

    switch (hat.type) {
      case 'mc_player_join':
        code += 'class PlayerJoinSystem(ServerApi.GetServerSystemCls()):\n';
        code += indent + 'def __init__(self, namespace, systemName):\n';
        code += indent + indent + 'super(PlayerJoinSystem, self).__init__(namespace, systemName)\n';
        code += indent + indent + "self.ListenForEvent(ServerApi.engine_namespace, ServerApi.engine_system_name, 'ServerChatEvent', self, self.on_player_join)\n\n";
        code += indent + 'def on_player_join(self, args):\n';
        code += indent + indent + 'playerId = args["username"]\n';
        code += _generateNeteaseBlockChain(hat, blocks, indent + indent);
        break;

      case 'mc_player_chat':
        const msg = hat.params.msg || 'hello';
        code += 'class ChatSystem(ServerApi.GetServerSystemCls()):\n';
        code += indent + 'def __init__(self, namespace, systemName):\n';
        code += indent + indent + 'super(ChatSystem, self).__init__(namespace, systemName)\n';
        code += indent + indent + "self.ListenForEvent(ServerApi.engine_namespace, ServerApi.engine_system_name, 'ServerChatEvent', self, self.on_chat)\n\n";
        code += indent + 'def on_chat(self, args):\n';
        code += indent + indent + 'msg = args["message"]\n';
        code += indent + indent + `if msg.find("${msg}") >= 0:\n`;
        code += indent + indent + indent + 'playerId = args["username"]\n';
        code += _generateNeteaseBlockChain(hat, blocks, indent + indent + indent);
        break;

      case 'mc_block_break':
        code += 'class BlockBreakSystem(ServerApi.GetServerSystemCls()):\n';
        code += indent + 'def __init__(self, namespace, systemName):\n';
        code += indent + indent + 'super(BlockBreakSystem, self).__init__(namespace, systemName)\n';
        code += indent + indent + "self.ListenForEvent(ServerApi.engine_namespace, ServerApi.engine_system_name, 'DestroyBlockEvent', self, self.on_block_break)\n\n";
        code += indent + 'def on_block_break(self, args):\n';
        code += indent + indent + 'playerId = args["playerId"]\n';
        code += _generateNeteaseBlockChain(hat, blocks, indent + indent);
        break;

      case 'mc_timer_tick':
        const ticks = hat.params.ticks || 20;
        code += 'class TimerSystem(ServerApi.GetServerSystemCls()):\n';
        code += indent + 'def __init__(self, namespace, systemName):\n';
        code += indent + indent + 'super(TimerSystem, self).__init__(namespace, systemName)\n';
        code += indent + indent + 'self.timer_count = 0\n';
        code += indent + indent + "self.ListenForEvent(ServerApi.engine_namespace, ServerApi.engine_system_name, 'GameTickEvent', self, self.on_tick)\n\n";
        code += indent + 'def on_tick(self, args):\n';
        code += indent + indent + 'self.timer_count += 1\n';
        code += indent + indent + `if self.timer_count >= ${ticks}:\n`;
        code += indent + indent + indent + 'self.timer_count = 0\n';
        code += _generateNeteaseBlockChain(hat, blocks, indent + indent + indent);
        break;

      default:
        code += '# Unknown event: ' + hat.type + '\n';
    }

    return code;
  }

  /** 生成网易版积木链代码 */
  function _generateNeteaseBlockChain(startBlock, blocks, indent) {
    let code = '';
    let current = startBlock;

    while (current && current.flowOut) {
      const nextBlock = blocks[current.flowOut];
      if (!nextBlock) break;

      const def = BlockRegistry.getBlock(nextBlock.type);
      if (!def || def.category !== 'minecraft') break;

      code += _generateNeteaseBlock(nextBlock, def, indent);
      current = nextBlock;
    }

    return code;
  }

  /** 生成单个网易版积木代码 */
  function _generateNeteaseBlock(block, def, indent) {
    const p = block.params || {};
    let code = '';

    switch (block.type) {
      case 'mc_place_block':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/setblock ${p.x} ${p.y} ${p.z} ${p.block}")\n`;
        break;
      case 'mc_fill_area':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.block}")\n`;
        break;
      case 'mc_replace_blocks':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ~-5 ~ ~-5 ~5 ~5 ~5 ${p.to} replace ${p.from}")\n`;
        break;
      case 'mc_clear_area':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} air")\n`;
        break;
      case 'mc_spawn_entity':
        for (let i = 0; i < (p.count || 1); i++) {
          code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
          code += `${indent}comp.SetCommand("/summon ${p.entity} ${p.x} ${p.y} ${p.z}")\n`;
        }
        break;
      case 'mc_kill_nearby':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/kill @e[type=${p.entity},r=${p.radius}]")\n`;
        break;
      case 'mc_teleport_entity':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/tp ${p.target} ${p.x} ${p.y} ${p.z}")\n`;
        break;
      case 'mc_teleport_player':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/tp @s ${p.x} ${p.y} ${p.z}")\n`;
        break;
      case 'mc_give_item':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/give @s ${p.item} ${p.count}")\n`;
        break;
      case 'mc_set_gamemode':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/gamemode ${p.mode} @s")\n`;
        break;
      case 'mc_add_effect':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/effect @s ${p.effect} ${p.duration} ${p.level}")\n`;
        break;
      case 'mc_set_time':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/time set ${p.time}")\n`;
        break;
      case 'mc_set_weather':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/weather ${p.weather}")\n`;
        break;
      case 'mc_set_gamerule':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/gamerule ${p.rule} ${p.value}")\n`;
        break;
      case 'mc_send_message':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/say ${p.msg}")\n`;
        break;
      case 'mc_build_wall':
        code += `${indent}# Build wall: ${p.block} ${p.length}x${p.height}\n`;
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ~ ~ ~ ~${p.length - 1} ~${p.height - 1} ~ ${p.block}")\n`;
        break;
      case 'mc_build_floor':
        code += `${indent}# Build floor: ${p.block} ${p.size}x${p.size}\n`;
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ~ ~-1 ~ ~${p.size - 1} ~-1 ~${p.size - 1} ${p.block}")\n`;
        break;
      case 'mc_build_house':
        code += `${indent}# Build house: wall=${p.wall}, roof=${p.roof}, size=${p.size}\n`;
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ~ ~ ~ ~${p.size} ~3 ~${p.size} ${p.wall} hollow")\n`;
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/fill ~-1 ~4 ~-1 ~${p.size + 1} ~4 ~${p.size + 1} ${p.roof}")\n`;
        break;
      case 'mc_loop_command':
        code += `${indent}# Loop: ${p.cmd} (${p.times} times, ${p.delay}s delay)\n`;
        code += `${indent}for i in range(${p.times}):\n`;
        code += `${indent}  comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}  comp.SetCommand("/${p.cmd}")\n`;
        code += `${indent}  import time\n`;
        code += `${indent}  time.sleep(${p.delay})\n`;
        break;
      case 'mc_delay_command':
        code += `${indent}# Delay: ${p.delay}s then ${p.cmd}\n`;
        code += `${indent}import time\n`;
        code += `${indent}time.sleep(${p.delay})\n`;
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/${p.cmd}")\n`;
        break;
      case 'mc_custom_command':
        code += `${indent}comp = compFactory.CreateCommand(ServerApi.levelId)\n`;
        code += `${indent}comp.SetCommand("/${p.cmd}")\n`;
        break;
      default:
        code += `${indent}# Unknown block: ${block.type}\n`;
    }

    return code;
  }

  /** 生成 Java 版代码 (Fabric) */
  function _generateFabricCode(blocks) {
    let code = '// Minecraft Fabric Mod\n';
    code += '// Generated by Objector\n\n';
    code += 'import net.fabricmc.api.ModInitializer;\n';
    code += 'import net.fabricmc.fabric.api.event.Event;\n';
    code += 'import net.minecraft.server.command.CommandManager;\n';
    code += 'import net.minecraft.server.command.ServerCommandSource;\n';
    code += 'import net.minecraft.server.network.ServerPlayerEntity;\n\n';
    code += 'public class ObjectorMod implements ModInitializer {\n';
    code += '  @Override\n';
    code += '  public void onInitialize() {\n';

    // 遍历所有 hat 积木
    const hatBlocks = Object.values(blocks).filter(b => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
      return def && def.shape === 'hat' && def.category === 'minecraft';
    });

    hatBlocks.forEach(hat => {
      const def = BlockRegistry.getBlock(hat.type);
      code += _generateFabricEvent(hat, def, blocks);
    });

    code += '  }\n';
    code += '}\n';

    return code;
  }

  /** 生成 Fabric 事件代码 */
  function _generateFabricEvent(hat, def, blocks) {
    let code = '';
    const indent = '    ';

    switch (hat.type) {
      case 'mc_player_join':
        code += `${indent}// Player join event\n`;
        code += `${indent}// TODO: Register player join callback\n`;
        code += _generateFabricBlockChain(hat, blocks, indent + '  ');
        break;

      case 'mc_player_chat':
        const msg = hat.params.msg || 'hello';
        code += `${indent}// Chat event: "${msg}"\n`;
        code += `${indent}// TODO: Register chat callback\n`;
        code += _generateFabricBlockChain(hat, blocks, indent + '  ');
        break;

      case 'mc_block_break':
        code += `${indent}// Block break event\n`;
        code += `${indent}// TODO: Register block break callback\n`;
        code += _generateFabricBlockChain(hat, blocks, indent + '  ');
        break;

      case 'mc_timer_tick':
        const ticks = hat.params.ticks || 20;
        code += `${indent}// Timer: every ${ticks} ticks\n`;
        code += `${indent}// TODO: Register tick callback\n`;
        code += _generateFabricBlockChain(hat, blocks, indent + '  ');
        break;

      default:
        code += `${indent}// Unknown event: ${hat.type}\n`;
    }

    return code;
  }

  /** 生成 Fabric 积木链代码 */
  function _generateFabricBlockChain(startBlock, blocks, indent) {
    let code = '';
    let current = startBlock;

    while (current && current.flowOut) {
      const nextBlock = blocks[current.flowOut];
      if (!nextBlock) break;

      const def = BlockRegistry.getBlock(nextBlock.type);
      if (!def || def.category !== 'minecraft') break;

      code += _generateFabricBlock(nextBlock, def, indent);
      current = nextBlock;
    }

    return code;
  }

  /** 生成单个 Fabric 积木代码 */
  function _generateFabricBlock(block, def, indent) {
    const p = block.params || {};
    let code = '';

    // Fabric 使用命令执行，简化为注释 + 命令字符串
    switch (block.type) {
      case 'mc_place_block':
        code += `${indent}// Place block: ${p.block} at ${p.x} ${p.y} ${p.z}\n`;
        code += `${indent}// Command: setblock ${p.x} ${p.y} ${p.z} ${p.block}\n`;
        break;
      case 'mc_fill_area':
        code += `${indent}// Fill area with ${p.block}\n`;
        code += `${indent}// Command: fill ${p.x1} ${p.y1} ${p.z1} ${p.x2} ${p.y2} ${p.z2} ${p.block}\n`;
        break;
      case 'mc_spawn_entity':
        code += `${indent}// Spawn ${p.count}x ${p.entity} at ${p.x} ${p.y} ${p.z}\n`;
        code += `${indent}// Command: summon ${p.entity} ${p.x} ${p.y} ${p.z}\n`;
        break;
      case 'mc_teleport_player':
        code += `${indent}// Teleport player to ${p.x} ${p.y} ${p.z}\n`;
        code += `${indent}// Command: tp @s ${p.x} ${p.y} ${p.z}\n`;
        break;
      case 'mc_give_item':
        code += `${indent}// Give ${p.count}x ${p.item}\n`;
        code += `${indent}// Command: give @s ${p.item} ${p.count}\n`;
        break;
      case 'mc_set_time':
        code += `${indent}// Set time to ${p.time}\n`;
        code += `${indent}// Command: time set ${p.time}\n`;
        break;
      case 'mc_send_message':
        code += `${indent}// Send message: ${p.msg}\n`;
        code += `${indent}// Command: say ${p.msg}\n`;
        break;
      default:
        code += `${indent}// Block: ${block.type}\n`;
    }

    return code;
  }

  /** 导出模组包 */
  async function exportAddon() {
    if (typeof JSZip === 'undefined') {
      alert('JSZip 库未加载，无法导出');
      return;
    }

    const zip = new JSZip();

    switch (_currentPlatform) {
      case 'bedrock':
        await _exportBedrockAddon(zip);
        break;
      case 'netease':
        await _exportNeteaseAddon(zip);
        break;
      case 'fabric':
        await _exportFabricAddon(zip);
        break;
      case 'mcfunction':
        await _exportMcfunction(zip);
        break;
    }
  }

  /** 导出基岩版 Add-on */
  async function _exportBedrockAddon(zip) {
    const manifest = {
      format_version: 2,
      header: {
        name: "Objector Mod",
        description: "Generated by Objector",
        uuid: _generateUUID(),
        version: [1, 0, 0],
        min_engine_version: [1, 21, 0]
      },
      modules: [{
        description: "Objector behavior pack",
        type: "script",
        language: "javascript",
        uuid: _generateUUID(),
        version: [1, 0, 0],
        entry: "scripts/main.js"
      }]
    };

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file('scripts/main.js', _editor.getValue());

    // 生成 ZIP 并下载
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'objector-addon.mcpack';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 导出网易版模组 */
  async function _exportNeteaseAddon(zip) {
    const modMain = `# -*- coding: utf-8 -*-
from mod.common.mod import Mod
import mod.server.extraServerApi as serverApi

@Mod.Binding(name='ObjectorMod', version='1.0.0')
class ObjectorMod(object):
    @Mod.InitServer()
    def ObjectorServerInit(self):
        serverApi.RegisterSystem('ObjectorMod', 'ObjectorModServerSystem', 'ObjectorScripts.ObjectorServerSystem.ObjectorServerSystem')

    @Mod.InitClient()
    def ObjectorClientInit(self):
        pass
`;

    zip.file('ObjectorScripts/modMain.py', modMain);
    zip.file('ObjectorScripts/__init__.py', '# -*- coding: utf-8 -*-\n');
    zip.file('ObjectorScripts/ObjectorServerSystem.py', _editor.getValue());
    zip.file('entities/.gitkeep', '');

    // 生成 ZIP 并下载
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'objector-netease-mod.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 导出 Fabric 模组 */
  async function _exportFabricAddon(zip) {
    const fabricModJson = {
      schemaVersion: 1,
      id: "objector_mod",
      version: "1.0.0",
      name: "Objector Mod",
      description: "Generated by Objector",
      authors: ["Objector"],
      environment: "*",
      entrypoints: {
        main: ["com.example.objectormod.ObjectorMod"]
      }
    };

    zip.file('fabric.mod.json', JSON.stringify(fabricModJson, null, 2));
    zip.file('src/main/java/com/example/objectormod/ObjectorMod.java', _editor.getValue());

    // 生成 ZIP 并下载
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'objector-fabric-mod.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 导出 .mcfunction 命令文件 */
  async function _exportMcfunction(zip) {
    const blocks = EditorState.blocks || {};
    
    // 生成 mcfunction 内容
    let mcfunctionContent = '# Generated by Objector\n';
    mcfunctionContent += '# Minecraft function file\n\n';
    
    // 遍历所有积木，生成命令
    const sortedBlocks = Object.values(blocks).sort((a, b) => (a.y || 0) - (b.y || 0));
    
    for (const block of sortedBlocks) {
      const def = BlockRegistry.getBlock(block.type);
      if (!def || def.category !== 'minecraft') continue;
      
      const command = _generateMcfunctionCommand(block, def);
      if (command) {
        mcfunctionContent += command + '\n';
      }
    }
    
    zip.file('functions/main.mcfunction', mcfunctionContent);
    
    // 生成简单的 pack.mcmeta
    const packMcmeta = {
      pack: {
        description: "Generated by Objector",
        pack_format: 15
      }
    };
    zip.file('pack.mcmeta', JSON.stringify(packMcmeta, null, 2));
    
    // 生成 ZIP 并下载
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'objector-mcfunction.zip';
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 生成单个 mcfunction 命令 */
  function _generateMcfunctionCommand(block, def) {
    const p = block.params || {};
    
    switch (block.type) {
      case 'mc_setblock':
        return `setblock ${p.x || '~'} ${p.y || '~'} ${p.z || '~'} ${p.block || 'stone'}`;
      case 'mc_fill':
        return `fill ${p.x1 || '~'} ${p.y1 || '~'} ${p.z1 || '~'} ${p.x2 || '~'} ${p.y2 || '~'} ${p.z2 || '~'} ${p.block || 'stone'}`;
      case 'mc_summon':
        return `summon ${p.entity || 'zombie'} ${p.x || '~'} ${p.y || '~'} ${p.z || '~'}`;
      case 'mc_tp':
        return `tp ${p.target || '@p'} ${p.x || '~'} ${p.y || '~'} ${p.z || '~'}`;
      case 'mc_give':
        return `give ${p.target || '@p'} ${p.item || 'diamond'} ${p.count || 1}`;
      case 'mc_effect':
        return `effect give ${p.target || '@p'} ${p.effect || 'speed'} ${p.duration || 30} ${p.level || 1}`;
      case 'mc_gamerule':
        return `gamerule ${p.rule || 'keepInventory'} ${p.value || 'true'}`;
      case 'mc_time':
        return `time set ${p.time || 'day'}`;
      case 'mc_weather':
        return `weather ${p.weather || 'clear'}`;
      case 'mc_say':
        return `say ${p.message || 'Hello from Objector!'}`;
      case 'mc_kill':
        return `kill ${p.target || '@e[type=!player]'}`;
      default:
        return `# Unsupported block: ${block.type}`;
    }
  }

  /** 生成 mcfunction 预览代码 */
  function _generateMcfunctionPreview(blocks) {
    let code = '# Minecraft Function File (.mcfunction)\n';
    code += '# Generated by Objector\n';
    code += '# Place this file in: datapack/data/<namespace>/functions/\n\n';
    
    // 遍历所有积木，按 Y 坐标排序生成命令
    const sortedBlocks = Object.values(blocks)
      .filter(b => {
        const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
        return def && def.category === 'minecraft';
      })
      .sort((a, b) => (a.y || 0) - (b.y || 0));
    
    if (sortedBlocks.length === 0) {
      code += '# No Minecraft blocks found.\n';
      code += '# Drag Minecraft blocks to the canvas to generate commands.\n';
      return code;
    }
    
    for (const block of sortedBlocks) {
      const def = BlockRegistry.getBlock(block.type);
      const command = _generateMcfunctionCommand(block, def);
      if (command) {
        code += command + '\n';
      }
    }
    
    return code;
  }

  /** 生成 UUID */
  function _generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  return { init, generateCode, exportAddon, getEditor: () => _editor };
})();
