/**
 * 编辑器窗口入口 - 初始化编辑器模块，绑定 UI 事件
 */
(function () {
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

    if (!CommunityAPI.getUser()) {
      if (confirm(i18n.isEnglish()
        ? 'You need to login first. Go to login page?'
        : '需要先登录才能发布。跳转到登录页？')) {
        window.open('../community/login.html', '_blank');
      }
      return;
    }

    const projectName = EditorState.projectName || '未命名项目';
    const description = prompt(i18n.isEnglish()
      ? 'Enter a description for your project:'
      : '为你的作品写一段描述：', '');
    if (description === null) return; // 取消

    document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Publishing to community...' : '正在发布到社区...';

    try {
      // 先保存到 VFS
      await ProjectManager.saveProject();

      // 收集项目文件并生成 ZIP
      const projectPath = EditorState.projectPath.replace(/\\/g, '/').replace(/\/+$/, '');
      const vfsPrefix = 'vfs:';
      const vfsbPrefix = 'vfsb:';
      const projectPrefix = projectPath + '/';
      const zip = new JSZip();
      let mainJsonData = null;

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

        // 记录 main.json 用于在线预览
        if (relativePath === 'main.json' && !isBinary) {
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

      // 生成 ZIP Blob
      const zipBlob = new Blob([await zip.generateAsync({ type: 'uint8array' })], { type: 'application/zip' });

      // 上传到社区
      const result = await CommunityAPI.publishProject({
        title: projectName,
        description: description,
        json_data: mainJsonData,
        is_public: true
      }, zipBlob);

      if (result.error) {
        alert((i18n.isEnglish() ? 'Publish failed: ' : '发布失败: ') + (result.error.message || result.error));
        document.getElementById('status-text').textContent = i18n.t('status.ready');
        return;
      }

      document.getElementById('status-text').textContent =
        i18n.isEnglish() ? 'Published to community!' : '已发布到社区！';
      setTimeout(() => {
        document.getElementById('status-text').textContent = i18n.t('status.ready');
      }, 3000);

      // 询问是否查看
      if (confirm(i18n.isEnglish()
        ? 'Published! View in community?'
        : '发布成功！是否在社区中查看？')) {
        const projectId = result.data?.id || result.data?.[0]?.id;
        if (projectId) {
          window.open('../community/project-detail.html?id=' + projectId, '_blank');
        } else {
          window.open('../community/projects.html', '_blank');
        }
      }

    } catch (e) {
      console.error('[publish] 发布失败:', e);
      alert((i18n.isEnglish() ? 'Publish failed: ' : '发布失败: ') + e.message);
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 全局错误捕获（帮助定位问题）
    window.addEventListener('error', (e) => {
      console.error('[全局错误]', e.message, e.filename, e.lineno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('[未处理的Promise拒绝]', e.reason);
    });

    // 应用 i18n 到 DOM
    i18n.applyToDOM();

    try {
    // 初始化各模块
    console.log('[初始化] EditorCanvas...');
    EditorCanvas.init();
    console.log('[初始化] Palette...');
    Palette.init();
    console.log('[初始化] StageCanvas...');
    StageCanvas.init();
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

    // 获取 URL 参数中的项目路径和模式
    const params = new URLSearchParams(window.location.search);
    const projectPath = params.get('path');
    const projectMode = params.get('mode') || 'normal';

    if (projectPath) {
      loadProject(projectPath, projectMode);
    }

    // 工具栏事件
    document.getElementById('btn-home').addEventListener('click', () => {
      // Web 版：导航回主页
      window.location.href = 'index.html';
    });
    document.getElementById('btn-save').addEventListener('click', () => ProjectManager.saveProject());

    // 保存到本地（ZIP）
    document.getElementById('btn-save-local')?.addEventListener('click', saveProjectToLocal);

    // 发布到社区
    document.getElementById('btn-publish-community')?.addEventListener('click', publishToCommunity);

    // 项目重命名：点击项目名或重命名按钮
    document.getElementById('btn-rename')?.addEventListener('click', () => ProjectManager.renameProject());
    document.getElementById('project-name')?.addEventListener('click', () => ProjectManager.renameProject());

    document.getElementById('btn-run').addEventListener('click', () => {
      Executor.clearOutput();
      document.getElementById('output-log').textContent = '';
      Executor.run();
    });
    document.getElementById('btn-stop').addEventListener('click', () => {
      Executor.stop();
      SoundManager.stopAll();  // 停止时也停止所有声音
    });

    // 扩展加载按钮
    document.getElementById('btn-load-ext').addEventListener('click', loadExtensionDialog);

    // 扩展文档按钮
    document.getElementById('btn-ext-docs').addEventListener('click', () => {
      window.api.openExtensionDocs();
    });

    // 查看代码按钮
    document.getElementById('btn-view-code')?.addEventListener('click', showAllCodeDialog);

    // 导出 HTML 按钮
    document.getElementById('btn-export-html')?.addEventListener('click', () => {
      HtmlExporter.exportProject();
    });

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
      StageManager.addSprite((i18n.isEnglish() ? 'Sprite' : '精灵') + (StageManager.getSprites().length + 1));
    });
    document.getElementById('btn-upload-costume').addEventListener('click', uploadCostumeDialog);
    document.getElementById('btn-set-costume').addEventListener('click', setCostumeDialog);
    document.getElementById('btn-clear-costume').addEventListener('click', clearCostume);

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); ProjectManager.saveProject(); }
    });

    // 监听主进程发来的加载新项目事件
    if (window.api && window.api.onLoadProject) {
      window.api.onLoadProject((path, mode) => {
        loadProject(path, mode);
      });
    }
  });

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
    if (scriptsStr) {
      EditorState.blocks = Serializer.deserialize(scriptsStr);
    } else {
      EditorState.blocks = {};
    }

    // 恢复精灵数据（含贴图加载）
    if (config.sprites && Array.isArray(config.sprites) && config.sprites.length > 0) {
      StageManager.restoreSprites(config.sprites, folder);
    }

    document.getElementById('status-text').textContent = i18n.t('status.loaded', null).replace('{name}', EditorState.projectName);

    // 扩展模式：显示文件标签页
    if (EditorState.projectMode === 'extension') {
      document.getElementById('stage-panel').classList.add('extension-mode');
      const fileTab = document.querySelector('.stage-tab[data-tab="files"]');
      if (fileTab) fileTab.classList.remove('hidden');
      FileEditor.refreshFileList();
    }

    // 加载声音
    await loadProjectSounds();

    // 更新积木计数
    const count = Object.keys(EditorState.blocks).length;
    document.getElementById('block-count').textContent = i18n.t('editor.blockCount', null).replace('{n}', count);
    } catch(e) {
      console.error('[项目加载失败]', e);
      document.getElementById('status-text').textContent = i18n.t('status.loadFailed', null).replace('{error}', e.message);
    }
  }
})();
