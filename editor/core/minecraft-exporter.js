/**
 * Minecraft Add-on 导出器
 * 将 Objector 积木项目导出为 Minecraft 基岩版 .mcpack 文件
 */
const MinecraftExporter = (function () {

  /** 生成 UUID v4 */
  function _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  /** MC Script API 桥接层源码（打包进 .mcpack） */
  const BRIDGE_SOURCE = `// Objector -> Minecraft 桥接层 (自动生成)
import { world, system } from '@minecraft/server';

const _dim = () => world.getDimension('overworld');
const _run = (cmd) => { try { _dim().runCommand(cmd); } catch(e) { world.sendMessage('[Objector Error] ' + e.message); } };

export function placeBlock(x, y, z, type) { _run('setblock ' + x + ' ' + y + ' ' + z + ' ' + type); }
export function fillBlocks(x1, y1, z1, x2, y2, z2, type) { _run('fill ' + x1 + ' ' + y1 + ' ' + z1 + ' ' + x2 + ' ' + y2 + ' ' + z2 + ' ' + type); }
export function setBlock(x, y, z, type) { placeBlock(x, y, z, type); }
export function getBlock(x, y, z) { try { return _dim().getBlock({x,y,z}).typeId; } catch(e) { return 'air'; } }
export function spawnEntity(type, x, y, z) { _run('summon ' + type + ' ' + x + ' ' + y + ' ' + z); }
export function spawnItem(item, x, y, z) { _run('summon item ' + x + ' ' + y + ' ' + z + ' {Item:{id:"' + item + '",Count:1}}'); }
export function killEntity(target) { _run('kill ' + target); }
export function teleport(target, x, y, z) { _run('tp ' + target + ' ' + x + ' ' + y + ' ' + z); }
export function giveItem(target, item, count) { _run('give ' + target + ' ' + item + ' ' + count); }
export function getPlayerPos(axis) {
  const players = world.getAllPlayers();
  if (players.length === 0) return 0;
  const loc = players[0].location;
  if (axis === 'x') return Math.floor(loc.x);
  if (axis === 'y') return Math.floor(loc.y);
  if (axis === 'z') return Math.floor(loc.z);
  return 0;
}
export function gamemode(mode) { _run('gamemode ' + mode + ' @p'); }
export function setTime(t) { _run('time set ' + t); }
export function setWeather(w) { _run('weather ' + w); }
export function explode(x, y, z, power) { try { _dim().createExplosion({x,y,z}, power); } catch(e) {} }
export function sendMessage(msg) { world.sendMessage('[Objector] ' + msg); }
export function setTitle(title, subtitle) {
  _run('title @a title {"text":"' + title + '"}');
  if (subtitle) _run('title @a subtitle {"text":"' + subtitle + '"}');
}
export function playSound(sound, target) { _run('playsound ' + sound + ' master ' + target); }
export function setScoreboard(name, target, score) { _run('scoreboard players set ' + target + ' ' + name + ' ' + score); }
export function enchant(target, ench, level) { _run('enchant ' + target + ' ' + ench + ' ' + level); }
export function effect(target, eff, duration, level) { _run('effect give ' + target + ' ' + eff + ' ' + duration + ' ' + level); }
export function runCommand(cmd) { _run(cmd.startsWith('/') ? cmd.slice(1) : cmd); }
export function onEvent(eventType, callback) {
  switch (eventType) {
    case 'playerSpawn': world.afterEvents.playerSpawn.subscribe(ev => callback()); break;
    case 'playerBreakBlock': world.afterEvents.playerBreakBlock.subscribe(ev => callback()); break;
    case 'playerPlaceBlock': world.afterEvents.playerPlaceBlock.subscribe(ev => callback()); break;
    case 'chatSend': world.afterEvents.chatSend.subscribe(ev => callback()); break;
    case 'entityHurt': world.afterEvents.entityHurt.subscribe(ev => callback()); break;
    case 'itemUse': world.afterEvents.itemUse.subscribe(ev => callback()); break;
  }
}
// print -> MC chat
export function mcPrint(msg) { world.sendMessage('[Objector] ' + String(msg)); }
`;

  /** 将积木转换为 MC Script API 代码 */
  function _blocksToCode(blocks) {
    if (!blocks || typeof blocks !== 'object') return '';
    const lines = [];
    const imports = new Set();

    // 收集所有使用的 MC 积木类型
    const allBlocks = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getAllBlocks() : {};
    Object.values(blocks).forEach(blk => {
      if (blk.type && blk.type.startsWith('mc_')) {
        imports.add('_mc_imports');
      }
    });

    // 生成代码（简化版：遍历积木链）
    lines.push("import * as mc from './objector-bridge.js';");
    lines.push('');
    lines.push('// Objector 积木代码 (自动生成)');
    lines.push('');

    // 将 io_print 映射为 mc.mcPrint
    Object.values(blocks).forEach(blk => {
      if (blk.type === 'io_print' && blk.params) {
        lines.push("mc.sendMessage(" + JSON.stringify(String(blk.params.text || '')) + ");");
      } else if (blk.type === 'mc_send_message' && blk.params) {
        lines.push("mc.sendMessage(" + JSON.stringify(String(blk.params.msg || '')) + ");");
      } else if (blk.type === 'mc_place_block' && blk.params) {
        const p = blk.params;
        lines.push("mc.placeBlock(" + (p.x||0) + ", " + (p.y||0) + ", " + (p.z||0) + ", '" + (p.type||'stone') + "');");
      } else if (blk.type === 'mc_spawn_entity' && blk.params) {
        const p = blk.params;
        lines.push("mc.spawnEntity('" + (p.type||'zombie') + "', " + (p.x||0) + ", " + (p.y||0) + ", " + (p.z||0) + ");");
      } else if (blk.type === 'mc_teleport' && blk.params) {
        const p = blk.params;
        lines.push("mc.teleport('" + (p.target||'@p') + "', " + (p.x||0) + ", " + (p.y||0) + ", " + (p.z||0) + ");");
      } else if (blk.type === 'mc_set_time' && blk.params) {
        lines.push("mc.setTime(" + (p.time||1000) + ");");
      } else if (blk.type === 'mc_set_weather' && blk.params) {
        lines.push("mc.setWeather('" + (p.weather||'clear') + "');");
      } else if (blk.type === 'mc_give_item' && blk.params) {
        const p = blk.params;
        lines.push("mc.giveItem('" + (p.target||'@p') + "', '" + (p.item||'diamond') + "', " + (p.count||1) + ");");
      } else if (blk.type === 'mc_explode' && blk.params) {
        const p = blk.params;
        lines.push("mc.explode(" + (p.x||0) + ", " + (p.y||0) + ", " + (p.z||0) + ", " + (p.power||4) + ");");
      } else if (blk.type === 'mc_run_command' && blk.params) {
        lines.push("mc.runCommand(" + JSON.stringify(String(p.cmd||'')) + ");");
      } else if (blk.type === 'mc_set_title' && blk.params) {
        const p = blk.params;
        lines.push("mc.setTitle(" + JSON.stringify(String(p.title||'')) + ", " + JSON.stringify(String(p.subtitle||'')) + ");");
      }
    });

    return lines.join('\n');
  }

  /** 导出 .mcpack 文件 */
  async function exportAddon() {
    if (typeof JSZip === 'undefined') {
      alert('JSZip 库未加载，无法导出');
      return;
    }

    const zip = new JSZip();
    const packUuid1 = _uuid();
    const packUuid2 = _uuid();

    // 1. manifest.json
    const manifest = {
      format_version: 2,
      header: {
        name: (typeof EditorState !== 'undefined' ? EditorState.projectName : 'Objector Project') || 'Objector Add-on',
        description: '由 Objector 可视化编程生成的 Minecraft 基岩版模组',
        uuid: packUuid1,
        version: [1, 0, 0],
        min_engine_version: [1, 20, 0],
      },
      modules: [{
        type: 'script',
        language: 'javascript',
        entry: 'scripts/main.js',
        uuid: packUuid2,
        version: [1, 0, 0],
      }],
      dependencies: [{
        module_name: '@minecraft/server',
        version: '1.9.0',
      }],
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 2. 桥接层
    zip.file('scripts/objector-bridge.js', BRIDGE_SOURCE);

    // 3. 用户代码
    let userCode = '// Objector 积木项目 - 自动生成的 Minecraft 脚本\n\n';
    if (typeof EditorState !== 'undefined' && EditorState.blocks) {
      userCode += _blocksToCode(EditorState.blocks);
    } else {
      userCode += "import * as mc from './objector-bridge.js';\n\nmc.sendMessage('Hello from Objector!');\n";
    }
    zip.file('scripts/main.js', userCode);

    // 4. 生成并下载
    try {
      if (typeof window !== 'undefined' && window.api && window.api.saveFileDialog) {
        // Electron 环境
        const filePath = await window.api.saveFileDialog('objector-addon.mcpack', [
          { name: 'Minecraft Add-on', extensions: ['mcpack'] },
          { name: 'ZIP 文件', extensions: ['zip'] },
        ]);
        if (filePath) {
          const base64 = await zip.generateAsync({ type: 'base64' });
          await window.api.writeFileBinary(filePath, base64);
          return filePath;
        }
      } else {
        // Web 环境：blob 下载
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'objector-addon.mcpack';
        a.click();
        URL.revokeObjectURL(url);
        return 'objector-addon.mcpack';
      }
    } catch (e) {
      alert('导出失败: ' + e.message);
    }
    return null;
  }

  return { exportAddon };
})();
