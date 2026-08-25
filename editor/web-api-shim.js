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

  /** 写入二进制文件（Web 版：将 base64 存储到 BINARY_PREFIX） */
  async function writeFileBinary(path, base64Content) {
    path = norm(path);
    try {
      // 支持 data URL 格式
      const b64 = base64Content.includes(',') ? base64Content : 'data:application/octet-stream;base64,' + base64Content;
      localStorage.setItem(BINARY_PREFIX + path, b64);
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

  /** 选择文件夹（Web 版：弹出输入框让用户输入项目名称） */
  async function selectFolder() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-prompt-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
      overlay.innerHTML = `
        <div style="background:var(--bg-secondary,#181825);border:1px solid var(--border,#45475a);border-radius:10px;padding:20px;min-width:320px;max-width:420px;">
          <h3 style="margin:0 0 12px;font-size:14px;color:var(--accent,#89b4fa);">📁 输入项目名称</h3>
          <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary,#a6adc8);">为新项目起一个名字：</p>
          <input type="text" id="_web-folder-input" value="我的项目" style="width:100%;padding:8px 10px;background:var(--bg-surface,#313244);border:1px solid var(--border,#45475a);border-radius:6px;color:var(--text-primary,#cdd6f4);font-size:13px;outline:none;box-sizing:border-box;" />
          <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
            <button id="_web-folder-cancel" style="background:var(--bg-surface,#313244);color:var(--text-primary,#cdd6f4);border:1px solid var(--border,#45475a);border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;">取消</button>
            <button id="_web-folder-ok" style="background:var(--accent,#89b4fa);color:#1e1e2e;border:none;border-radius:6px;padding:6px 16px;font-size:12px;cursor:pointer;font-weight:600;">确定</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector('#_web-folder-input');
      input.focus();
      input.select();

      overlay.querySelector('#_web-folder-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      overlay.querySelector('#_web-folder-ok').addEventListener('click', () => {
        const name = input.value.trim();
        document.body.removeChild(overlay);
        if (!name) { resolve(null); return; }
        // 返回 VFS 路径
        const vfsPath = '/projects/' + name;
        ensureDir(vfsPath);
        resolve(vfsPath);
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') overlay.querySelector('#_web-folder-ok').click();
        if (e.key === 'Escape') overlay.querySelector('#_web-folder-cancel').click();
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); }
      });
    });
  }

  /** 保存文件对话框（Web 版：触发浏览器下载） */
  async function saveFileDialog(defaultName, filters) {
    // Web 版：返回 null 让调用方使用 blob 回退
    return null;
  }

  // ============ 打开项目：导入 ZIP 或本地文件夹 ============

  let _pickerResolve = null;

  /** 打开项目：弹出对话框让用户选择导入 zip 或文件夹 */
  function _showProjectPicker() {
    return new Promise((resolve) => {
      _pickerResolve = resolve;
      const overlay = document.createElement('div');
      overlay.id = '_import-project-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;';
      overlay.innerHTML = `
        <div style="background:var(--bg-secondary,#181825);border:1px solid var(--border,#45475a);border-radius:12px;padding:24px;min-width:340px;max-width:420px;">
          <h3 style="margin:0 0 16px;font-size:15px;color:var(--accent,#89b4fa);">📂 打开项目</h3>
          <p style="margin:0 0 16px;font-size:12px;color:var(--text-secondary,#a6adc8);">选择打开方式：</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            <button id="_import-zip-btn" style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--bg-surface,#313244);border:1px solid var(--border,#45475a);border-radius:8px;cursor:pointer;transition:all .15s;color:var(--text-primary,#cdd6f4);font-size:13px;text-align:left;">
              <span style="font-size:24px">📦</span>
              <div><div style="font-weight:600;">导入 ZIP 压缩包</div><div style="font-size:11px;color:var(--text-muted,#6c7086);margin-top:2px;">选择本地的 .zip 项目文件</div></div>
            </button>
            <button id="_import-folder-btn" style="display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--bg-surface,#313244);border:1px solid var(--border,#45475a);border-radius:8px;cursor:pointer;transition:all .15s;color:var(--text-primary,#cdd6f4);font-size:13px;text-align:left;">
              <span style="font-size:24px">📁</span>
              <div><div style="font-weight:600;">选择本地文件夹</div><div style="font-size:11px;color:var(--text-muted,#6c7086);margin-top:2px;">直接打开电脑上的项目文件夹</div></div>
            </button>
          </div>
          <div style="margin-top:16px;text-align:right;">
            <button id="_import-cancel-btn" style="background:transparent;color:var(--text-muted,#6c7086);border:none;cursor:pointer;padding:6px 12px;font-size:12px;">取消</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector('#_import-cancel-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      overlay.querySelector('#_import-zip-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        _importZipFile().then(resolve);
      });

      overlay.querySelector('#_import-folder-btn').addEventListener('click', () => {
        document.body.removeChild(overlay);
        _importFolder().then(resolve);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); }
      });
    });
  }

  /** 导入 ZIP 文件到 VFS */
  async function _importZipFile() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) { resolve(null); return; }

        try {
          const arrayBuffer = await file.arrayBuffer();
          const zip = await JSZip.loadAsync(arrayBuffer);
          const zipName = file.name.replace(/\.zip$/i, '');
          const basePath = '/projects/' + zipName;

          const entries = [];
          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir) {
              entries.push({ path: relativePath, entry: zipEntry });
            }
          });

          for (const { path: relPath, entry } of entries) {
            const vfsPath = norm(basePath + '/' + relPath);
            if (/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|mp3|wav|ogg)$/i.test(relPath)) {
              const b64 = await entry.async('base64');
              localStorage.setItem(BINARY_PREFIX + vfsPath, 'data:application/octet-stream;base64,' + b64);
            } else {
              const text = await entry.async('string');
              localStorage.setItem(VFS_PREFIX + vfsPath, text);
            }
          }

          ensureDir(basePath);
          console.log('[WebShim] ZIP imported:', basePath, entries.length, 'files');
          resolve(basePath);
        } catch (e) {
          alert('ZIP 导入失败: ' + e.message);
          resolve(null);
        }
      };
      input.click();
    });
  }

  /** 导入本地文件夹到 VFS */
  async function _importFolder() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.directory = true;
      input.multiple = true;
      input.onchange = async () => {
        const files = input.files;
        if (!files || files.length === 0) { resolve(null); return; }

        try {
          const firstPath = files[0].webkitRelativePath;
          const rootName = firstPath.split('/')[0];
          const basePath = '/projects/' + rootName;

          for (const file of files) {
            const relPath = file.webkitRelativePath.substring(rootName.length + 1);
            if (!relPath) continue;
            const vfsPath = norm(basePath + '/' + relPath);

            if (/\.(png|jpg|jpeg|gif|bmp|webp|svg|ico|mp3|wav|ogg)$/i.test(relPath)) {
              const reader = new FileReader();
              const b64 = await new Promise((res) => {
                reader.onload = () => res(reader.result);
                reader.readAsDataURL(file);
              });
              localStorage.setItem(BINARY_PREFIX + vfsPath, b64);
            } else {
              const text = await file.text();
              localStorage.setItem(VFS_PREFIX + vfsPath, text);
            }
          }

          ensureDir(basePath);
          console.log('[WebShim] Folder imported:', basePath, files.length, 'files');
          resolve(basePath);
        } catch (e) {
          alert('文件夹导入失败: ' + e.message);
          resolve(null);
        }
      };
      input.click();
    });
  }

  window._webPickerCancel = function () {
    const overlay = document.getElementById('_import-project-overlay');
    if (overlay) document.body.removeChild(overlay);
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

  /** 选择已有项目（Web 版：弹出项目选择列表） */
  async function selectExistingProject() {
    return _showProjectPicker();
  }

  // ============ 注册 window.api ============

  window.api = {
    _isWebShim: true,
    readFile, writeFile, writeFileBinary, deleteFile,
    ensureDir, listDir, readDirRecursive,
    readFileBinary, copyFile, renameFolder,
    deleteFolder, isDir,
    selectFolder, selectExistingProject, selectImageFile, selectExtensionFile, selectAudioFile,
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
