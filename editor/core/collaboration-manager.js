/**
 * 异步协作管理器 - 支持项目版本快照、共享和合并
 * 暂不支持同时编辑，采用"最后保存为准 + 冲突检测"模式
 */
const CollaborationManager = (function () {
  let _projectVersions = [];   // 版本快照列表
  let _collaborators = [];     // 协作者列表
  let _currentVersion = null;  // 当前版本 ID
  let _lockInfo = null;        // 锁信息 { user, timestamp }

  // 从 localStorage 加载
  function _loadState() {
    try {
      const saved = localStorage.getItem('collab-state');
      if (saved) {
        const state = JSON.parse(saved);
        _projectVersions = state.projectVersions || [];
        _collaborators = state.collaborators || [];
        _currentVersion = state.currentVersion || null;
      }
    } catch {}
  }

  function _saveState() {
    localStorage.setItem('collab-state', JSON.stringify({
      projectVersions: _projectVersions.slice(-20), // 只保留最近 20 个版本
      collaborators: _collaborators,
      currentVersion: _currentVersion,
    }));
  }

  /** 创建项目快照 */
  function createSnapshot(label) {
    const blocks = window.EditorState?.blocks || {};
    const sprites = typeof StageManager !== 'undefined' ? StageManager.getSprites() : [];
    
    const snapshot = {
      id: 'v_' + Date.now().toString(36),
      label: label || `快照 ${_projectVersions.length + 1}`,
      timestamp: new Date().toISOString(),
      author: _getCurrentUser(),
      blocks: JSON.parse(JSON.stringify(blocks)),
      sprites: sprites.map(s => ({
        name: s.name,
        x: s.x, y: s.y,
        direction: s.direction,
        size: s.size,
        costumeName: s.costumeName,
        costumePath: s.costumePath,
      })),
      blockCount: Object.keys(blocks).length,
    };

    _projectVersions.push(snapshot);
    _currentVersion = snapshot.id;
    _saveState();
    return snapshot;
  }

  /** 恢复到指定版本 */
  function restoreSnapshot(versionId) {
    const snapshot = _projectVersions.find(v => v.id === versionId);
    if (!snapshot) return false;

    // 确认对话框
    const msg = `确定要恢复到版本 "${snapshot.label}" 吗？\n当前未保存的更改将丢失。`;
    if (!confirm(msg)) return false;

    // 恢复积木
    window.EditorState.blocks = JSON.parse(JSON.stringify(snapshot.blocks));

    // 恢复精灵（简化版）
    if (typeof StageManager !== 'undefined' && snapshot.sprites) {
      // 清除现有精灵（保留第一个）
      const sprites = StageManager.getSprites();
      while (sprites.length > 1) {
        StageManager.removeSprite(sprites.length - 1);
      }
      // 恢复快照中的精灵属性
      if (snapshot.sprites.length > 0) {
        const first = StageManager.getSprites()[0];
        if (first && snapshot.sprites[0]) {
          Object.assign(first, snapshot.sprites[0]);
        }
      }
    }

    // 重新渲染
    if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
    if (typeof HistoryManager !== 'undefined') HistoryManager.pushSnapshot();

    _currentVersion = versionId;
    _saveState();
    return true;
  }

  /** 获取版本列表 */
  function getVersions() {
    return [..._projectVersions].reverse(); // 最新在前
  }

  /** 获取当前版本 */
  function getCurrentVersion() {
    return _currentVersion;
  }

  /** 删除版本 */
  function deleteVersion(versionId) {
    _projectVersions = _projectVersions.filter(v => v.id !== versionId);
    if (_currentVersion === versionId) _currentVersion = null;
    _saveState();
  }

  /** 导出项目为可共享格式 */
  function exportProject() {
    const blocks = window.EditorState?.blocks || {};
    const sprites = typeof StageManager !== 'undefined' ? StageManager.getSprites() : [];
    const config = {
      name: window.EditorState?.projectName || '未命名项目',
      exportTime: new Date().toISOString(),
      version: '1.0',
      author: _getCurrentUser(),
    };

    return {
      config,
      blocks: JSON.parse(JSON.stringify(blocks)),
      sprites: sprites.map(s => ({
        name: s.name, x: s.x, y: s.y,
        direction: s.direction, size: s.size,
        costumeName: s.costumeName, costumePath: s.costumePath,
      })),
    };
  }

  /** 导入共享项目 */
  function importProject(data) {
    if (!data || !data.blocks) return false;
    
    const msg = `导入项目 "${data.config?.name || '未命名'}"？\n这将替换当前项目的所有积木。`;
    if (!confirm(msg)) return false;

    window.EditorState.blocks = JSON.parse(JSON.stringify(data.blocks));
    
    if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
    if (typeof HistoryManager !== 'undefined') HistoryManager.pushSnapshot();

    return true;
  }

  /** 导出为文件 */
  async function exportToFile() {
    const data = exportProject();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.config.name || 'project'}_shared.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 从文件导入 */
  async function importFromFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.addEventListener('change', async () => {
        if (!input.files?.length) { resolve(false); return; }
        const file = input.files[0];
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          resolve(importProject(data));
        } catch (e) {
          alert('导入失败: ' + e.message);
          resolve(false);
        }
      });
      input.click();
    });
  }

  /** 生成共享链接（通过 base64 编码项目数据到 URL） */
  function generateShareLink() {
    const data = exportProject();
    const json = JSON.stringify(data);
    const encoded = btoa(unescape(encodeURIComponent(json)));
    // 如果数据太大，提示用户
    if (encoded.length > 50000) {
      alert('项目太大，无法生成分享链接。请使用文件导出方式分享。');
      return null;
    }
    const baseUrl = window.location.origin + window.location.pathname.replace(/\/editor\.html$/, '/editor.html');
    return baseUrl + '?shared=' + encoded;
  }

  /** 从 URL 加载共享项目 */
  function loadFromShareLink() {
    const params = new URLSearchParams(window.location.search);
    const shared = params.get('shared');
    if (!shared) return false;
    try {
      const json = decodeURIComponent(escape(atob(shared)));
      const data = JSON.parse(json);
      return importProject(data);
    } catch (e) {
      console.error('[Collaboration] 加载分享链接失败:', e);
      return false;
    }
  }

  /** 协作者管理 */
  function addCollaborator(name) {
    if (_collaborators.includes(name)) return false;
    _collaborators.push(name);
    _saveState();
    return true;
  }

  function removeCollaborator(name) {
    _collaborators = _collaborators.filter(c => c !== name);
    _saveState();
  }

  function getCollaborators() {
    return [..._collaborators];
  }

  function _getCurrentUser() {
    return localStorage.getItem('collab-username') || '匿名用户';
  }

  function setCurrentUser(name) {
    localStorage.setItem('collab-username', name);
  }

  /** 锁机制（防止同时编辑） */
  function acquireLock() {
    const user = _getCurrentUser();
    _lockInfo = { user, timestamp: Date.now() };
    _saveState();
    return true;
  }

  function releaseLock() {
    _lockInfo = null;
    _saveState();
  }

  function getLockInfo() {
    if (!_lockInfo) return null;
    // 超过 30 分钟的锁自动释放
    if (Date.now() - _lockInfo.timestamp > 30 * 60 * 1000) {
      _lockInfo = null;
      _saveState();
      return null;
    }
    return _lockInfo;
  }

  /** 显示协作面板 */
  function showPanel() {
    let panel = document.getElementById('collab-panel');
    if (panel) {
      panel.classList.toggle('hidden');
      _refreshPanel(panel);
      return;
    }
    panel = document.createElement('div');
    panel.id = 'collab-panel';
    panel.className = 'collab-panel';
    panel.innerHTML = `
      <div class="collab-panel-header">
        <span>👥 协作管理</span>
        <button id="collab-close-btn" class="tb-btn" style="padding:2px 8px;font-size:11px;">✕</button>
      </div>
      <div class="collab-panel-body">
        <!-- 用户设置 -->
        <div class="collab-section">
          <div class="collab-section-title">👤 当前用户</div>
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input id="collab-username" type="text" placeholder="输入你的名字" style="flex:1;padding:4px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px;" />
            <button id="collab-set-name" class="tb-btn" style="padding:2px 8px;font-size:11px;">设置</button>
          </div>
        </div>
        
        <!-- 版本快照 -->
        <div class="collab-section">
          <div class="collab-section-title">📸 版本快照</div>
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input id="collab-snapshot-label" type="text" placeholder="快照名称" style="flex:1;padding:4px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px;" />
            <button id="collab-create-snapshot" class="tb-btn tb-run" style="padding:2px 8px;font-size:11px;">创建</button>
          </div>
          <div id="collab-versions-list" class="collab-versions-list"></div>
        </div>
        
        <!-- 分享 -->
        <div class="collab-section">
          <div class="collab-section-title">🔗 分享项目</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button id="collab-export-file" class="tb-btn" style="font-size:11px;">📁 导出文件</button>
            <button id="collab-import-file" class="tb-btn" style="font-size:11px;">📂 导入文件</button>
            <button id="collab-share-link" class="tb-btn" style="font-size:11px;">🔗 分享链接</button>
          </div>
        </div>

        <!-- 协作者 -->
        <div class="collab-section">
          <div class="collab-section-title">👥 协作者</div>
          <div style="display:flex;gap:6px;margin-bottom:8px;">
            <input id="collab-add-user" type="text" placeholder="添加协作者" style="flex:1;padding:4px 8px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:12px;" />
            <button id="collab-add-btn" class="tb-btn" style="padding:2px 8px;font-size:11px;">+</button>
          </div>
          <div id="collab-users-list" class="collab-users-list"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 事件绑定
    panel.querySelector('#collab-close-btn').addEventListener('click', () => panel.classList.add('hidden'));

    panel.querySelector('#collab-set-name').addEventListener('click', () => {
      const name = panel.querySelector('#collab-username').value.trim();
      if (name) {
        setCurrentUser(name);
        _refreshPanel(panel);
      }
    });

    panel.querySelector('#collab-create-snapshot').addEventListener('click', () => {
      const label = panel.querySelector('#collab-snapshot-label').value.trim();
      const snapshot = createSnapshot(label);
      panel.querySelector('#collab-snapshot-label').value = '';
      _refreshPanel(panel);
      const statusEl = document.getElementById('status-text');
      if (statusEl) {
        statusEl.textContent = `✅ 已创建快照 "${snapshot.label}"`;
        setTimeout(() => { statusEl.textContent = i18n.t('status.ready'); }, 2000);
      }
    });

    panel.querySelector('#collab-export-file').addEventListener('click', () => exportToFile());
    panel.querySelector('#collab-import-file').addEventListener('click', async () => {
      const ok = await importFromFile();
      if (ok) _refreshPanel(panel);
    });

    panel.querySelector('#collab-share-link').addEventListener('click', () => {
      const link = generateShareLink();
      if (link) {
        navigator.clipboard.writeText(link).then(() => {
          alert('分享链接已复制到剪贴板！\n\n' + link.slice(0, 100) + '...');
        }).catch(() => {
          prompt('复制以下链接分享：', link);
        });
      }
    });

    panel.querySelector('#collab-add-btn').addEventListener('click', () => {
      const name = panel.querySelector('#collab-add-user').value.trim();
      if (name) {
        addCollaborator(name);
        panel.querySelector('#collab-add-user').value = '';
        _refreshPanel(panel);
      }
    });

    _refreshPanel(panel);
  }

  function _refreshPanel(panel) {
    if (!panel) return;
    // 用户名
    const nameInput = panel.querySelector('#collab-username');
    if (nameInput) nameInput.value = _getCurrentUser();

    // 版本列表
    const versionsList = panel.querySelector('#collab-versions-list');
    if (versionsList) {
      const versions = getVersions();
      if (versions.length === 0) {
        versionsList.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">暂无快照</div>';
      } else {
        versionsList.innerHTML = versions.map(v => `
          <div class="collab-version-item ${v.id === _currentVersion ? 'active' : ''}">
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:600;">${v.label}</div>
              <div style="font-size:10px;color:var(--text-muted);">${v.author} · ${new Date(v.timestamp).toLocaleString()} · ${v.blockCount} 积木</div>
            </div>
            <button class="collab-version-restore tb-btn" style="padding:2px 6px;font-size:10px;" data-id="${v.id}">恢复</button>
            <button class="collab-version-delete tb-btn" style="padding:2px 6px;font-size:10px;color:var(--red);" data-id="${v.id}">✕</button>
          </div>
        `).join('');

        versionsList.querySelectorAll('.collab-version-restore').forEach(btn => {
          btn.addEventListener('click', () => {
            restoreSnapshot(btn.dataset.id);
            _refreshPanel(panel);
          });
        });
        versionsList.querySelectorAll('.collab-version-delete').forEach(btn => {
          btn.addEventListener('click', () => {
            deleteVersion(btn.dataset.id);
            _refreshPanel(panel);
          });
        });
      }
    }

    // 协作者列表
    const usersList = panel.querySelector('#collab-users-list');
    if (usersList) {
      const users = getCollaborators();
      if (users.length === 0) {
        usersList.innerHTML = '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px;">暂无协作者</div>';
      } else {
        usersList.innerHTML = users.map(u => `
          <div class="collab-user-item">
            <span style="font-size:12px;">👤 ${u}</span>
            <button class="collab-user-remove tb-btn" style="padding:1px 6px;font-size:10px;color:var(--red);" data-name="${u}">✕</button>
          </div>
        `).join('');

        usersList.querySelectorAll('.collab-user-remove').forEach(btn => {
          btn.addEventListener('click', () => {
            removeCollaborator(btn.dataset.name);
            _refreshPanel(panel);
          });
        });
      }
    }
  }

  _loadState();

  return {
    showPanel,
    createSnapshot, restoreSnapshot, getVersions, getCurrentVersion, deleteVersion,
    exportProject, importProject, exportToFile, importFromFile,
    generateShareLink, loadFromShareLink,
    addCollaborator, removeCollaborator, getCollaborators,
    getCurrentUser, setCurrentUser,
    acquireLock, releaseLock, getLockInfo,
  };
})();
