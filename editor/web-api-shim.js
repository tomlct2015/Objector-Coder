/**
 * Web API Shim - 浏览器环境下的 window.api 适配层
 * 替代 Electron preload.js，使用 localStorage 实现虚拟文件系统
 */
(function () {
  const VFS_PREFIX = 'vfs:';
  const BINARY_PREFIX = 'vfsb:';  // 二进制文件（base64）

  // ============ 虚拟文件系统 ============

  /** 规范化路径：统一使用 / 分隔，去除末尾 / */
  function norm(p) {
    return (p || '').replace(/\\/g, '/').replace(/\/+$/, '');
  }

  /** 获取所有 VFS 中的文件路径 */
  function getAllPaths() {
    const paths = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(VFS_PREFIX)) {
        paths.push(key.slice(VFS_PREFIX.length));
      }
      if (key.startsWith(BINARY_PREFIX)) {
        paths.push(key.slice(BINARY_PREFIX.length));
      }
    }
    return paths;
  }

  /** 确保目录存在（在 VFS 中标记） */
  async function ensureDir(dir) {
    dir = norm(dir);
    localStorage.setItem(VFS_PREFIX + dir + '/__dir__', '1');
    // 确保父目录也存在
    const parent = dir.replace(/\/[^/]*$/, '');
    if (parent && parent !== dir) {
      localStorage.setItem(VFS_PREFIX + parent + '/__dir__', '1');
    }
  }

  /** 读取文件 */
  async function readFile(path) {
    path = norm(path);
    return localStorage.getItem(VFS_PREFIX + path);
  }

  /** 写入文件 */
  async function writeFile(path, content) {
    path = norm(path);
    try {
      localStorage.setItem(VFS_PREFIX + path, content);
      // 确保父目录存在
      const dir = path.replace(/\/[^/]*$/, '');
      if (dir) ensureDir(dir);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /** 删除文件 */
  async function deleteFile(path) {
    path = norm(path);
    localStorage.removeItem(VFS_PREFIX + path);
    localStorage.removeItem(BINARY_PREFIX + path);
  }

  /** 列出目录内容（仅直接子项） */
  async function listDir(dir) {
    dir = norm(dir);
    const prefix = dir + '/';
    const entries = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      let filePath = null;
      if (key.startsWith(VFS_PREFIX)) {
        filePath = key.slice(VFS_PREFIX.length);
      } else if (key.startsWith(BINARY_PREFIX)) {
        filePath = key.slice(BINARY_PREFIX.length);
      }
      if (filePath && filePath.startsWith(prefix)) {
        const rest = filePath.slice(prefix.length);
        const name = rest.split('/')[0];
        if (name && name !== '__dir__') {
          entries.add(name);
        }
      }
    }
    return Array.from(entries);
  }

  /** 递归列出目录下所有文件 */
  async function readDirRecursive(dir) {
    dir = norm(dir);
    const prefix = dir + '/';
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(VFS_PREFIX) && !key.endsWith('__dir__')) {
        const filePath = key.slice(VFS_PREFIX.length);
        if (filePath.startsWith(prefix)) {
          const relPath = filePath.slice(prefix.length);
          const content = localStorage.getItem(key) || '';
          results.push({ path: relPath, content: content });
        }
      }
    }
    return results;
  }

  /** 读取二进制文件（返回 base64） */
  async function readFileBinary(path) {
    path = norm(path);
    // 先检查二进制存储
    const b64 = localStorage.getItem(BINARY_PREFIX + path);
    if (b64) return b64;
    // fallback: 检查普通存储
    return localStorage.getItem(VFS_PREFIX + path);
  }

  /** 复制文件 */
  async function copyFile(src, dest) {
    src = norm(src);
    dest = norm(dest);
    try {
      // 复制二进制数据
      const binary = localStorage.getItem(BINARY_PREFIX + src);
      if (binary) {
        localStorage.setItem(BINARY_PREFIX + dest, binary);
      }
      // 复制文本数据
      const text = localStorage.getItem(VFS_PREFIX + src);
      if (text) {
        localStorage.setItem(VFS_PREFIX + dest, text);
      }
      const dir = dest.replace(/\/[^/]*$/, '');
      if (dir) ensureDir(dir);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /** 重命名文件夹 */
  async function renameFolder(oldPath, newPath) {
    oldPath = norm(oldPath);
    newPath = norm(newPath);
    try {
      const oldPrefix = oldPath + '/';
      const keysToUpdate = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if ((key.startsWith(VFS_PREFIX) || key.startsWith(BINARY_PREFIX)) && key.includes(oldPrefix)) {
          keysToUpdate.push(key);
        }
      }
      keysToUpdate.forEach(key => {
        const value = localStorage.getItem(key);
        const newKey = key.replace(oldPrefix, newPath + '/');
        localStorage.setItem(newKey, value);
        localStorage.removeItem(key);
      });
      // 更新目录标记
      localStorage.removeItem(VFS_PREFIX + oldPath + '/__dir__');
      ensureDir(newPath);
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /** 路径拼接 */
  function pathJoin(...args) {
    return norm(args.join('/'));
  }

  // ============ 文件选择器 ============

  /** 通用文件选择（返回 VFS 路径） */
  function selectFile(accept, readAs) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '*';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) { resolve(null); return; }

        const vfsPath = '/uploads/' + file.name;
        if (readAs === 'binary' || /\.(png|jpg|jpeg|gif|bmp|webp|svg|mp3|wav|ogg)$/i.test(file.name)) {
          // 读取为 base64
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            localStorage.setItem(BINARY_PREFIX + norm(vfsPath), dataUrl);
            resolve(vfsPath);
          };
          reader.readAsDataURL(file);
        } else {
          // 读取为文本
          const text = await file.text();
          localStorage.setItem(VFS_PREFIX + norm(vfsPath), text);
          resolve(vfsPath);
        }
      };
      input.click();
    });
  }

  async function selectImageFile() {
    return selectFile('image/*', 'binary');
  }

  async function selectExtensionFile() {
    return selectFile('.json,.js', 'text');
  }

  async function selectAudioFile() {
    return selectFile('audio/*,.mp3,.wav,.ogg', 'binary');
  }

  /** 选择文件夹（Web 版：弹出项目选择对话框） */
  async function selectFolder() {
    return new Promise((resolve) => {
      // 显示 Web 版项目选择/新建对话框
      _showProjectPicker().then(resolve);
    });
  }

  /** 保存文件对话框（Web 版：触发浏览器下载） */
  async function saveFileDialog(defaultName, filters) {
    // 获取当前编辑器中已保存的项目内容
    if (!EditorState || !EditorState.projectPath) return null;

    // 构造一个完整的虚拟路径用于下载
    const filePath = EditorState.projectPath + '/' + defaultName;
    let content = localStorage.getItem(VFS_PREFIX + norm(filePath));
    if (!content) {
      // 尝试生成 HTML 导出内容（由 html-exporter 调用）
      content = localStorage.getItem(VFS_PREFIX + norm(filePath));
    }
    if (!content) return null;

    // 触发浏览器下载
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);

    return filePath;
  }

  // ============ 项目选择器 UI ============

  let _pickerResolve = null;

  function _showProjectPicker() {
    return new Promise((resolve) => {
      _pickerResolve = resolve;
      const overlay = document.getElementById('web-project-picker');
      if (!overlay) { resolve(null); return; }
      _refreshPickerList();
      overlay.classList.remove('hidden');
    });
  }

  function _refreshPickerList() {
    const list = document.getElementById('picker-project-list');
    if (!list) return;
    list.innerHTML = '';

    // 从 VFS 中查找所有项目（查找 project.json）
    const projects = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(VFS_PREFIX) && key.endsWith('/project.json')) {
        const projPath = key.slice(VFS_PREFIX.length).replace('/project.json', '');
        try {
          const config = JSON.parse(localStorage.getItem(key));
          projects.push({ path: projPath, name: config.name || projPath.split('/').pop() });
        } catch {
          projects.push({ path: projPath, name: projPath.split('/').pop() });
        }
      }
    }

    if (projects.length === 0) {
      list.innerHTML = '<div style="color:var(--text-muted);padding:16px;text-align:center;">' +
        (i18n.isEnglish() ? 'No projects yet. Create one first!' : '还没有项目，请先新建一个！') + '</div>';
      return;
    }

    projects.forEach(p => {
      const div = document.createElement('div');
      div.className = 'picker-item';
      div.innerHTML = '<span>' + p.name + '</span>';
      div.onclick = () => {
        _closePicker();
        if (_pickerResolve) { _pickerResolve(p.path); _pickerResolve = null; }
      };
      list.appendChild(div);
    });
  }

  function _closePicker() {
    const overlay = document.getElementById('web-project-picker');
    if (overlay) overlay.classList.add('hidden');
  }

  window._webPickerCancel = function () {
    _closePicker();
    if (_pickerResolve) { _pickerResolve(null); _pickerResolve = null; }
  };

  // ============ 窗口控制（no-op） ============

  async function windowMinimize() {}
  async function windowMaximize() {}
  async function windowClose() {}

  // ============ 其他 ============

  async function openExtensionDocs() {
    window.open('../extension-api/', '_blank');
  }

  async function openEditor(folder, mode, renderMode) {
    // 导航到编辑器页面
    var url = 'editor.html?path=' + encodeURIComponent(folder) + '&mode=' + (mode || 'normal');
    if (renderMode) url += '&render=' + renderMode;
    window.location.href = url;
  }

  /** 监听项目加载事件（Web 版不需要） */
  function onLoadProject(callback) {
    // Web 版通过 URL 参数加载项目，不需要 IPC 事件
  }

  // ============ 图片加载拦截 ============

  // 拦截 file:// 协议的图片加载，替换为 VFS 中的 base64/data URL
  (function patchImageSrc() {
    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (!originalDescriptor || !originalDescriptor.set) return;

    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      get: originalDescriptor.get,
      set: function (value) {
        if (typeof value === 'string' && value.startsWith('file://')) {
          const vfsPath = norm(value.replace('file://', ''));
          const dataUrl = localStorage.getItem(BINARY_PREFIX + vfsPath);
          if (dataUrl) {
            originalDescriptor.set.call(this, dataUrl);
            return;
          }
          // fallback: 尝试 VFS_PREFIX
          const text = localStorage.getItem(VFS_PREFIX + vfsPath);
          if (text) {
            if (text.startsWith('data:')) {
              originalDescriptor.set.call(this, text);
              return;
            }
            // SVG 文件可能以纯文本存储
            if (text.trimStart().startsWith('<svg') || /<svg[\s>]/.test(text.slice(0, 200))) {
              originalDescriptor.set.call(this, 'data:image/svg+xml,' + encodeURIComponent(text));
              return;
            }
          }
        }
        originalDescriptor.set.call(this, value);
      },
      configurable: true,
      enumerable: true,
    });
  })();

  /** 删除文件夹（递归） */
  async function deleteFolder(folderPath) {
    folderPath = norm(folderPath);
    const prefix = folderPath + '/';
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if ((key.startsWith(VFS_PREFIX) || key.startsWith(BINARY_PREFIX)) && key.includes(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(VFS_PREFIX + folderPath + '/__dir__');
      return { ok: true };
    } catch (e) {
      return { error: e.message };
    }
  }

  /** 判断路径是否为目录 */
  async function isDir(path) {
    path = norm(path);
    // 检查目录标记
    if (localStorage.getItem(VFS_PREFIX + path + '/__dir__') === '1') return true;
    // 检查是否有子文件
    const prefix = path + '/';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if ((key.startsWith(VFS_PREFIX) || key.startsWith(BINARY_PREFIX)) && key.slice(key.indexOf('/') + 1).startsWith(prefix)) {
        return true;
      }
    }
    return false;
  }

  /** 打开社区登录（Web 版不需要） */
  async function openCommunityLogin() {}

  /** 打开外部链接 */
  async function openExternal(url) {
    window.open(url, '_blank');
    return { ok: true };
  }

  /** 打开 JS 编辑器弹窗（Web 版不支持） */
  async function openJsEditor() {
    alert('Web 版暂不支持独立 JS 编辑器窗口，请在内嵌编辑器中编辑代码');
    return { ok: true };
  }

  /** 监听 JS 编辑器代码更新（Web 版 no-op） */
  function onJsEditorCodeUpdated() {}

  /** 获取编辑器初始化数据（Web 版通过 URL 参数获取） */
  async function getEditorInit() {
    return null;
  }

  // ============ 注册 window.api ============

  window.api = {
    _isWebShim: true,
    readFile, writeFile, deleteFile,
    ensureDir, listDir, readDirRecursive,
    readFileBinary, copyFile, renameFolder,
    deleteFolder, isDir,
    selectFolder, selectImageFile, selectExtensionFile, selectAudioFile,
    saveFileDialog,
    pathJoin,
    openExtensionDocs, openEditor,
    openCommunityLogin, openExternal,
    openJsEditor, onJsEditorCodeUpdated, getEditorInit,
    windowMinimize, windowMaximize, windowClose,
    onLoadProject,
  };

  console.log('[WebShim] window.api registered (localStorage VFS mode)');
})();
