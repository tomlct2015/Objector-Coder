/**
 * 编辑器窗口入口 - 初始化编辑器模块，绑定 UI 事件
 */
window.EditorApp = (function () {
  /**
   * Mobile detection and landscape orientation handling
   */
  function initMobileDetection() {
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || ('ontouchstart' in window && navigator.maxTouchPoints > 1);

    if (!isMobile) return;

    document.body.classList.add('is-mobile');

    function checkOrientation() {
      var isPortrait = window.innerHeight > window.innerWidth;
      document.body.classList.toggle('is-mobile-portrait', isPortrait);
    }

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', function() {
      setTimeout(checkOrientation, 100);
    });

    // Try to lock orientation via Screen Orientation API
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(function() {});
    }
  }

  // Run mobile detection immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileDetection);
  } else {
    initMobileDetection();
  }

  /**
   * 自定义 Prompt 对话框（替代 Electron 中禁用的 window.prompt）
   * @param {string} message - 提示文本
   * @param {string} defaultValue - 默认值
   * @returns {Promise<string|null>} 用户输入或 null（取消）
   */
  window.showCustomPrompt = function(message, defaultValue) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('custom-prompt');
      const title = document.getElementById('custom-prompt-title');
      const input = document.getElementById('custom-prompt-input');
      const okBtn = document.getElementById('custom-prompt-ok');
      const cancelBtn = document.getElementById('custom-prompt-cancel');
      if (!overlay || !title || !input || !okBtn || !cancelBtn) {
        resolve(null);
        return;
      }
      title.textContent = message || i18n.t('dialog.prompt');
      input.value = defaultValue || '';
      overlay.classList.remove('hidden');
      setTimeout(() => { input.focus(); input.select(); }, 50);

      function cleanup() {
        overlay.classList.add('hidden');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        input.onkeydown = null;
        overlay.onclick = null;
      }
      okBtn.onclick = () => { cleanup(); resolve(input.value); };
      cancelBtn.onclick = () => { cleanup(); resolve(null); };
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); cleanup(); resolve(input.value); }
        else if (e.key === 'Escape') { e.preventDefault(); cleanup(); resolve(null); }
      };
      overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); resolve(null); } };
    });
  };

  function switchTab(tab) {
    document.querySelectorAll('.stage-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.stage-tab[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById('stage-content').classList.toggle('hidden', tab !== 'stage');
    document.getElementById('output-content').classList.toggle('hidden', tab !== 'output');
    document.getElementById('sprites-content').classList.toggle('hidden', tab !== 'sprites');
    document.getElementById('files-content').classList.toggle('hidden', tab !== 'files');
    document.getElementById('debug-content').classList.toggle('hidden', tab !== 'debug');
    if (tab === 'debug') DevMode.refreshWatchPanel();
  }
  window.switchTab = switchTab;

  /** 加载扩展文件（通过文件对话框）并保存到项目 extensions 目录 */
  async function loadExtensionDialog() {
    const filePath = await window.api.selectExtensionFile();
    if (!filePath) return;

    const result = await ExtensionManager.loadFromFile(filePath);
    if (result.ok) {
      // 保存到项目 extensions 目录
      if (EditorState.projectPath && result.id) {
        const extDir = EditorState.projectPath + '/extensions';
        await window.api.ensureDir(extDir);
        const ext = filePath.endsWith('.js') ? '.js' : '.json';
        const content = await window.api.readFile(filePath);
        if (content) {
          await window.api.writeFile(extDir + '/' + result.id + ext, content);
          console.log(`扩展已保存到 extensions/${result.id}${ext}`);
        }
      }
      Palette.init();
      document.getElementById('status-text').textContent = i18n.t('status.extLoaded');
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    } else {
      alert(i18n.t('status.extFailed'));
    }
  }

  /** 加载项目目录下的扩展 */
  async function loadProjectExtensions() {
    if (!EditorState.projectPath) return;
    const count = await ExtensionManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      Palette.init();
      console.log(`已加载 ${count} 个扩展`);
    }
  }

  /** 加载项目目录下的声音 */
  async function loadProjectSounds() {
    if (!EditorState.projectPath) return;
    const count = await SoundManager.loadFromProject(EditorState.projectPath);
    if (count > 0) {
      console.log(`已加载 ${count} 个声音`);
      document.getElementById('status-text').textContent = i18n.t('status.soundsLoaded', null).replace('{n}', count);
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    }
  }

  /** 上传图片到项目造型库 */
  async function uploadCostumeDialog() {
    const filePath = await window.api.selectImageFile();
    if (!filePath) return;

    const name = await CostumeManager.uploadCostume(filePath);
    if (name) {
      document.getElementById('status-text').textContent = i18n.t('status.costumeUploaded', null).replace('{name}', name);
      refreshCostumeLibrary();
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 2000);
    } else {
      alert(i18n.t('status.uploadFailed'));
    }
  }

  /** 更换当前精灵的贴图（从造型库选择） */
  async function setCostumeDialog() {
    const names = CostumeManager.getAllNames();
    if (names.length === 0) {
      alert(i18n.t('dialog.emptyCostumeLib'));
      return;
    }

    // 显示造型选择对话框
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width:500px;width:90%;text-align:left;">
        <h2 style="text-align:center;">${i18n.t('dialog.selectCostume')}</h2>
        <div id="costume-picker" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:8px;max-height:400px;overflow:auto;padding:8px;">
          ${names.map(n => `
            <div class="costume-item" data-name="${n}" style="cursor:pointer;text-align:center;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg-tertiary);">
              <img src="file://${CostumeManager.getFilePath(n)}" style="width:48px;height:48px;object-fit:contain;display:block;margin:0 auto;">
              <span style="font-size:10px;color:var(--text-muted);display:block;margin-top:4px;word-break:break-all;">${n}</span>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button id="costume-cancel" class="tb-btn">${i18n.t('dialog.cancel')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#costume-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });

    overlay.querySelectorAll('.costume-item').forEach(item => {
      item.addEventListener('click', () => {
        const name = item.dataset.name;
        const idx = StageManager.getActiveSpriteIdx();
        const ok = StageManager.setSpriteCostumeByName(idx, name);
        if (ok) {
          const sprite = StageManager.getActiveSprite();
          document.getElementById('status-text').textContent = i18n.t('status.costumeApplied', null).replace('{name}', sprite.name);
        }
        document.body.removeChild(overlay);
        setTimeout(() => {
          document.getElementById('status-text').textContent = i18n.t('status.ready');
        }, 2000);
      });
    });
  }

  /** 刷新造型库显示（在角色面板中） */
  function refreshCostumeLibrary() {
    const container = document.getElementById('costume-library');
    if (!container) return;

    const names = CostumeManager.getAllNames();
    if (names.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:8px;">' + i18n.t('sprites.emptyCostume') + '</div>';
      return;
    }

    container.innerHTML = '';
    names.forEach(name => {
      const div = document.createElement('div');
      div.className = 'costume-thumb';
      div.innerHTML = `
        <img src="file://${CostumeManager.getFilePath(name)}" style="width:32px;height:32px;object-fit:contain;">
        <span style="font-size:9px;color:var(--text-muted);display:block;word-break:break-all;">${name}</span>
      `;
      div.title = name;
      // 单击：应用到当前精灵
      div.addEventListener('click', () => {
        const idx = StageManager.getActiveSpriteIdx();
        StageManager.setSpriteCostumeByName(idx, name);
        document.getElementById('status-text').textContent = i18n.t('status.costumeApplied', null).replace('{name}', name);
        setTimeout(() => { document.getElementById('status-text').textContent = i18n.t('status.ready'); }, 1500);
      });
      // 右键：删除造型
      div.addEventListener('contextmenu', async (e) => {
        e.preventDefault();
        if (confirm(i18n.t('dialog.confirmDeleteCostume', null).replace('{name}', name))) {
          await CostumeManager.deleteCostume(name);
          refreshCostumeLibrary();
        }
      });
      container.appendChild(div);
    });
  }
  window.refreshCostumeLibrary = refreshCostumeLibrary;

  /** 清除当前精灵的贴图 */
  function clearCostume() {
    const idx = StageManager.getActiveSpriteIdx();
    StageManager.clearSpriteCostume(idx);
    document.getElementById('status-text').textContent = i18n.t('status.costumeCleared');
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 2000);
  }

  /** 显示项目所有代码文件 */
  async function showAllCodeDialog() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    const files = await window.api.readDirRecursive(EditorState.projectPath);
    if (!files || files.length === 0) {
      alert(i18n.t('status.projectEmpty'));
      return;
    }

    // 过滤文本类文件
    const textFiles = files.filter(f => /\.(json|js|ts|txt|md|html|css|xml|csv)$/i.test(f.path));

    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog-box" style="max-width:800px;width:90%;max-height:85vh;text-align:left;display:flex;flex-direction:column;">
        <h2 style="text-align:center;">${i18n.t('dialog.codeViewer', null).replace('{n}', textFiles.length)}</h2>
        <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap;">
          ${textFiles.map((f, i) => `<button class="tb-btn code-file-tab${i === 0 ? ' active' : ''}" data-idx="${i}" style="font-size:11px;padding:3px 8px;">${f.path}</button>`).join('')}
        </div>
        <div style="flex:1;overflow:auto;background:var(--bg-primary);border-radius:6px;border:1px solid var(--border);">
          <pre id="code-viewer" style="padding:12px;font-family:'Cascadia Code','Consolas',monospace;font-size:12px;color:var(--text-primary);white-space:pre-wrap;word-break:break-all;line-height:1.6;margin:0;"></pre>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
          <button id="code-copy" class="tb-btn">${i18n.t('dialog.copyFile')}</button>
          <button id="code-close" class="tb-btn">${i18n.t('dialog.close')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const viewer = overlay.querySelector('#code-viewer');
    let currentIdx = 0;

    function showFile(idx) {
      currentIdx = idx;
      const f = textFiles[idx];
      viewer.textContent = `// 📄 ${f.path}\n${'='.repeat(60)}\n\n${f.content}`;
      overlay.querySelectorAll('.code-file-tab').forEach((btn, i) => {
        btn.classList.toggle('active', i === idx);
      });
    }

    showFile(0);

    overlay.querySelectorAll('.code-file-tab').forEach(btn => {
      btn.addEventListener('click', () => showFile(Number(btn.dataset.idx)));
    });

    overlay.querySelector('#code-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(textFiles[currentIdx].content).then(() => {
        overlay.querySelector('#code-copy').textContent = i18n.t('dialog.copied');
        setTimeout(() => { overlay.querySelector('#code-copy').textContent = i18n.t('dialog.copyFile'); }, 1500);
      });
    });

    overlay.querySelector('#code-close').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) document.body.removeChild(overlay); });
  }

  /** 保存项目到本地 ZIP（使用 File System Access API + JSZip） */
  async function saveProjectToLocal() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    // 检查浏览器支持
    if (!window.showDirectoryPicker) {
      alert(i18n.isEnglish()
        ? 'Your browser does not support File System Access API. Please use Chrome/Edge.'
        : '您的浏览器不支持 File System Access API，请使用 Chrome 或 Edge。');
      return;
    }

    const projectName = EditorState.projectName || 'project';
    document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Saving to local...' : '正在保存到本地...';

    try {
      // 先保存到 VFS
      await ProjectManager.saveProject();
      EditorState._isDirty = false;
      EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);

      // 选择保存文件夹
      const dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });

      // 收集当前项目的所有文件
      const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const vfsPrefix = 'vfs:';
      const vfsbPrefix = 'vfsb:';
      const projectPrefix = projectPath + '/';
      const zip = new JSZip();

      // 遍历 localStorage 收集项目文件
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        let filePath = null;
        let isBinary = false;

        if (key.startsWith(vfsPrefix) && !key.endsWith('/__dir__')) {
          filePath = key.slice(vfsPrefix.length);
        } else if (key.startsWith(vfsbPrefix)) {
          filePath = key.slice(vfsbPrefix.length);
          isBinary = true;
        }

        if (!filePath || !filePath.startsWith(projectPrefix)) continue;

        const relativePath = filePath.slice(projectPrefix.length);
        const content = localStorage.getItem(key);
        if (!content) continue;

        if (isBinary) {
          // base64 data URL 转二进制
          try {
            const base64Data = content.split(',')[1];
            if (base64Data) {
              zip.file(relativePath, base64Data, { base64: true });
            }
          } catch (e) {
            console.warn('[saveToLocal] 无法解码二进制文件:', relativePath, e);
          }
        } else {
          zip.file(relativePath, content);
        }
      }

      // 生成 ZIP Blob
      const zipBlob = await zip.generateAsync({ type: 'uint8array' });

      // 在选择的文件夹中创建 ZIP 文件
      const zipFileName = projectName + '.zip';
      const fileHandle = await dirHandle.getFileHandle(zipFileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(zipBlob);
      await writable.close();

      document.getElementById('status-text').textContent =
        (i18n.isEnglish() ? 'Saved to local: ' : '已保存到本地: ') + zipFileName;
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 3000);

    } catch (e) {
      if (e.name === 'AbortError') {
        // 用户取消了文件夹选择
        document.getElementById('status-text').textContent = i18n.t('status.ready');
        return;
      }
      console.error('[saveToLocal] 保存失败:', e);
      alert((i18n.isEnglish() ? 'Save to local failed: ' : '保存到本地失败: ') + e.message);
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }
  }

  /** 显示发布弹窗（美观替代 prompt） */
  function showPublishDialog(projectName, options, onConfirm, onCancel) {
    options = options || {};
    const overlay = document.createElement('div');
    overlay.className = 'publish-dialog-overlay';
    const isEN = i18n.isEnglish();
    const isExt = options.isExtension;
    const existingProject = options.existingProject;
    const existingExtension = options.existingExtension;

    // 已发布警告 (项目)
    let existingProjectHtml = '';
    if (existingProject) {
      var warnTitle = isEN ? 'This project has been published before' : '该作品曾经发布过';
      var warnDesc = existingProject.description ? CommunityAPI.escapeHtml(existingProject.description).slice(0, 60) : (isEN ? 'No description' : '无描述');
      var updateLabel = isEN ? 'Update existing (overwrite)' : '更新已有作品\uff08覆盖\uff09';
      var copyLabel = isEN ? 'Create a new copy' : '创建新副本';
      existingProjectHtml =
        '<div class="publish-warning">' +
          '<span class="publish-warning-icon">⚠️</span>' +
          '<div>' +
            '<div class="publish-warning-title">' + warnTitle + '</div>' +
            '<div class="publish-warning-desc">「' + CommunityAPI.escapeHtml(existingProject.title) + '」 - ' + warnDesc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-choice">' +
          '<label class="publish-radio">' +
            '<input type="radio" name="project-action" value="update" checked />' +
            '<span>' + updateLabel + '</span>' +
          '</label>' +
          '<label class="publish-radio">' +
            '<input type="radio" name="project-action" value="copy" />' +
            '<span>' + copyLabel + '</span>' +
          '</label>' +
        '</div>';
    }

    // 已发布警告 (扩展)
    let existingExtHtml = '';
    if (existingExtension) {
      var extWarnTitle = isEN ? 'This extension has been published before' : '该扩展曾经发布过';
      var extWarnDesc = existingExtension.description ? CommunityAPI.escapeHtml(existingExtension.description).slice(0, 60) : (isEN ? 'No description' : '无描述');
      var extUpdateLabel = isEN ? 'Update existing extension' : '更新已有扩展\uff08覆盖\uff09';
      var extCopyLabel = isEN ? 'Create a new extension' : '创建新扩展';
      existingExtHtml =
        '<div class="publish-warning">' +
          '<span class="publish-warning-icon">⚠️</span>' +
          '<div>' +
            '<div class="publish-warning-title">' + extWarnTitle + '</div>' +
            '<div class="publish-warning-desc">「' + CommunityAPI.escapeHtml(existingExtension.name) + '」 v' + CommunityAPI.escapeHtml(existingExtension.version || '1.0.0') + ' - ' + extWarnDesc + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-choice">' +
          '<label class="publish-radio">' +
            '<input type="radio" name="ext-action" value="update" checked />' +
            '<span>' + extUpdateLabel + '</span>' +
          '</label>' +
          '<label class="publish-radio">' +
            '<input type="radio" name="ext-action" value="copy" />' +
            '<span>' + extCopyLabel + '</span>' +
          '</label>' +
        '</div>';
    }

    // 扩展项目发布方式选择
    let publishModeHtml = '';
    if (isExt) {
      var modeExtOnly = isEN ? 'Extension only' : '仅发布扩展';
      var modeBoth = isEN ? 'Extension + Project' : '发布扩展 + 作品';
      publishModeHtml =
        '<div class="publish-mode-section">' +
          '<label class="publish-mode-label">' + (isEN ? 'Publish Mode' : '发布方式') + '</label>' +
          '<div class="publish-choice">' +
            '<label class="publish-radio">' +
              '<input type="radio" name="publish-mode" value="ext_only" checked />' +
              '<span>' + modeExtOnly + '</span>' +
            '</label>' +
            '<label class="publish-radio">' +
              '<input type="radio" name="publish-mode" value="both" />' +
              '<span>' + modeBoth + '</span>' +
            '</label>' +
          '</div>' +
        '</div>';
    }

    // 版本号输入 (仅扩展项目显示)
    let versionHtml = '';
    if (isExt) {
      versionHtml =
        '<div class="publish-field publish-field-version">' +
          '<label>' + (isEN ? 'Version' : '版本号') + '</label>' +
          '<input type="text" id="publish-version" value="1.0.0" maxlength="20" />' +
        '</div>';
    }

    overlay.innerHTML =
      '<div class="publish-dialog">' +
        '<div class="publish-dialog-header">' +
          '<h3>\ud83d\ude80 ' + (isEN ? 'Publish to Community' : '发布到社区') + '</h3>' +
          '<button class="publish-close" type="button">&times;</button>' +
        '</div>' +
        '<div class="publish-dialog-body">' +
          publishModeHtml +
          existingExtHtml +
          existingProjectHtml +
          '<div class="publish-field">' +
            '<label>' + (isEN ? 'Title' : '作品标题') + '</label>' +
            '<input type="text" id="publish-title" value="' + CommunityAPI.escapeHtml(projectName) + '" maxlength="100" />' +
          '</div>' +
          versionHtml +
          '<div class="publish-field">' +
            '<label>' + (isEN ? 'Description' : '作品描述') + '</label>' +
            '<textarea id="publish-desc" rows="4" placeholder="' + (isEN ? 'Describe your project...' : '为你的作品写一段描述...') + '"></textarea>' +
            '<div class="publish-char-count"><span id="desc-count">0</span>/500</div>' +
          '</div>' +
        '</div>' +
        '<div class="publish-dialog-footer">' +
          '<button class="publish-btn publish-btn-cancel" type="button">' + (isEN ? 'Cancel' : '取消') + '</button>' +
          '<button class="publish-btn publish-btn-confirm" type="button">' + (isEN ? 'Publish' : '发布') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // 字符计数
    const descEl = overlay.querySelector('#publish-desc');
    const countEl = overlay.querySelector('#desc-count');
    descEl.addEventListener('input', () => { countEl.textContent = descEl.value.length; });

    // 关闭
    function close() {
      overlay.remove();
      if (onCancel) onCancel();
    }
    overlay.querySelector('.publish-close').addEventListener('click', close);
    overlay.querySelector('.publish-btn-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // 确认
    overlay.querySelector('.publish-btn-confirm').addEventListener('click', () => {
      const title = overlay.querySelector('#publish-title').value.trim();
      const desc = descEl.value.trim();
      if (!title) {
        overlay.querySelector('#publish-title').style.borderColor = 'var(--red, #f38ba8)';
        return;
      }
      let version = '1.0.0';
      if (isExt) {
        version = overlay.querySelector('#publish-version').value.trim() || '1.0.0';
      }
      // 发布模式
      let publishMode = 'project';
      if (isExt) {
        const modeRadios = overlay.querySelectorAll('input[name="publish-mode"]');
        modeRadios.forEach(r => { if (r.checked) publishMode = r.value; });
      }
      // 项目 action
      let projectAction = 'create';
      if (existingProject) {
        overlay.querySelectorAll('input[name="project-action"]').forEach(r => { if (r.checked) projectAction = r.value; });
      }
      // 扩展 action
      let extAction = 'create';
      if (existingExtension) {
        overlay.querySelectorAll('input[name="ext-action"]').forEach(r => { if (r.checked) extAction = r.value; });
      }
      overlay.remove();
      onConfirm({
        title, description: desc, version,
        publishMode,
        projectAction, projectExistingId: existingProject ? existingProject.id : null,
        extAction, extExistingId: existingExtension ? existingExtension.id : null,
        extId: options.extId || null,
      });
    });
  }

  /** 发布项目到社区 */
  async function publishToCommunity() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    if (typeof CommunityAPI === 'undefined') {
      alert(i18n.isEnglish()
        ? 'Community module not loaded. Please check your network connection.'
        : '社区模块未加载，请检查网络连接。');
      return;
    }

    CommunityAPI.init();
    if (!CommunityAPI.isConfigured()) {
      alert(i18n.isEnglish()
        ? 'Community is not configured yet. Please set up Supabase first.'
        : '社区尚未配置，请先设置 Supabase。');
      return;
    }

    // 恢复登录状态
    await CommunityAPI.restoreSession();

    if (!CommunityAPI.getUser()) {
      alert(i18n.isEnglish()
        ? 'Please login from the home page before publishing.'
        : '请先回到主页登录，然后再发布。');
      return;
    }

    const projectName = EditorState.projectName || '未命名项目';
    const isExtension = EditorState.projectMode === 'extension';

    // 检测是否已发布过同名作品
    let existingProject = null;
    let existingExtension = null;
    let extId = null;
    try {
      existingProject = await CommunityAPI.getUserProjectByTitle(CommunityAPI.getUser().id, projectName);
    } catch (e) {
      console.warn('[publish] 检查已有作品失败:', e);
    }

    // 如果是扩展项目，收集扩展文件并检测已有扩展
    let extensionFileContent = null;
    if (isExtension) {
      const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const vfsPrefix = 'vfs:';
      const extDir = projectPath + '/extensions/';

      // 收集扩展目录下的文件
      let extFiles = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key.startsWith(vfsPrefix)) continue;
        const filePath = key.slice(vfsPrefix.length);
        if (filePath.startsWith(extDir) && !filePath.endsWith('/__dir__')) {
          const fileName = filePath.slice(extDir.length);
          const content = localStorage.getItem(key);
          if (content) {
            extFiles.push({ name: fileName, content: content });
          }
        }
      }

      // 取第一个扩展文件作为主要内容
      if (extFiles.length > 0) {
        // 尝试解析 JSON 提取 extId 和 version
        try {
          const parsed = JSON.parse(extFiles[0].content);
          extId = parsed.id || parsed.ext_id || projectName.replace(/\s+/g, '_').toLowerCase();
        } catch (e) {
          extId = projectName.replace(/\s+/g, '_').toLowerCase();
        }
        extensionFileContent = extFiles[0].content;
      }

      // 检测已有扩展
      if (extId) {
        try {
          existingExtension = await CommunityAPI.getUserExtensionByName(CommunityAPI.getUser().id, projectName);
        } catch (e) {
          console.warn('[publish] 检查已有扩展失败:', e);
        }
      }
    }

    // 显示发布弹窗
    showPublishDialog(projectName, {
      isExtension,
      existingProject,
      existingExtension,
      extId,
    }, async (formData) => {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Publishing to community...' : '正在发布到社区...';

      try {
        // 先保存到 VFS
        await ProjectManager.saveProject();
        EditorState._isDirty = false;
        EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);

        let projectId = null;
        let extResultId = null;

        // ===== 发布扩展 =====
        if (isExtension && (formData.publishMode === 'ext_only' || formData.publishMode === 'both')) {
          // 重新收集扩展文件（发布时可能已修改）
          let currentExtFileContent = extensionFileContent;
          if (!currentExtFileContent) {
            const pp = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
            const vfsPfx = 'vfs:';
            const eDir = pp + '/extensions/';
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k.startsWith(vfsPfx)) continue;
              const fp = k.slice(vfsPfx.length);
              if (fp.startsWith(eDir) && !fp.endsWith('/__dir__')) {
                const c = localStorage.getItem(k);
                if (c) { currentExtFileContent = c; break; }
              }
            }
          }

          if (!currentExtFileContent) {
            const noFileMsg = i18n.isEnglish()
              ? 'No extension files found in extensions/ directory. Please create and save at least one .json or .js file.'
              : '未找到扩展文件。请在 extensions/ 目录下新建并保存至少一个 .json 或 .js 文件。';
            alert(noFileMsg);
            document.getElementById('status-text').textContent = i18n.t('status.ready');
            return;
          }

          let extResult;
          if (formData.extAction === 'update' && formData.extExistingId) {
            extResult = await CommunityAPI.updateExtension(formData.extExistingId, {
              name: formData.title,
              description: formData.description,
              version: formData.version,
            }, currentExtFileContent);
            extResultId = formData.extExistingId;
          } else {
            extResult = await CommunityAPI.publishExtension(
              formData.title,
              formData.extId || projectName.replace(/\s+/g, '_').toLowerCase(),
              formData.description,
              formData.version,
              currentExtFileContent
            );
            extResultId = extResult.data?.id;
          }

          if (extResult.error) {
            const extErrMsg = (i18n.isEnglish() ? 'Extension publish failed: ' : '扩展发布失败: ') + (extResult.error.message || extResult.error);
            if (formData.publishMode === 'ext_only') {
              alert(extErrMsg);
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            } else {
              console.warn('[publish]', extErrMsg);
            }
          }
        }

        // ===== 发布作品 =====
        if (!isExtension || formData.publishMode === 'both') {
          // 收集项目文件并生成 ZIP
          const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
          const vfsPrefix = 'vfs:';
          const vfsbPrefix = 'vfsb:';
          const projectPrefix = projectPath + '/';
          const zip = new JSZip();
          let mainJsonData = null;
          let projectRenderMode = '2d';

          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            let filePath = null;
            let isBinary = false;

            if (key.startsWith(vfsPrefix) && !key.endsWith('/__dir__')) {
              filePath = key.slice(vfsPrefix.length);
            } else if (key.startsWith(vfsbPrefix)) {
              filePath = key.slice(vfsbPrefix.length);
              isBinary = true;
            }

            if (!filePath || !filePath.startsWith(projectPrefix)) continue;

            const relativePath = filePath.slice(projectPrefix.length);
            const content = localStorage.getItem(key);
            if (!content) continue;

            if ((relativePath === 'main.json' || relativePath === 'scripts/main.json') && !isBinary) {
              mainJsonData = content;
            }

            if (isBinary) {
              try {
                const base64Data = content.split(',')[1];
                if (base64Data) zip.file(relativePath, base64Data, { base64: true });
              } catch (e) {
                console.warn('[publish] 无法解码二进制文件:', relativePath, e);
              }
            } else {
              zip.file(relativePath, content);
            }
          }

          // 读取 project.json 获取渲染模式
          try {
            const cfgStr = localStorage.getItem('vfs:' + projectPath + '/project.json');
            if (cfgStr) {
              const cfg = JSON.parse(cfgStr);
              if (cfg.renderMode) projectRenderMode = cfg.renderMode;
            }
          } catch(e) {}

          const zipBlob = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' });

          if (formData.projectAction === 'update' && formData.projectExistingId) {
            const projResult = await CommunityAPI.updateProject(formData.projectExistingId, {
              title: formData.title,
              description: formData.description,
              json_data: mainJsonData,
              render_mode: projectRenderMode,
            }, zipBlob);
            projectId = formData.projectExistingId;
            if (projResult.error) {
              alert((i18n.isEnglish() ? 'Project publish failed: ' : '作品发布失败: ') + (projResult.error.message || projResult.error));
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            }
          } else {
            const projResult = await CommunityAPI.publishProject({
              title: formData.title,
              description: formData.description,
              json_data: mainJsonData,
              render_mode: projectRenderMode,
              is_public: true
            }, zipBlob);
            projectId = projResult.data?.id || projResult.data?.[0]?.id;
            if (projResult.error) {
              alert((i18n.isEnglish() ? 'Project publish failed: ' : '作品发布失败: ') + (projResult.error.message || projResult.error));
              document.getElementById('status-text').textContent = i18n.t('status.ready');
              return;
            }
          }
        }

        // 成功
        const isEN = i18n.isEnglish();
        let successMsg;
        if (isExtension && formData.publishMode === 'ext_only') {
          successMsg = isEN ? 'Extension published!' : '扩展已发布！';
        } else if (isExtension && formData.publishMode === 'both') {
          successMsg = isEN ? 'Extension & project published!' : '扩展与作品已发布！';
        } else {
          successMsg = isEN ? 'Published to community!' : '已发布到社区！';
        }

        document.getElementById('status-text').textContent = successMsg;
        setTimeout(() => {
          document.getElementById('status-text').textContent = i18n.t('status.ready');
        }, 3000);

        // 查看
        let viewUrl = null;
        if (projectId) {
          viewUrl = '../community/project-detail.html?id=' + projectId;
        } else if (extResultId) {
          viewUrl = '../community/extension-detail.html?id=' + extResultId;
        }

        if (viewUrl && confirm((isEN ? 'Published! View in community?' : '发布成功！是否在社区中查看？'))) {
          window.open(viewUrl, '_blank');
        }

      } catch (e) {
        console.error('[publish] 发布失败:', e);
        alert((i18n.isEnglish() ? 'Publish failed: ' : '发布失败: ') + e.message);
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }
    });
  }

  // ============================================================
  // 高级模式 (Godot-style) 初始化
  // ============================================================
  let _codeMirrorInstance = null;
  let _spriteScripts = {}; // index -> JS code
  let _nodeScripts = {};   // nodeId -> JS code（非 Sprite2D 节点的脚本）
  let _advancedInitialized = false;

  function initAdvancedMode() {
    if (_advancedInitialized) return;
    _advancedInitialized = true;

    const mainLayout = document.getElementById('main-layout');
    const advancedLayout = document.getElementById('advanced-layout');
    if (!mainLayout || !advancedLayout) return;

    // 切换布局
    mainLayout.classList.add('hidden');
    advancedLayout.classList.remove('hidden');

    // 移动画布到高级布局
    const stageCanvas = document.getElementById('stage-canvas');
    const editorCanvas = document.getElementById('editor-canvas');
    const viewport = document.getElementById('viewport');
    const blocksContent = document.getElementById('script-blocks-content');
    const palettePanel = document.getElementById('palette-panel');
    const editorPanel = document.getElementById('editor-panel');

    if (stageCanvas && viewport) viewport.appendChild(stageCanvas);
    // 将积木面板和编辑器面板移入脚本区域
    if (palettePanel && blocksContent) blocksContent.appendChild(palettePanel);
    if (editorPanel && blocksContent) blocksContent.appendChild(editorPanel);

    // 初始化 SceneGraph（场景图核心）
    const renderMode = (typeof EditorState !== 'undefined' && EditorState.renderMode) || '2d';
    if (typeof SceneGraph !== 'undefined') {
      SceneGraph.init(renderMode);
      // 同步到 StageManager
      if (typeof StageManager !== 'undefined') {
        StageManager.syncFromSceneGraph();
      }
    }

    // 初始化场景树、检查器和文件系统
    if (typeof SceneTree !== 'undefined') SceneTree.init();
    if (typeof Inspector !== 'undefined') Inspector.init();
    if (typeof FileSystemDock !== 'undefined') FileSystemDock.init();

    // 初始化 CodeMirror
    const jsEditorEl = document.getElementById('js-editor');
    if (jsEditorEl && typeof CodeMirror !== 'undefined') {
      _codeMirrorInstance = CodeMirror(jsEditorEl, {
        mode: 'javascript',
        theme: 'material-darker',
        lineNumbers: true,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        value: '// 在此编写 JavaScript 代码\n// 可用对象：sprite（当前角色）、globalVars（全局变量）\n// 示例：\n// sprite.x = 100;\n// sprite.say("Hello!");\n',
      });
      // 实时保存代码：精灵节点用 index，其他节点用 nodeId
      _codeMirrorInstance.on('change', () => {
        const selId = (typeof SceneGraph !== 'undefined') ? SceneGraph.getSelectedId() : null;
        const selIdx = (typeof SceneTree !== 'undefined') ? SceneTree.getSelectedIndex() : -1;
        const node = selId ? SceneGraph.getNode(selId) : null;
        const isSprite = node && node.type === 'Sprite2D';

        if (isSprite && selIdx >= 0) {
          _spriteScripts[selIdx] = _codeMirrorInstance.getValue();
        } else if (selId) {
          _nodeScripts[selId] = _codeMirrorInstance.getValue();
        }
      });
    }

    // 脚本 tab 切换
    const scriptTabs = document.querySelectorAll('.script-tab');
    scriptTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        scriptTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById('script-blocks-content').classList.toggle('hidden', tabName !== 'blocks');
        document.getElementById('script-js-content').classList.toggle('hidden', tabName !== 'js');
        if (tabName === 'js' && _codeMirrorInstance) {
          _codeMirrorInstance.refresh();
        }
      });
    });

    // 3D 和 UI 场景仅支持 JS 脚本，隐藏积木 tab
    if (typeof SceneGraph !== 'undefined' && SceneGraph.isJsOnly && SceneGraph.isJsOnly()) {
      const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
      const jsTab = document.querySelector('.script-tab[data-tab="js"]');
      if (blocksTab) blocksTab.classList.add('hidden');
      if (jsTab) jsTab.click();
    }

    // ⧉ 新窗口编辑代码（支持任意节点类型）
    const popoutBtn = document.getElementById('btn-popout-js');
    if (popoutBtn && window.api && window.api.openJsEditor) {
      popoutBtn.addEventListener('click', () => {
        // 获取当前选中节点
        const selId = (typeof SceneGraph !== 'undefined') ? SceneGraph.getSelectedId() : null;
        const selIdx = (typeof SceneTree !== 'undefined') ? SceneTree.getSelectedIndex() : -1;

        if (!selId) {
          alert('请先在场景树中选择一个节点');
          return;
        }

        const node = (typeof SceneGraph !== 'undefined') ? SceneGraph.getNode(selId) : null;
        const isSprite = node && node.type === 'Sprite2D';
        const name = node ? node.name : '脚本';

        // 先保存当前编辑器内容
        if (_codeMirrorInstance) {
          // 精灵节点用 spriteIdx，其他节点用 nodeId
          if (isSprite && selIdx >= 0) {
            EditorApp.setSpriteScript(selIdx, _codeMirrorInstance.getValue());
          } else {
            _nodeScripts[selId] = _codeMirrorInstance.getValue();
          }
        }

        // 获取代码：优先用节点 ID 存储，回退到精灵索引
        let code;
        if (_nodeScripts[selId] !== undefined) {
          code = _nodeScripts[selId];
        } else if (isSprite && selIdx >= 0) {
          code = _spriteScripts[selIdx] || '// 在此编写 JavaScript 代码\n';
        } else {
          code = '// 在此编写 JavaScript 代码\n';
        }

        // 传递 nodeId 和 spriteIdx 用于回调识别
        window.api.openJsEditor({
          spriteIdx: selId,  // 用节点 ID 作为标识
          name: name + '.js',
          code: code
        });
      });

      // 监听外部窗口保存的代码
      window.api.onJsEditorCodeUpdated((nodeId, code) => {
        // 判断是精灵节点还是其他节点
        const node = (typeof SceneGraph !== 'undefined') ? SceneGraph.getNode(nodeId) : null;
        const isSprite = node && node.type === 'Sprite2D';
        const selIdx = (typeof SceneTree !== 'undefined') ? SceneTree.getSelectedIndex() : -1;

        if (isSprite && selIdx >= 0) {
          _spriteScripts[selIdx] = code;
        } else {
          _nodeScripts[nodeId] = code;
        }

        // 如果当前正在编辑这个节点，同步到内嵌编辑器
        const curSelId = (typeof SceneGraph !== 'undefined') ? SceneGraph.getSelectedId() : null;
        if (curSelId === nodeId && _codeMirrorInstance) {
          const cursor = _codeMirrorInstance.getCursor();
          _codeMirrorInstance.setValue(code);
          _codeMirrorInstance.setCursor(cursor);
        }

        const nodeName = node ? node.name : nodeId;
        document.getElementById('status-text').textContent = '已保存代码: ' + nodeName;
        console.log('[JS Editor] 外部窗口保存代码:', nodeName);
      });
    }

    // ==================== 编辑器全屏功能 ====================
    let _fsPanel = null;  // 当前全屏的面板
    let _fsExitBtn = null;

    function enterFullscreen(panel) {
      if (_fsPanel) exitFullscreen();
      panel.classList.add('panel-fullscreen');
      // 保持 tab 栏可见，让用户自由切换积木/JS 模式
      // 添加退出按钮
      _fsExitBtn = document.createElement('button');
      _fsExitBtn.className = 'fullscreen-exit';
      _fsExitBtn.textContent = '✕ 退出全屏 (Esc)';
      _fsExitBtn.addEventListener('click', exitFullscreen);
      panel.appendChild(_fsExitBtn);
      _fsPanel = panel;
      // 刷新当前内容区域
      _refreshContent();
    }

    function exitFullscreen() {
      if (!_fsPanel) return;
      _fsPanel.classList.remove('panel-fullscreen');
      if (_fsExitBtn) { _fsExitBtn.remove(); _fsExitBtn = null; }
      _fsPanel = null;
      _refreshContent();
    }

    function _refreshContent() {
      if (typeof EditorCanvas !== 'undefined' && EditorCanvas.resize) {
        setTimeout(() => EditorCanvas.resize(), 50);
      }
      if (_codeMirrorInstance) setTimeout(() => _codeMirrorInstance.refresh(), 50);
    }

    // 单一全屏按钮
    document.getElementById('btn-fs-editor')?.addEventListener('click', () => {
      if (_fsPanel) {
        exitFullscreen();
      } else {
        const panel = document.getElementById('script-editor-panel');
        if (panel) enterFullscreen(panel);
      }
    });

    // Esc 退出全屏 / F11 切换全屏
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _fsPanel) {
        e.preventDefault();
        exitFullscreen();
      }
      if (e.key === 'F11') {
        e.preventDefault();
        const panel = document.getElementById('script-editor-panel');
        if (_fsPanel) {
          exitFullscreen();
        } else if (panel) {
          enterFullscreen(panel);
        }
      }
    });

    // 窗口 resize 时刷新内容
    window.addEventListener('resize', () => {
      if (_fsPanel) _refreshContent();
    });

    // 分割条拖拽调整高度
    const divider = document.getElementById('center-divider');
    const scriptPanel = document.getElementById('script-editor-panel');
    if (divider && scriptPanel) {
      let dragging = false;
      divider.addEventListener('mousedown', (e) => {
        dragging = true;
        e.preventDefault();
      });
      document.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const center = document.getElementById('advanced-center');
        if (!center) return;
        const rect = center.getBoundingClientRect();
        const newHeight = rect.bottom - e.clientY;
        scriptPanel.style.height = Math.max(120, Math.min(newHeight, rect.height - 200)) + 'px';
        if (_codeMirrorInstance) _codeMirrorInstance.refresh();
      });
      document.addEventListener('mouseup', () => { dragging = false; });
    }

    // 自动选中第一个节点
    setTimeout(() => {
      if (typeof SceneGraph !== 'undefined' && typeof Inspector !== 'undefined') {
        const root = SceneGraph.getRoot();
        if (root && root.children && root.children.length > 0) {
          SceneTree.selectNode(root.children[0]);
        } else if (root) {
          Inspector.showNode(root.id);
        }
      }
    }, 100);

    // 注册 JS 脚本回调（在 event_start 积木执行完后、事件循环开始前执行）
    if (typeof Executor !== 'undefined' && Executor.setPostStartCallback) {
      Executor.setPostStartCallback(async () => {
        await runAdvancedScripts();
      });
    }

    console.log('[高级模式] Godot 式编辑器已初始化');
  }

  /** 初始化数据分析模式 */
  function initDataMode() {
    if (typeof DataAnalysis !== 'undefined') {
      DataAnalysis.init();
    }
    console.log('[数据分析模式] 已初始化');
  }

  /** 获取当前精灵的 JS 脚本 */
  function getSpriteScript(index) {
    return _spriteScripts[index] || '';
  }

  /** 设置当前精灵的 JS 脚本 */
  function setSpriteScript(index, code) {
    _spriteScripts[index] = code;
  }

  /** 获取所有精灵脚本（用于保存） */
  function getAllSpriteScripts() {
    return { ..._spriteScripts };
  }

  /** 批量设置精灵脚本（用于加载） */
  function setAllSpriteScripts(scripts) {
    _spriteScripts = scripts || {};
  }

  /** 获取 CodeMirror 实例 */
  function getJsEditor() {
    return _codeMirrorInstance;
  }

  /** 获取节点的 JS 脚本（非 Sprite2D 节点） */
  function getNodeScript(nodeId) {
    return _nodeScripts[nodeId] || '';
  }

  /** 设置节点的 JS 脚本（非 Sprite2D 节点） */
  function setNodeScript(nodeId, code) {
    _nodeScripts[nodeId] = code;
  }

  document.addEventListener('DOMContentLoaded', async () => {
    // 全局错误捕获（帮助定位问题）
    window.addEventListener('error', (e) => {
      console.error('[全局错误]', e.message, e.filename, e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[未处理的Promise拒绝]', e.reason);
    });

    // 应用 i18n 到 DOM
    i18n.applyToDOM();

    // 获取 URL 参数中的渲染模式
    const params = new URLSearchParams(window.location.search);
    const renderMode = params.get('render') || '2d';

    try {
    // 初始化各模块
    console.log('[初始化] EditorCanvas...');
    EditorCanvas.init();
    console.log('[初始化] Palette...');
    Palette.init();

    // 根据渲染模式初始化舞台
    if (renderMode === '3d' && typeof Stage3D !== 'undefined') {
      console.log('[初始化] Stage3D (3D 模式)...');
      const stageCanvas = document.getElementById('stage-canvas');
      const success = Stage3D.init(stageCanvas);
      if (!success) {
        console.warn('[Stage3D] 初始化失败，回退到 2D 模式');
        StageCanvas.init();
      }
    } else {
      console.log('[初始化] StageCanvas (2D 模式)...');
      StageCanvas.init();
    }

    console.log('[初始化] StageManager...');
    StageManager.init();
    console.log('[初始化] FileEditor...');
    FileEditor.init();
    console.log('[初始化] DevMode...');
    DevMode.init();
    console.log('[初始化] 所有模块初始化完成');
    } catch(e) {
      console.error('[初始化失败]', e);
    }

    // 初始化侦测输入追踪（绑定到舞台画布）
    const stageCanvas = document.getElementById('stage-canvas');
    if (stageCanvas) {
      SensingInput.init(stageCanvas);
    }

    // 初始化扩展计时器
    window.__extTimerStart = Date.now();

    // 获取项目路径和模式：优先从 IPC 获取（避免 file:// URL 中文编码问题），回退到 URL 参数
    let initData = null;
    try {
      if (window.api && window.api.getEditorInit) {
        initData = await window.api.getEditorInit();
      }
    } catch(e) {}
    const projectPath = (initData && initData.path) || params.get('path');
    const projectMode = (initData && initData.mode) || params.get('mode') || 'normal';

    // 高级模式初始化
    if (projectMode === 'advanced') {
      initAdvancedMode();
    }

    // 数据分析模式初始化
    if (projectMode === 'data') {
      initDataMode();
    }

    if (projectPath) {
      loadProject(projectPath, projectMode);
    }

    // 社区作品在线预览：通过项目 ID 从社区 API 加载
    const previewId = params.get('preview');
    if (previewId) {
      loadProjectFromCommunity(previewId);
    }

    // ==================== 菜单栏交互 ====================
    const _actionHome = () => {
      if (EditorState._isDirty) {
        const msg = i18n.isEnglish() ? 'You have unsaved changes. Leave anyway?' : '您有未保存的更改，确定要离开吗？';
        if (!confirm(msg)) return;
      }
      EditorState._isDirty = false;
      window.location.href = 'index.html';
    };
    const _actionSave = async () => {
      await ProjectManager.saveProject();
      EditorState._isDirty = false;
      EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks);
    };

    const _actionRun = async () => {
      Executor.clearOutput();
      document.getElementById('output-log').textContent = '';
      // JS 脚本已通过 Executor.setPostStartCallback 注册，
      // 会在 event_start 积木完成后、事件循环开始前自动执行
      await Executor.run();
    };
    const _actionStop = () => {
      Executor.stop();
      SoundManager.stopAll();
    };
    const _actionForceStop = () => {
      Executor.forceStop();
      SoundManager.stopAll();
    };
    const _actionExportHtml = async () => {
      try {
        if (typeof HtmlExporter === 'undefined') { alert('HtmlExporter 未加载！'); return; }
        await HtmlExporter.exportProject();
      } catch(e) { alert('导出失败: ' + e.message); }
    };

    const menuActions = {
      'home': _actionHome,
      'save': _actionSave,
      'save-local': () => saveProjectToLocal(),
      'export-html': _actionExportHtml,
      'publish': () => publishToCommunity(),
      'run': _actionRun,
      'stop': _actionStop,
      'force-stop': _actionForceStop,
      'load-ext': () => loadExtensionDialog(),
      'ext-docs': () => window.api && window.api.openExtensionDocs(),
      'view-code': () => showAllCodeDialog(),
      'blocks-guide': () => window.open('https://tomlct2015.github.io/Objector-Coder/blocks-guide/', '_blank'),
      'advanced-guide': () => window.open('https://tomlct2015.github.io/Objector-Coder/how-to-use-advanced-editor/', '_blank'),
    };

    // 菜单栏下拉交互
    const menubar = document.getElementById('menubar');
    if (menubar) {
      let openMenu = null;
      const closeAllMenus = () => {
        menubar.querySelectorAll('.menu-item.open').forEach(m => m.classList.remove('open'));
        openMenu = null;
      };
      menubar.querySelectorAll('.menu-item').forEach(mi => {
        mi.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpen = mi.classList.contains('open');
          closeAllMenus();
          if (!wasOpen) { mi.classList.add('open'); openMenu = mi; }
        });
        mi.addEventListener('mouseenter', () => {
          if (openMenu && openMenu !== mi) {
            closeAllMenus();
            mi.classList.add('open');
            openMenu = mi;
          }
        });
      });
      document.addEventListener('click', closeAllMenus);
      menubar.querySelectorAll('.menu-dropdown-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.dataset.action;
          closeAllMenus();
          if (action && menuActions[action]) menuActions[action]();
        });
      });
    }

    // 工具栏运行/停止按钮
    document.getElementById('btn-run')?.addEventListener('click', _actionRun);
    document.getElementById('btn-stop')?.addEventListener('click', _actionStop);

    // 社区用户信息显示
    const communityUserInfo = document.getElementById('community-user-info');

    function refreshCommunityUI() {
      if (typeof CommunityAPI === 'undefined') return;
      const user = CommunityAPI.getUser();
      const profile = CommunityAPI.getProfile();
      if (user && communityUserInfo) {
        communityUserInfo.textContent = '👤 ' + (profile?.username || user.email);
        communityUserInfo.classList.remove('hidden');
      } else if (communityUserInfo) {
        communityUserInfo.classList.add('hidden');
      }
    }

    // 初始化社区 API 并恢复登录状态
    if (typeof CommunityAPI !== 'undefined') {
      CommunityAPI.init();
      CommunityAPI.restoreSession().then(() => refreshCommunityUI());
    }

    // 项目重命名
    document.getElementById('btn-rename')?.addEventListener('click', () => ProjectManager.renameProject());
    document.getElementById('project-name')?.addEventListener('click', () => ProjectManager.renameProject());

    // 窗口控制按钮
    document.getElementById('win-minimize')?.addEventListener('click', () => window.api.windowMinimize());
    document.getElementById('win-maximize')?.addEventListener('click', () => window.api.windowMaximize());
    document.getElementById('win-close')?.addEventListener('click', () => window.api.windowClose());

    // 调试按钮
    document.getElementById('btn-debug-continue')?.addEventListener('click', () => DevMode.continueExecution());
    document.getElementById('btn-debug-step')?.addEventListener('click', () => DevMode.stepExecution());
    document.getElementById('btn-debug-stop')?.addEventListener('click', () => DevMode.stopDebug());

    // 舞台标签切换
    document.querySelectorAll('.stage-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // 精灵面板按钮
    document.getElementById('btn-add-sprite').addEventListener('click', () => {
      const s = StageManager.addSprite((i18n.isEnglish() ? 'Sprite' : '精灵') + (StageManager.getSprites().length + 1));
      const idx = StageManager.getSprites().indexOf(s);
      if (idx >= 0) StageManager.setActiveSprite(idx);
    });
    document.getElementById('btn-upload-costume').addEventListener('click', uploadCostumeDialog);
    document.getElementById('btn-set-costume').addEventListener('click', setCostumeDialog);
    document.getElementById('btn-clear-costume').addEventListener('click', clearCostume);

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        _actionSave();
      } else if (e.key === 'F5' && !e.shiftKey) {
        e.preventDefault();
        _actionRun();
      } else if (e.key === 'F5' && e.shiftKey) {
        e.preventDefault();
        _actionStop();
      } else if (e.ctrlKey && e.shiftKey && (e.key === 'Q' || e.key === 'q')) {
        e.preventDefault();
        _actionForceStop();
      }
    });

    // 定期更新积木计数（切换精灵时自动反映）+ 未保存状态检测
    EditorState._isDirty = false;
    EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks || {});
    setInterval(() => {
      const count = Object.keys(EditorState.blocks || {}).length;
      const sprite = StageManager.getActiveSprite();
      const spriteName = sprite ? sprite.name : '';
      document.getElementById('block-count').textContent =
        (i18n.isEnglish() ? spriteName + ': ' : spriteName + '：') + count + (i18n.isEnglish() ? ' blocks' : ' 个积木');
      // 检测积木数据变化，标记未保存状态
      const snapshot = JSON.stringify(EditorState.blocks || {});
      if (snapshot !== EditorState._blocksSnapshot) {
        EditorState._isDirty = true;
      }
    }, 500);

    // 网页端未保存退出弹窗（刷新页面 / 关闭标签页 / 跳转外链）
    window.addEventListener('beforeunload', (e) => {
      if (EditorState._isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });

    // 监听主进程发来的加载新项目事件
    if (window.api && window.api.onLoadProject) {
      window.api.onLoadProject((path, mode, renderMode) => {
        // 重新加载页面以应用新的 renderMode
        if (renderMode) {
          const url = new URL(window.location.href);
          url.searchParams.set('path', path);
          url.searchParams.set('mode', mode || 'normal');
          url.searchParams.set('render', renderMode);
          window.location.href = url.toString();
        } else {
          loadProject(path, mode);
        }
      });
    }
  });

  // ============================================================
  // 渲染模式热切换：从 2D 切换到 3D（用于社区预览）
  // ============================================================
  function switchTo3D() {
    if (typeof Stage3D === 'undefined') return false;
    // 停止 2D 渲染循环
    StageCanvas.stop();
    // 替换 canvas 元素（2D context 无法转为 WebGL）
    var oldCanvas = document.getElementById('stage-canvas');
    if (!oldCanvas) return false;
    var newCanvas = document.createElement('canvas');
    newCanvas.id = 'stage-canvas';
    newCanvas.width = 480;
    newCanvas.height = 360;
    oldCanvas.parentNode.replaceChild(newCanvas, oldCanvas);
    // 初始化 3D 舞台
    var success = Stage3D.init(newCanvas);
    if (success) {
      // 重新绑定侦测输入
      if (typeof SensingInput !== 'undefined') SensingInput.init(newCanvas);
      console.log('[switchTo3D] 已切换到 3D 模式');
    } else {
      console.warn('[switchTo3D] Stage3D 初始化失败');
    }
    return success;
  }

  // ============================================================
  // 社区作品在线预览：从社区 API 获取项目并加载到编辑器
  // ============================================================
  async function loadProjectFromCommunity(projectId) {
    try {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Loading preview...' : '正在加载预览...';

      // 初始化社区 API
      if (typeof CommunityAPI === 'undefined') {
        throw new Error(i18n.isEnglish() ? 'Community module not loaded' : '社区模块未加载');
      }
      CommunityAPI.init();

      // 获取项目数据
      const res = await CommunityAPI.getProjectById(projectId);
      if (res.error || !res.data) {
        throw new Error(i18n.isEnglish() ? 'Project not found' : '作品不存在');
      }

      const project = res.data;
      const previewPath = 'vfs:community-preview/' + project.title;

      // 优先使用 ZIP 文件（包含完整项目结构、精灵、造型等）
      if (project.zip_url) {
        try {
          const resp = await fetch(project.zip_url);
          if (resp.ok) {
            const blob = await resp.blob();
            const zip = await JSZip.loadAsync(blob);

            // 二进制文件扩展名 → MIME 类型映射
            const BINARY_EXTS = {
              '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg',
              '.gif':'image/gif', '.bmp':'image/bmp', '.webp':'image/webp', '.svg':'image/svg+xml',
              '.wav':'audio/wav', '.mp3':'audio/mpeg', '.ogg':'audio/ogg'
            };
            function _mimeForName(fname) {
              const dot = fname.lastIndexOf('.');
              if (dot < 0) return null;
              return BINARY_EXTS[fname.slice(dot).toLowerCase()] || null;
            }

            // 将 ZIP 内容写入 VFS
            let _assetWarnCount = 0;
            for (const [relativePath, file] of Object.entries(zip.files)) {
              if (file.dir) continue;
              const fullPath = previewPath + '/' + relativePath;
              const mime = _mimeForName(file.name);
              if (mime) {
                // 二进制文件：用正确的 MIME 类型 data URL 存储
                try {
                  const base64 = await file.async('base64');
                  localStorage.setItem('vfsb:' + fullPath, 'data:' + mime + ';base64,' + base64);
                } catch (storeErr) {
                  _assetWarnCount++;
                  console.warn('[preview] 存储失败（可能超出容量）:', relativePath, storeErr.message);
                }
              } else {
                // 文本文件
                const text = await file.async('text');
                await window.api.writeFile(fullPath, text);
              }
            }
            if (_assetWarnCount > 0) {
              const msg = (i18n.isEnglish()
                ? 'Warning: {n} asset(s) failed to store (localStorage may be full). Try clearing browser storage.'
                : '警告：{n} 个素材存储失败（localStorage 可能已满），请尝试清除浏览器存储。').replace('{n}', _assetWarnCount);
              document.getElementById('status-text').textContent = msg;
            }

            // 更新目录索引
            const dirs = new Set();
            for (const [relativePath] of Object.entries(zip.files)) {
              const parts = relativePath.split('/');
              let dirPath = previewPath;
              for (let i = 0; i < parts.length - 1; i++) {
                dirPath += '/' + parts[i];
                dirs.add(dirPath);
              }
            }
            for (const dir of dirs) {
              const dirKey = 'vfs:' + dir + '/__dir__';
              if (!localStorage.getItem(dirKey)) {
                localStorage.setItem(dirKey, '1');
              }
            }

            // 读取 project.json 检查渲染模式，如需切换到 3D
            try {
              const cfgStr = await window.api.readFile(previewPath + '/project.json');
              if (cfgStr) {
                const cfg = JSON.parse(cfgStr);
                if (cfg.renderMode === '3d') {
                  switchTo3D();
                }
              }
            } catch(e) { /* ignore */ }

            document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview loaded: ' : '预览已加载: ') + project.title;
            await loadProject(previewPath, project.mode || 'normal');
            return;
          }
        } catch (zipErr) {
          console.warn('[preview] ZIP 加载失败，回退到 json_data:', zipErr.message);
        }
      }

      // 回退方案：使用 json_data（仅包含积木数据）
      if (project.json_data) {
        // 创建最小化的 project.json
        const config = {
          name: project.title || 'Preview',
          mode: project.mode || 'normal',
          renderMode: project.render_mode || '2d',
          sprites: []
        };
        // 如需 3D 模式，先切换舞台
        if (config.renderMode === '3d') {
          switchTo3D();
        }
        await window.api.writeFile(previewPath + '/project.json', JSON.stringify(config, null, 2));
        // 写入积木数据
        await window.api.writeFile(previewPath + '/scripts/main.json', project.json_data);

        document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview loaded (blocks only): ' : '预览已加载(仅积木): ') + project.title;
        await loadProject(previewPath, 'normal');
        return;
      }

      throw new Error(i18n.isEnglish() ? 'No preview data available' : '无可预览的数据');

    } catch (e) {
      console.error('[preview] 加载失败:', e);
      document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Preview failed: ' : '预览加载失败: ') + e.message;
      alert((i18n.isEnglish() ? 'Preview failed: ' : '在线预览失败: ') + e.message);
    }
  }

  async function loadProject(folder, mode) {
    try {
    const configStr = await window.api.readFile(folder + '/project.json');
    if (!configStr) return;

    const config = JSON.parse(configStr);
    EditorState.projectPath = folder;
    EditorState.projectName = config.name || i18n.t('app.unnamed');
    EditorState.projectMode = config.mode || mode || 'normal';
    document.getElementById('project-name').textContent = EditorState.projectName;

    // 初始化造型管理器（从项目 assets 目录加载）
    try {
      await CostumeManager.init(folder);
      refreshCostumeLibrary();
    } catch(e) {
      console.warn('[造型管理器] 初始化失败:', e.message);
    }

    // 先加载扩展（注册积木定义），再反序列化积木，防止幽灵块
    await loadProjectExtensions();

    const scriptsStr = await window.api.readFile(folder + '/scripts/main.json');
    let mainBlocks = {};
    if (scriptsStr) {
      mainBlocks = Serializer.deserialize(scriptsStr);
    }

    // 恢复精灵数据（含贴图加载和积木恢复）
    if (config.sprites && Array.isArray(config.sprites) && config.sprites.length > 0) {
      StageManager.restoreSprites(config.sprites, folder);
      // 如果精灵没有自己的积木（旧项目），把 main.json 的积木分配给第一个精灵
      const sprites = StageManager.getSprites();
      const hasBlocks = sprites.some(s => s.blocks && Object.keys(s.blocks).length > 0);
      if (!hasBlocks && Object.keys(mainBlocks).length > 0) {
        // 旧项目：把所有积木分配给第一个精灵
        sprites[0].blocks = mainBlocks;
        EditorState.blocks = mainBlocks;
      }
    } else {
      // 无精灵数据，直接使用 main.json
      EditorState.blocks = mainBlocks;
    }

    document.getElementById('status-text').textContent = i18n.t('status.loaded', null).replace('{name}', EditorState.projectName);

    // 扩展模式：显示文件标签页
    if (EditorState.projectMode === 'extension') {
      document.getElementById('stage-panel').classList.add('extension-mode');
      const fileTab = document.querySelector('.stage-tab[data-tab="files"]');
      if (fileTab) fileTab.classList.remove('hidden');
      FileEditor.refreshFileList();
    }

    // 高级模式：激活 Godot 式布局并加载数据
    if (EditorState.projectMode === 'advanced') {
      initAdvancedMode();

      // 恢复 SceneGraph - 优先从场景文件加载，回退到 config.sceneGraph
      let sceneLoaded = false;
      const sceneFileRel = config.mainScene || 'scenes/main.scene.json';
      const _pj = window.api.pathJoin || ((...a) => a.join('/'));
      const sceneFilePath = await _pj(folder, sceneFileRel);
      const scenesDir = await _pj(folder, 'scenes');
      const mainScenePath = await _pj(scenesDir, 'main.scene.json');
      try {
        const sceneContent = await window.api.readFile(sceneFilePath);
        if (sceneContent && typeof SceneGraph !== 'undefined') {
          const sceneData = JSON.parse(sceneContent);
          if (sceneData.rootId || sceneData.nodes) {
            SceneGraph.fromJSON(sceneData);
            if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
            // 3D 场景：同步 Mesh3D 节点到 Three.js 渲染
            if (typeof Stage3D !== 'undefined' && Stage3D.isInitialized && Stage3D.isInitialized()) {
              Stage3D.syncMeshesFromSceneGraph();
            }
            sceneLoaded = true;
            console.log('[高级模式] 已从场景文件加载:', sceneFilePath);
          }
        }
      } catch (e) {
        console.warn('[高级模式] 场景文件不存在，回退到 project.json');
      }

      if (!sceneLoaded && config.sceneGraph && typeof SceneGraph !== 'undefined') {
        // 旧项目回退：从 config.sceneGraph 加载
        SceneGraph.fromJSON(config.sceneGraph);
        if (typeof StageManager !== 'undefined') StageManager.syncFromSceneGraph();
        // 3D 场景：同步 Mesh3D 节点到 Three.js 渲染
        if (typeof Stage3D !== 'undefined' && Stage3D.isInitialized && Stage3D.isInitialized()) {
          Stage3D.syncMeshesFromSceneGraph();
        }
        // 保存为场景文件（迁移到文件系统）
        try {
          await window.api.ensureDir(scenesDir);
          const sceneData = { name: 'main', ...SceneGraph.toJSON() };
          await window.api.writeFile(mainScenePath, JSON.stringify(sceneData, null, 2));
          console.log('[高级模式] 已迁移场景数据到 scenes/main.scene.json');
        } catch (e) {
          console.warn('[高级模式] 保存场景文件失败:', e);
        }
      }

      // 新项目：确保默认场景文件存在
      if (!sceneLoaded && !config.sceneGraph && typeof SceneGraph !== 'undefined') {
        try {
          await window.api.ensureDir(scenesDir);
          const sceneData = { name: 'main', ...SceneGraph.toJSON() };
          await window.api.writeFile(mainScenePath, JSON.stringify(sceneData, null, 2));
          console.log('[高级模式] 已创建默认场景文件');
        } catch (e) {
          console.warn('[高级模式] 创建默认场景文件失败:', e);
        }
      }

      // 恢复 JS 脚本
      if (config.jsScripts && typeof EditorApp !== 'undefined' && EditorApp.setAllSpriteScripts) {
        const scripts = {};
        Object.keys(config.jsScripts).forEach(k => {
          scripts[parseInt(k)] = config.jsScripts[k];
        });
        EditorApp.setAllSpriteScripts(scripts);
        if (EditorApp.getJsEditor()) {
          const firstScript = scripts[0] || '// 在此编写 JavaScript 代码\n';
          EditorApp.getJsEditor().setValue(firstScript);
        }
      }

      // 刷新场景树、检查器和文件系统
      if (typeof SceneTree !== 'undefined') SceneTree.refresh();
      if (typeof FileSystemDock !== 'undefined') FileSystemDock.refresh();
      if (typeof Inspector !== 'undefined') {
        const root = (typeof SceneGraph !== 'undefined') ? SceneGraph.getRoot() : null;
        if (root && root.children && root.children.length > 0) {
          Inspector.showNode(root.children[0]);
        } else if (root) {
          Inspector.showNode(root.id);
        }
      }

      // 3D 和 UI 场景仅支持 JS 脚本，隐藏积木 tab
      if (typeof SceneGraph !== 'undefined' && SceneGraph.isJsOnly && SceneGraph.isJsOnly()) {
        const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
        const jsTab = document.querySelector('.script-tab[data-tab="js"]');
        if (blocksTab) blocksTab.classList.add('hidden');
        if (jsTab && !jsTab.classList.contains('active')) jsTab.click();
      } else {
        const blocksTab = document.querySelector('.script-tab[data-tab="blocks"]');
        if (blocksTab) blocksTab.classList.remove('hidden');
      }
    }

    // 数据分析模式：初始化
    if (EditorState.projectMode === 'data') {
      initDataMode();
      // 尝试加载已保存的数据分析代码
      try {
        const codeStr = await window.api.readFile(folder + '/scripts/main.js');
        if (codeStr && typeof DataAnalysis !== 'undefined') {
          DataAnalysis.setCode(codeStr);
        }
      } catch(e) {}
    }

    // 加载声音
    await loadProjectSounds();

    // 更新积木计数
    const count = Object.keys(EditorState.blocks).length;
    document.getElementById('block-count').textContent = i18n.t('editor.blockCount', null).replace('{n}', count);

    // 项目加载完成后重置未保存状态
    EditorState._isDirty = false;
    EditorState._blocksSnapshot = JSON.stringify(EditorState.blocks || {});
    } catch(e) {
      console.error('[项目加载失败]', e);
      document.getElementById('status-text').textContent = i18n.t('status.loadFailed', null).replace('{error}', e.message);
    }
  }

  // ============================================================
  // 高级模式 JS 脚本执行
  // ============================================================

  /** 创建精灵 API 代理对象（将所有积木功能映射为方法） */
  function _createSpriteAPI(raw, idx) {
    const SM = (typeof StageManager !== 'undefined') ? StageManager : null;
    if (!SM) return raw;

    const proxy = Object.create(null);

    // 基础属性（getter/setter 直接读写原始精灵）
    Object.defineProperties(proxy, {
      name: { get() { return raw.name; }, set(v) { raw.name = v; if (typeof SceneTree !== 'undefined') SceneTree.refresh(); } },
      x: { get() { return raw.x; }, set(v) { raw.x = Number(v); } },
      y: { get() { return raw.y; }, set(v) { raw.y = Number(v); } },
      direction: { get() { return raw.direction; }, set(v) { raw.direction = Number(v); } },
      size: { get() { return raw.size; }, set(v) { raw.size = Number(v); } },
      visible: { get() { return raw.visible; }, set(v) { raw.visible = !!v; } },
      color: { get() { return raw.color; }, set(v) { raw.color = v; } },
      sayText: { get() { return raw.sayText; }, set(v) { raw.sayText = String(v); } },
      vx: { get() { return raw.vx || 0; }, set(v) { raw.vx = Number(v); } },
      vy: { get() { return raw.vy || 0; }, set(v) { raw.vy = Number(v); } },
      rotationStyle: { get() { return raw.rotationStyle; }, set(v) { raw.rotationStyle = v; } },
      _raw: { value: raw },
      _idx: { value: idx },
    });

    // === 外观 ===
    proxy.say = (text) => { SM.setSpriteSay(idx, String(text)); };
    proxy.sayFor = (text, sec) => { SM.setSpriteSay(idx, String(text)); setTimeout(() => SM.setSpriteSay(idx, ''), Number(sec) * 1000); };
    proxy.think = (text) => { SM.setSpriteSay(idx, '\u{1F4AD} ' + String(text)); };
    proxy.clearSay = () => { SM.setSpriteSay(idx, ''); };
    proxy.show = () => { raw.visible = true; };
    proxy.hide = () => { raw.visible = false; };
    proxy.setSize = (sz) => { SM.setSpriteSize(idx, Number(sz)); };
    proxy.changeSize = (n) => { SM.changeSpriteSize(idx, Number(n)); };
    proxy.nextCostume = async () => {
      if (typeof CostumeManager !== 'undefined') {
        const names = CostumeManager.getAllNames();
        if (names.length > 0) {
          const curName = raw.costumeName || '';
          const curIdx = names.indexOf(curName);
          await SM.setSpriteCostume(idx, names[(curIdx + 1) % names.length]);
        }
      }
    };
    proxy.setCostume = async (name) => { await SM.setSpriteCostume(idx, name); };
    proxy.setColor = (val) => { raw.colorEffect = Number(val); };
    proxy.clearEffects = () => { raw.colorEffect = 0; raw.size = 100; };

    // === 运动 ===
    proxy.move = (steps) => { SM.moveSprite(idx, Number(steps)); };
    proxy.turnRight = (deg) => { SM.rotateSprite(idx, Number(deg)); };
    proxy.turnLeft = (deg) => { SM.rotateSprite(idx, -Number(deg)); };
    proxy.pointInDirection = (deg) => { SM.setSpriteDir(idx, Number(deg)); };
    proxy.goTo = (x, y) => { SM.setSpritePos(idx, Number(x), Number(y)); };
    proxy.bounce = () => { SM.bounceSprite(idx); };
    proxy.clampToStage = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      raw.x = Math.max(-hw, Math.min(hw, raw.x));
      raw.y = Math.max(-hh, Math.min(hh, raw.y));
    };
    proxy.wrapAround = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      if (raw.x > hw) raw.x = -hw; else if (raw.x < -hw) raw.x = hw;
      if (raw.y > hh) raw.y = -hh; else if (raw.y < -hh) raw.y = hh;
    };
    proxy.goToRandomPosition = () => {
      const hw = SM.STAGE_W / 2, hh = SM.STAGE_H / 2;
      raw.x = Math.random() * hw * 2 - hw;
      raw.y = Math.random() * hh * 2 - hh;
    };

    // === 侦测 ===
    proxy.isTouchingEdge = () => SM.isTouchingEdge(idx);
    proxy.isTouchingSprite = (name) => {
      const all = SM.getSprites();
      const tIdx = all.findIndex(s => s.name === name);
      return tIdx >= 0 ? SM.isTouchingSprite(idx, tIdx) : false;
    };
    proxy.distanceTo = (name) => {
      const all = SM.getSprites();
      const t = all.find(s => s.name === name);
      return t ? SM.getDistanceToPoint(idx, t.x, t.y) : 0;
    };
    proxy.directionTo = (name) => {
      const all = SM.getSprites();
      const t = all.find(s => s.name === name);
      return t ? SM.getDirectionToPoint(idx, t.x, t.y) : 0;
    };
    proxy.distanceToMouse = () => {
      const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
      return SI ? SM.getDistanceToPoint(idx, SI.getMouseX(), SI.getMouseY()) : 0;
    };
    proxy.directionToMouse = () => {
      const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
      return SI ? SM.getDirectionToPoint(idx, SI.getMouseX(), SI.getMouseY()) : 0;
    };

    // === 高级运动 ===
    proxy.setVelocity = (vx, vy) => { SM.setVelocity(idx, vx, vy); };
    proxy.changeVelocity = (dvx, dvy) => { SM.changeVelocity(idx, dvx, dvy); };
    proxy.updateVelocity = () => { SM.updateVelocity(idx); };
    proxy.applyGravity = (g) => { SM.applyGravity(idx, g); };
    proxy.applyFriction = (f) => { SM.applyFriction(idx, f); };
    proxy.bounceEdgeVelocity = () => { SM.bounceEdgeVelocity(idx); };
    proxy.pointTowards = (tx, ty) => { SM.pointTowards(idx, tx, ty); };
    proxy.moveTowards = (tx, ty, steps) => { SM.moveTowards(idx, tx, ty, steps || 3); };

    // === 克隆 ===
    proxy.clone = () => SM.cloneSprite(idx);

    return proxy;
  }

  /** 创建全局 API 对象 */
  function _createGlobalAPI() {
    const SM = (typeof StageManager !== 'undefined') ? StageManager : null;
    const SI = (typeof SensingInput !== 'undefined') ? SensingInput : null;
    const SND = (typeof SoundManager !== 'undefined') ? SoundManager : null;

    return {
      get stageWidth() { return SM ? SM.STAGE_W : 480; },
      get stageHeight() { return SM ? SM.STAGE_H : 360; },
      getSprites: () => SM ? SM.getSprites() : [],
      getSpriteByName: (name) => SM ? SM.getSpriteByName(name) : null,
      getSpriteCount: () => SM ? SM.getSpriteCount() : 0,
      setActiveSprite: (idx) => SM && SM.setActiveSprite(idx),
      get mouseX() { return SI ? SI.getMouseX() : 0; },
      get mouseY() { return SI ? SI.getMouseY() : 0; },
      isMouseDown: () => SI ? SI.isMouseDown() : false,
      isKeyPressed: (key) => SI ? SI.isKeyPressed(key) : false,
      getVolume: () => SND ? SND.getVolume() : 0,
      setVolume: (v) => SND && SND.setVolume(v),
      random: (a, b) => Math.floor(Math.random() * (b - a + 1)) + a,
      randomFloat: () => Math.random(),
      randomRange: (a, b) => Math.random() * (b - a) + a,
      now: () => new Date(),
      timer: () => Date.now() / 1000,
    };
  }

  function runAdvancedScripts() {
    const sprites = (typeof StageManager !== 'undefined') ? StageManager.getSprites() : [];
    const globalVars = (typeof Executor !== 'undefined') ? Executor._getGlobalVars() : {};
    const selIdx = (typeof SceneTree !== 'undefined') ? SceneTree.getSelectedIndex() : -1;
    const editor = (typeof EditorApp !== 'undefined' && EditorApp.getJsEditor) ? EditorApp.getJsEditor() : null;
    const globalAPI = _createGlobalAPI();

    sprites.forEach((sprite, index) => {
      let code;
      if (editor && selIdx === index) {
        code = editor.getValue();
        _spriteScripts[index] = code;
      } else {
        code = _spriteScripts[index] || '';
      }
      if (!code || !code.trim() || /^\s*(\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/\s*)+$/.test(code)) return;

      try {
        const api = _createSpriteAPI(sprite, index);
        const logFn = (msg) => {
          const logEl = document.getElementById('output-log');
          if (logEl) logEl.textContent += '\n' + msg;
        };
        // 常用方法作为全局函数注入
        const fn = new Function('sprite', 'globalVars', 'log', 'stage',
          'say', 'sayFor', 'think', 'move', 'turnRight', 'turnLeft',
          'show', 'hide', 'setSize', 'changeSize',
          code
        );
        fn(
          api, globalVars, logFn, globalAPI,
          api.say.bind(api), api.sayFor.bind(api), api.think.bind(api),
          api.move.bind(api), api.turnRight.bind(api), api.turnLeft.bind(api),
          api.show.bind(api), api.hide.bind(api), api.setSize.bind(api), api.changeSize.bind(api)
        );
        if (typeof StageCanvas !== 'undefined') StageCanvas.render();
        if (typeof SceneTree !== 'undefined') SceneTree.refresh();
        if (typeof Inspector !== 'undefined') Inspector.refresh();
      } catch (e) {
        console.error(`[JS执行错误] 角色 ${sprite.name || index}:`, e);
        const logEl = document.getElementById('output-log');
        if (logEl) {
          logEl.textContent += `\n[JS错误] ${sprite.name || ('角色' + index)}: ${e.message}`;
        }
      }
    });
  }

  return {
    getJsEditor,
    getSpriteScript,
    setSpriteScript,
    getAllSpriteScripts,
    setAllSpriteScripts,
    getNodeScript,
    setNodeScript,
    initAdvancedMode,
    runAdvancedScripts,
  };
})();
