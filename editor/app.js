/**
 * 应用入口 - 主页逻辑（项目选择/新建）
 */
(function () {
  /** 获取固定项目列表 */
  function getPinnedProjects() {
    try { return JSON.parse(localStorage.getItem('pinned-projects') || '[]'); } catch { return []; }
  }

  /** 保存固定项目列表 */
  function savePinnedProjects(list) {
    localStorage.setItem('pinned-projects', JSON.stringify(list));
  }

  /** 固定/取消固定项目 */
  function togglePinProject(folderPath) {
    let pinned = getPinnedProjects();
    const idx = pinned.findIndex(p => p.path === folderPath);
    if (idx >= 0) {
      pinned.splice(idx, 1);
    } else {
      const recent = JSON.parse(localStorage.getItem('recent-projects') || '[]');
      const proj = recent.find(p => p.path === folderPath);
      if (proj) pinned.unshift({ ...proj });
    }
    savePinnedProjects(pinned);
    renderPinnedProjects();
    renderRecentProjects();
  }

  /** 渲染固定项目 */
  function renderPinnedProjects() {
    const container = document.getElementById('pinned-projects');
    const noPinned = document.getElementById('no-pinned');
    if (!container) return;

    const pinned = getPinnedProjects();
    container.innerHTML = '';

    if (pinned.length === 0) {
      noPinned?.classList.remove('hidden');
      return;
    }
    noPinned?.classList.add('hidden');

    pinned.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'recent-card pinned-card';
      card.innerHTML = `
        <div class="recent-card-name">📌 ${proj.name || i18n.t('app.unnamed')}</div>
        <div class="recent-card-path">${proj.path}</div>
        <div class="recent-card-time">${formatTime(proj.lastOpened)}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
          <span class="recent-card-mode">${proj.mode === 'extension' ? i18n.t('app.extension') : i18n.t('app.normal')}</span>
          <button class="pin-btn pinned" title="${i18n.t('app.unpin')}">✖</button>
        </div>
      `;
      card.querySelector('.pin-btn').onclick = (e) => { e.stopPropagation(); togglePinProject(proj.path); };
      card.onclick = () => openProject(proj.path);
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, proj, true); });
      container.appendChild(card);
    });
  }

  /** 渲染主页的最近项目列表 */
  function renderRecentProjects() {
    const container = document.getElementById('recent-projects');
    const noProjects = document.getElementById('no-projects');
    if (!container) return;

    let list = [];
    try {
      list = JSON.parse(localStorage.getItem('recent-projects') || '[]');
    } catch {}

    container.innerHTML = '';

    if (list.length === 0) {
      noProjects?.classList.remove('hidden');
      return;
    }
    noProjects?.classList.add('hidden');

    const pinned = getPinnedProjects();
    const pinnedPaths = new Set(pinned.map(p => p.path));

    list.forEach(proj => {
      const card = document.createElement('div');
      card.className = 'recent-card';
      const isPinned = pinnedPaths.has(proj.path);
      card.innerHTML = `
        <div class="recent-card-name">${proj.name || i18n.t('app.unnamed')}</div>
        <div class="recent-card-path">${proj.path}</div>
        <div class="recent-card-time">${formatTime(proj.lastOpened)}</div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:6px;">
          <span class="recent-card-mode">${proj.mode === 'extension' ? i18n.t('app.extension') : i18n.t('app.normal')}</span>
          <button class="pin-btn${isPinned ? ' pinned' : ''}" title="${isPinned ? i18n.t('app.unpin') : i18n.t('app.pin')}">${isPinned ? '📌' : '📍'}</button>
        </div>
      `;
      card.querySelector('.pin-btn').onclick = (e) => { e.stopPropagation(); togglePinProject(proj.path); };
      card.onclick = () => openProject(proj.path);
      card.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showContextMenu(e, proj, isPinned); });
      container.appendChild(card);
    });
  }

  function formatTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString(i18n.isEnglish() ? 'en-US' : 'zh-CN');
  }

  // ========== 右键菜单 ==========
  let _ctxProj = null; // 当前右键选中的项目

  function showContextMenu(e, proj, isPinned) {
    _ctxProj = proj;
    const menu = document.getElementById('project-context-menu');
    const pinItem = document.getElementById('ctx-pin-item');
    pinItem.textContent = isPinned ? '📍 取消固定' : '📌 固定';
    // 定位菜单
    menu.classList.remove('hidden');
    const x = Math.min(e.clientX, window.innerWidth - menu.offsetWidth - 8);
    const y = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 8);
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
  }

  function hideContextMenu() {
    document.getElementById('project-context-menu').classList.add('hidden');
    _ctxProj = null;
  }

  /** 重命名项目 */
  async function renameProject(folderPath, currentName) {
    return new Promise(async (resolve) => {
      const overlay = document.getElementById('rename-dialog');
      const input = document.getElementById('rename-input');
      const okBtn = document.getElementById('rename-ok');
      const cancelBtn = document.getElementById('rename-cancel');
      const titleEl = document.getElementById('rename-title');

      titleEl.textContent = i18n.isEnglish() ? '✏️ Rename Project' : '✏️ 重命名项目';
      input.value = currentName || '';
      overlay.classList.remove('hidden');
      setTimeout(() => { input.focus(); input.select(); }, 50);

      function close(val) {
        overlay.classList.add('hidden');
        okBtn.onclick = null;
        cancelBtn.onclick = null;
        input.onkeydown = null;
        overlay.onclick = null;
        resolve(val);
      }

      okBtn.onclick = () => close(input.value.trim());
      cancelBtn.onclick = () => close(null);
      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); close(input.value.trim()); }
        if (e.key === 'Escape') { e.preventDefault(); close(null); }
      };
      overlay.onclick = (e) => { if (e.target === overlay) close(null); };
    }).then(async (newName) => {
      if (!newName) return;
      const trimmed = newName;
      if (trimmed === currentName) return;

      // 计算新路径
      const sep = folderPath.includes('\\') ? '\\' : '/';
      const parentDir = folderPath.substring(0, folderPath.lastIndexOf(sep));
      const newPath = parentDir + sep + trimmed;

      if (folderPath === newPath) return;

      // 重命名文件夹
      const result = await window.api.renameFolder(folderPath, newPath);
      if (result && result.error) {
        alert(i18n.isEnglish() ? 'Rename failed: ' + result.error : '重命名失败: ' + result.error);
        return;
      }

      // 更新 project.json 中的名称
      try {
        const configStr = await window.api.readFile(newPath + '/project.json');
        if (configStr) {
          const config = JSON.parse(configStr);
          config.name = trimmed;
          await window.api.writeFile(newPath + '/project.json', JSON.stringify(config, null, 2));
        }
      } catch {}

      // 更新最近项目列表
      _replacePathInList('recent-projects', folderPath, newPath, trimmed);
      // 更新固定项目列表
      _replacePathInList('pinned-projects', folderPath, newPath, trimmed);

      renderPinnedProjects();
      renderRecentProjects();
    });
  }

  /** 删除项目 */
  async function deleteProject(folderPath) {
    const folderName = folderPath.split(/[\\/]/).pop();
    const msg = i18n.isEnglish()
      ? `Are you sure to delete project "${folderName}"?\n\nThis will permanently delete all files and cannot be undone!`
      : `确定要删除项目 "${folderName}" 吗？\n\n这将永久删除所有文件，无法撤销！`;
    if (!confirm(msg)) return;

    // 删除磁盘上的文件夹
    const result = await window.api.deleteFolder(folderPath);
    if (result && result.error) {
      alert(i18n.isEnglish() ? 'Delete failed: ' + result.error : '删除失败: ' + result.error);
      return;
    }

    // 从最近项目和固定项目中移除
    _removeFromList('recent-projects', folderPath);
    _removeFromList('pinned-projects', folderPath);

    renderPinnedProjects();
    renderRecentProjects();
  }

  /** 替换 localStorage 列表中的路径和名称 */
  function _replacePathInList(storageKey, oldPath, newPath, newName) {
    try {
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = list.map(p => {
        if (p.path === oldPath) return { ...p, path: newPath, name: newName };
        return p;
      });
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  }

  /** 从 localStorage 列表中移除指定路径 */
  function _removeFromList(storageKey, folderPath) {
    try {
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const updated = list.filter(p => p.path !== folderPath);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {}
  }

  /** 打开项目（在新窗口） */
  async function openProject(folder) {
    // 添加到最近项目
    addRecentProject(folder);
    // 读取项目的 renderMode 和 mode
    var renderMode = '2d';
    var mode = 'normal';
    try {
      var configStr = await window.api.readFile(folder + '/project.json');
      if (configStr) {
        var config = JSON.parse(configStr);
        renderMode = config.renderMode || '2d';
        mode = config.mode || 'normal';
      }
    } catch(e) {}
    // 打开编辑器窗口
    await window.api.openEditor(folder, mode, renderMode);
  }

  /** 添加最近项目记录 */
  function addRecentProject(folder) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('recent-projects') || '[]'); } catch {}
    const name = folder.split(/[\\/]/).pop();

    // 读取项目配置获取模式
    window.api.readFile(folder + '/project.json').then(configStr => {
      if (!configStr) return;
      try {
        const config = JSON.parse(configStr);
        list = list.filter(p => p.path !== folder);
        list.unshift({
          name: config.name || name,
          path: folder,
          mode: config.mode || 'normal',
          lastOpened: new Date().toISOString(),
        });
        if (list.length > 10) list = list.slice(0, 10);
        localStorage.setItem('recent-projects', JSON.stringify(list));
        renderRecentProjects();
      } catch {}
    });
  }

  /** 显示模式选择弹窗 */
  function showModeDialog() {
    document.getElementById('mode-dialog').classList.remove('hidden');
  }
  
  function hideModeDialog() {
    document.getElementById('mode-dialog').classList.add('hidden');
  }
  
  // 渲染模式子选择弹窗
  function showRenderModeDialog() {
    document.getElementById('render-mode-dialog').classList.remove('hidden');
  }
  function hideRenderModeDialog() {
    document.getElementById('render-mode-dialog').classList.add('hidden');
  }
  
  /** 新建工程（通过模式弹窗）：选择父文件夹，在其中创建“我的作品”子目录 */
  async function createNewProject(mode, renderMode) {
    hideModeDialog();
    hideRenderModeDialog();
    const parentFolder = await window.api.selectFolder();
    if (!parentFolder) return;
  
    // Web 版：selectFolder 返回的路径就是项目路径，不再追加子目录
    // Electron 版：在选中的父文件夹下创建“我的作品”子目录
    const isWeb = window.api && window.api._isWebShim;
    const folder = isWeb ? parentFolder : parentFolder + '/' + i18n.t('app.myWork');
    const projectName = isWeb ? folder.split('/').pop() : i18n.t('app.myWork');
  
    // 创建项目结构
    mode = mode || 'normal';
    renderMode = renderMode || '2d';
    await window.api.ensureDir(folder);
    await window.api.ensureDir(folder + '/scripts');
    await window.api.ensureDir(folder + '/assets');
    await window.api.ensureDir(folder + '/sounds');
    if (mode === 'extension') {
      await window.api.ensureDir(folder + '/extensions');
    }
  
    const config = {
      name: projectName,
      version: '1.0',
      mode: mode,
      renderMode: renderMode,
      created: new Date().toISOString(),
      stageWidth: 480,
      stageHeight: 360,
    };
    await window.api.writeFile(folder + '/project.json', JSON.stringify(config, null, 2));
    await window.api.writeFile(folder + '/scripts/main.json', '{}');
  
    // 打开编辑器窗口
    await window.api.openEditor(folder, mode, renderMode);
  
    // 添加到最近项目并刷新
    addRecentProject(folder);
  }

  document.addEventListener('DOMContentLoaded', () => {
    // 应用 i18n 到 DOM
    i18n.applyToDOM();

    // 语言切换按钮
    document.getElementById('home-lang-switch')?.addEventListener('click', () => {
      i18n.setLocale(i18n.isEnglish() ? 'zh-CN' : 'en');
    });

    // 窗口控制按钮
    document.getElementById('win-minimize')?.addEventListener('click', () => window.api.windowMinimize());
    document.getElementById('win-maximize')?.addEventListener('click', () => window.api.windowMaximize());
    document.getElementById('win-close')?.addEventListener('click', () => window.api.windowClose());

    // 主页按钮事件
    document.getElementById('home-btn-new').addEventListener('click', showModeDialog);
    document.getElementById('home-btn-open').addEventListener('click', async () => {
      // Web 版：选择已有项目；Electron 版：选择文件夹
      const isWeb = window.api && window.api._isWebShim;
      const folder = isWeb
        ? await window.api.selectExistingProject()
        : await window.api.selectFolder();
      if (folder) {
        await openProject(folder);
      }
    });

    // 模式选择弹窗
    document.querySelectorAll('#mode-dialog .mode-card').forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode;
        if (mode === 'normal') {
          // 普通创作显示渲染模式子选择
          hideModeDialog();
          showRenderModeDialog();
        } else if (mode === 'advanced') {
          // 高级创作：默认 2D 模式，进入 Godot 式编辑器
          createNewProject('advanced', '2d');
        } else {
          createNewProject(mode, '2d');
        }
      });
    });
    document.getElementById('mode-cancel').addEventListener('click', hideModeDialog);

    // 渲染模式子选择
    document.querySelectorAll('#render-mode-dialog .mode-card').forEach(card => {
      card.addEventListener('click', () => {
        hideRenderModeDialog();
        createNewProject('normal', card.dataset.render);
      });
    });
    document.getElementById('render-mode-cancel').addEventListener('click', hideRenderModeDialog);

    // ============ 社区登录 ============
    const btnLogin = document.getElementById('home-btn-login');
    const userMenu = document.getElementById('user-menu');
    const menuOpenCommunity = document.getElementById('menu-open-community');
    const menuLogout = document.getElementById('menu-logout');
    const menuDeleteAccount = document.getElementById('menu-delete-account');
    const loginRegisterLink = document.getElementById('login-register-link');

    // Toggle user menu dropdown
    btnLogin.addEventListener('click', (e) => {
      if (typeof CommunityAPI === 'undefined') {
        alert(i18n.isEnglish() ? 'Community module not loaded' : '社区模块未加载');
        return;
      }
      const user = CommunityAPI.getUser();
      if (user) {
        // Logged in: show menu
        e.stopPropagation();
        userMenu.classList.toggle('hidden');
      } else {
        // Not logged in: show login dialog
        showLoginDialog();
      }
    });

    // Close menu when clicking outside
    document.addEventListener('click', () => {
      userMenu.classList.add('hidden');
    });
    userMenu.addEventListener('click', (e) => e.stopPropagation());

    // Menu: Open community in browser
    menuOpenCommunity.addEventListener('click', () => {
      userMenu.classList.add('hidden');
      window.api.openExternal('https://tomlct2015.github.io/Objector-Coder/community/index.html');
    });

    // Menu: Logout
    menuLogout.addEventListener('click', async () => {
      userMenu.classList.add('hidden');
      if (confirm(i18n.isEnglish() ? 'Are you sure to logout?' : '确定要登出吗？')) {
        await CommunityAPI.signOut();
        refreshCommunityUI();
      }
    });

    // Menu: Delete account
    menuDeleteAccount.addEventListener('click', async () => {
      userMenu.classList.add('hidden');
      if (typeof CommunityAPI === 'undefined' || !CommunityAPI.getUser()) return;
      const user = CommunityAPI.getUser();
      const msg = i18n.isEnglish()
        ? `Are you sure to delete account "${user.email}"?\n\nThis action is IRREVERSIBLE! All your data (projects, posts, etc.) will be permanently deleted.\n\nPlease enter your password to confirm:`
        : `确定要注销账户 "${user.email}" 吗？\n\n此操作不可撤销！你的所有数据（作品、帖子等）将被永久删除。\n\n请输入密码确认：`;
      const password = prompt(msg);
      if (!password) return;
      const res = await CommunityAPI.deleteAccount(password);
      if (res.error) {
        alert(i18n.isEnglish() ? 'Delete failed: ' + res.error : '注销失败: ' + res.error);
      } else {
        alert(i18n.isEnglish() ? 'Account deleted successfully.' : '账户已注销。');
        refreshCommunityUI();
      }
    });

    // Register link: open in browser
    loginRegisterLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.openExternal('https://tomlct2015.github.io/Objector-Coder/community/login.html');
    });

    function refreshCommunityUI() {
      if (typeof CommunityAPI === 'undefined') return;
      const user = CommunityAPI.getUser();
      const profile = CommunityAPI.getProfile();
      if (user) {
        btnLogin.textContent = '✅ ' + (profile?.username || user.email || '已登录');
        btnLogin.title = i18n.isEnglish() ? 'Click to open menu' : '点击打开菜单';
      } else {
        btnLogin.textContent = '👤 ' + (i18n.isEnglish() ? 'Login' : '登录');
        btnLogin.title = i18n.isEnglish() ? 'Login to community' : '登录社区';
      }
    }

    function showLoginDialog() {
      if (typeof CommunityAPI === 'undefined') {
        alert(i18n.isEnglish() ? 'Community module not loaded' : '社区模块未加载');
        return;
      }
      if (!CommunityAPI.isConfigured()) {
        CommunityAPI.init();
      }

      const overlay = document.getElementById('community-login-dialog');
      const emailInput = document.getElementById('login-email');
      const passInput = document.getElementById('login-password');
      const resultEl = document.getElementById('login-result');
      const submitBtn = document.getElementById('login-submit');
      const cancelBtn = document.getElementById('login-cancel');

      // OTP elements
      const tabPassword = document.getElementById('login-tab-password');
      const tabOtp = document.getElementById('login-tab-otp');
      const sectionPassword = document.getElementById('login-section-password');
      const sectionOtp = document.getElementById('login-section-otp');
      const otpEmailInput = document.getElementById('login-otp-email');
      const otpCodeInput = document.getElementById('login-otp-code');
      const otpSendBtn = document.getElementById('login-otp-send');

      let currentTab = 'password'; // 'password' or 'otp'

      // Reset state
      emailInput.value = '';
      passInput.value = '';
      otpEmailInput.value = '';
      otpCodeInput.value = '';
      resultEl.textContent = '';
      submitBtn.disabled = false;
      submitBtn.textContent = i18n.isEnglish() ? 'Login' : '登录';

      // Reset tab to password
      switchTab('password');

      overlay.classList.remove('hidden');
      setTimeout(function() { emailInput.focus(); }, 50);

      function switchTab(tab) {
        currentTab = tab;
        resultEl.textContent = '';
        if (tab === 'password') {
          sectionPassword.style.display = '';
          sectionOtp.style.display = 'none';
          tabPassword.style.borderBottomColor = 'var(--accent)';
          tabPassword.style.color = 'var(--text-primary)';
          tabOtp.style.borderBottomColor = 'transparent';
          tabOtp.style.color = 'var(--text-muted)';
          submitBtn.textContent = i18n.isEnglish() ? 'Login' : '登录';
          submitBtn.disabled = false;
        } else {
          sectionPassword.style.display = 'none';
          sectionOtp.style.display = '';
          tabOtp.style.borderBottomColor = 'var(--accent)';
          tabOtp.style.color = 'var(--text-primary)';
          tabPassword.style.borderBottomColor = 'transparent';
          tabPassword.style.color = 'var(--text-muted)';
          submitBtn.textContent = i18n.isEnglish() ? 'Verify & Login' : '验证并登录';
          submitBtn.disabled = false;
        }
      }

      tabPassword.onclick = () => switchTab('password');
      tabOtp.onclick = () => switchTab('otp');

      function close() {
        overlay.classList.add('hidden');
        submitBtn.onclick = null;
        cancelBtn.onclick = null;
        otpSendBtn.onclick = null;
        tabPassword.onclick = null;
        tabOtp.onclick = null;
      }

      cancelBtn.onclick = close;
      overlay.onclick = function(e) { if (e.target === overlay) close(); };

      // ---- Password login ----
      async function doLogin() {
        var email = emailInput.value.trim();
        var password = passInput.value;
        if (!email || !password) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = i18n.isEnglish() ? 'Please enter email and password' : '请输入邮箱和密码';
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '...';
        resultEl.style.color = 'var(--text-secondary)';
        resultEl.textContent = i18n.isEnglish() ? 'Logging in...' : '登录中...';

        var res = await CommunityAPI.signIn(email, password);
        submitBtn.disabled = false;
        submitBtn.textContent = i18n.isEnglish() ? 'Login' : '登录';

        if (res.error) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = res.error.message || res.error;
          return;
        }
        resultEl.style.color = 'var(--green)';
        resultEl.textContent = i18n.isEnglish() ? 'Login successful!' : '登录成功！';
        submitBtn.textContent = i18n.isEnglish() ? 'Done' : '完成';
        submitBtn.onclick = function() { close(); refreshCommunityUI(); };
        cancelBtn.textContent = i18n.isEnglish() ? 'Close' : '关闭';
      }

      // ---- OTP login ----
      let otpCooldown = 0;
      async function doSendOtp() {
        var email = otpEmailInput.value.trim();
        if (!email) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = i18n.isEnglish() ? 'Please enter email' : '请输入邮箱';
          return;
        }
        if (otpCooldown > 0) {
          resultEl.style.color = 'var(--text-muted)';
          resultEl.textContent = (i18n.isEnglish() ? 'Please wait ' : '请等待 ') + otpCooldown + (i18n.isEnglish() ? 's' : '秒');
          return;
        }
        otpSendBtn.disabled = true;
        otpSendBtn.textContent = '...';
        resultEl.style.color = 'var(--text-secondary)';
        resultEl.textContent = i18n.isEnglish() ? 'Sending...' : '发送中...';

        var res = await CommunityAPI.sendLoginOtp(email);
        if (res.error) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = res.error.message || res.error;
          otpSendBtn.disabled = false;
          otpSendBtn.textContent = i18n.isEnglish() ? 'Send Code' : '发送验证码';
          return;
        }
        resultEl.style.color = 'var(--green)';
        resultEl.textContent = i18n.isEnglish() ? 'Code sent! Check your email.' : '验证码已发送！请查看邮箱。';
        otpSendBtn.disabled = false;
        otpSendBtn.textContent = i18n.isEnglish() ? 'Resend' : '重新发送';

        // Cooldown 60s
        otpCooldown = 60;
        otpSendBtn.disabled = true;
        const cdTimer = setInterval(() => {
          otpCooldown--;
          otpSendBtn.textContent = (i18n.isEnglish() ? 'Resend(' : '重新发送(') + otpCooldown + 's)';
          if (otpCooldown <= 0) {
            clearInterval(cdTimer);
            otpSendBtn.disabled = false;
            otpSendBtn.textContent = i18n.isEnglish() ? 'Resend' : '重新发送';
          }
        }, 1000);
      }

      async function doOtpLogin() {
        var email = otpEmailInput.value.trim();
        var code = otpCodeInput.value.trim();
        if (!email || !code) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = i18n.isEnglish() ? 'Please enter email and code' : '请输入邮箱和验证码';
          return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = '...';
        resultEl.style.color = 'var(--text-secondary)';
        resultEl.textContent = i18n.isEnglish() ? 'Verifying...' : '验证中...';

        var res = await CommunityAPI.verifyLoginOtp(email, code);
        submitBtn.disabled = false;
        submitBtn.textContent = i18n.isEnglish() ? 'Verify & Login' : '验证并登录';

        if (res.error) {
          resultEl.style.color = 'var(--red)';
          resultEl.textContent = res.error.message || res.error;
          return;
        }
        resultEl.style.color = 'var(--green)';
        resultEl.textContent = i18n.isEnglish() ? 'Login successful!' : '登录成功！';
        submitBtn.textContent = i18n.isEnglish() ? 'Done' : '完成';
        submitBtn.onclick = function() { close(); refreshCommunityUI(); };
        cancelBtn.textContent = i18n.isEnglish() ? 'Close' : '关闭';
      }

      otpSendBtn.onclick = doSendOtp;

      // Submit button behavior depends on current tab
      submitBtn.onclick = function() {
        if (currentTab === 'password') doLogin();
        else doOtpLogin();
      };

      passInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); doLogin(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      };
      emailInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); passInput.focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      };
      otpCodeInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); doOtpLogin(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      };
      otpEmailInput.onkeydown = function(e) {
        if (e.key === 'Enter') { e.preventDefault(); otpCodeInput.focus(); }
        else if (e.key === 'Escape') { e.preventDefault(); close(); }
      };
    }

    if (typeof CommunityAPI !== 'undefined') {
      CommunityAPI.init();
      CommunityAPI.restoreSession().then(() => refreshCommunityUI());
    } else {
      btnLogin.textContent = '👤 ' + (i18n.isEnglish() ? 'Login' : '登录');
      btnLogin.addEventListener('click', () => alert(i18n.isEnglish() ? 'Community module not loaded' : '社区模块未加载'));
    }

    // 启动时渲染固定项目和最近项目
    renderPinnedProjects();
    renderRecentProjects();

    // ========== 右键菜单事件绑定 ==========
    const ctxMenu = document.getElementById('project-context-menu');
    // 点击空白处关闭菜单
    document.addEventListener('click', () => hideContextMenu());
    document.addEventListener('contextmenu', (e) => {
      // 如果右键的不是项目卡片，关闭菜单
      if (!e.target.closest('.recent-card')) hideContextMenu();
    });

    ctxMenu.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!_ctxProj) return;
        const action = item.dataset.action;
        const proj = _ctxProj;
        hideContextMenu();
        if (action === 'open') {
          openProject(proj.path);
        } else if (action === 'rename') {
          renameProject(proj.path, proj.name);
        } else if (action === 'pin') {
          togglePinProject(proj.path);
        } else if (action === 'delete') {
          deleteProject(proj.path);
        }
      });
    });

    // 窗口重新聚焦时刷新列表（编辑器内重命名后回到主页可见更新）
    window.addEventListener('focus', () => {
      renderPinnedProjects();
      renderRecentProjects();
    });
  });
})();
