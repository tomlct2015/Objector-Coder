/**
 * 项目管理器 - 保存/重命名项目（编辑器窗口使用）
 */
const ProjectManager = (function () {
  /** 重命名项目：同时更新 project.json 和磁盘目录 */
  async function renameProject() {
    const oldName = EditorState.projectName || i18n.t('titlebar.unnamed');
    const newName = await window.showCustomPrompt(i18n.t('dialog.renamePrompt'), oldName);
    if (newName === null || newName.trim() === '') return;

    const trimmed = newName.trim();
    const oldPath = EditorState.projectPath;
    if (!oldPath) return;

    // 计算新目录路径（同父目录下重命名）
    const parentDir = oldPath.replace(/[\\/][^\\/]*$/, '');  // 去掉末尾目录名
    const newPath = parentDir + '/' + trimmed;

    // 如果目录名没变，只更新 project.json
    if (oldPath === newPath) {
      EditorState.projectName = trimmed;
      document.getElementById('project-name').textContent = trimmed;
      const configStr = await window.api.readFile(oldPath + '/project.json');
      let config = {};
      if (configStr) { try { config = JSON.parse(configStr); } catch {} }
      config.name = trimmed;
      await window.api.writeFile(oldPath + '/project.json', JSON.stringify(config, null, 2));
    } else {
      // 重命名目录
      const result = await window.api.renameFolder(oldPath, newPath);
      if (result && result.error) {
        alert(i18n.t('dialog.renameFailed', null).replace('{error}', result.error));
        return;
      }
      // 更新内存状态
      EditorState.projectPath = newPath;
      EditorState.projectName = trimmed;
      document.getElementById('project-name').textContent = trimmed;
      // 更新 project.json
      const configStr = await window.api.readFile(newPath + '/project.json');
      let config = {};
      if (configStr) { try { config = JSON.parse(configStr); } catch {} }
      config.name = trimmed;
      await window.api.writeFile(newPath + '/project.json', JSON.stringify(config, null, 2));
    }

    // 同步更新"最近项目"列表中的路径和名称
    _updateRecentProject(oldPath, newPath, trimmed);

    document.getElementById('status-text').textContent = i18n.t('status.renamed', null).replace('{name}', trimmed);
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 更新 localStorage 中最近项目列表的路径和名称 */
  function _updateRecentProject(oldPath, newPath, newName) {
    try {
      // 更新最近项目
      const list = JSON.parse(localStorage.getItem('recent-projects') || '[]');
      let changed = false;
      list.forEach(p => {
        if (p.path === oldPath) {
          p.path = newPath;
          p.name = newName;
          changed = true;
        }
      });
      if (changed) localStorage.setItem('recent-projects', JSON.stringify(list));

      // 更新固定项目
      const pinned = JSON.parse(localStorage.getItem('pinned-projects') || '[]');
      let pinnedChanged = false;
      pinned.forEach(p => {
        if (p.path === oldPath) {
          p.path = newPath;
          p.name = newName;
          pinnedChanged = true;
        }
      });
      if (pinnedChanged) localStorage.setItem('pinned-projects', JSON.stringify(pinned));
    } catch {}
  }

  async function saveProject() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }
    // 同步当前精灵的积木
    if (typeof StageManager !== 'undefined') {
      StageManager.getSpriteData(); // 触发同步
    }
    // 保存所有精灵的合并积木到 scripts/main.json（兼容旧版）
    let allBlocks = {};
    if (typeof StageManager !== 'undefined' && StageManager.getAllBlocks) {
      allBlocks = StageManager.getAllBlocks();
    } else {
      allBlocks = EditorState.blocks || {};
    }
    const json = Serializer.serialize(allBlocks);
    await window.api.writeFile(EditorState.projectPath + '/scripts/main.json', json);

    // 保存精灵数据到 project.json（贴图路径转为相对路径）
    const configStr = await window.api.readFile(EditorState.projectPath + '/project.json');
    let config = {};
    if (configStr) {
      try { config = JSON.parse(configStr); } catch {}
    }
    const spritesData = StageManager.getSpriteData().map(sd => {
      // 使用 costumeName 作为主要造型标识（仅保存文件名）
      const result = { ...sd };
      // 如果 costumeName 存在，删除 costumePath（因为加载时从 CostumeManager 获取）
      if (result.costumeName) {
        result.costumePath = ''; // 仅作为兼容旧版备用
      } else if (result.costumePath) {
        // 兼容旧版：转为相对路径
        const projPath = EditorState.projectPath.replace(/\\/g, '/');
        const cpNorm = result.costumePath.replace(/\\/g, '/');
        if (cpNorm.startsWith(projPath)) {
          let rel = cpNorm.slice(projPath.length);
          if (rel.startsWith('/')) rel = rel.slice(1);
          result.costumePath = rel;
        }
      }
      return result;
    });
    config.sprites = spritesData;
    config.stageWidth = StageManager.STAGE_W;
    config.stageHeight = StageManager.STAGE_H;
    await window.api.writeFile(EditorState.projectPath + '/project.json', JSON.stringify(config, null, 2));

    document.getElementById('status-text').textContent = i18n.t('status.saved');
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  return { saveProject, renameProject };
})();
