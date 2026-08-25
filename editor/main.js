const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

if (require('electron-squirrel-startup')) app.quit();

const APP_ICON = path.join(__dirname, '..', 'Objector2.png');

let mainWindow;
let editorWindow;
let _pendingEditorInit = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Objector',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

function createEditorWindow(projectPath, mode, renderMode) {
  // 始终关闭旧窗口并重建，确保 renderMode 正确应用
  if (editorWindow && !editorWindow.isDestroyed()) {
    editorWindow.destroy();
    editorWindow = null;
  }

  editorWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Objector 编辑器',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  // Fix: 先存数据，再加载页面，渲染器就绪后主动拉取
  _pendingEditorInit = {
    path: projectPath,
    mode: mode || 'normal',
    render: renderMode || '2d',
  };

  const url = `file://${path.join(__dirname, 'editor.html')}`;
  editorWindow.loadURL(url);

  // 隐藏主页窗口
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }

  editorWindow.on('closed', () => {
    editorWindow = null;
    // 编辑器关闭后恢复主页窗口
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });

// IPC: 打开编辑器窗口
ipcMain.handle('open-editor', async (_e, projectPath, mode, renderMode) => {
  createEditorWindow(projectPath, mode, renderMode);
  return true;
});

// IPC: 渲染器请求获取编辑器初始化数据（解决中文路径编码问题）
ipcMain.handle('get-editor-init', async () => {
  const data = _pendingEditorInit;
  _pendingEditorInit = null;  // 取出后清空，防止重复获取
  return data;
});

// IPC: 打开文件夹选择对话框
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: 打开扩展文件选择对话框
ipcMain.handle('select-extension-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: '扩展文件', extensions: ['json', 'js'] },
      { name: 'JSON 扩展', extensions: ['json'] },
      { name: 'JavaScript 扩展', extensions: ['js'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: 打开扩展文档（跳转网页）
ipcMain.handle('open-extension-docs', async () => {
  shell.openExternal('https://tomlct2015.github.io/Objector-Coder/extension-api');
  return true;
});

// IPC: 读取文件
ipcMain.handle('read-file', async (_e, filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content;
  } catch (err) {
    console.error('[read-file] 失败:', filePath, err.message);
    return null;
  }
});

// IPC: 写入文件
ipcMain.handle('write-file', async (_e, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (err) {
    console.error('[write-file] 写入失败:', filePath, err.message);
    return { error: err.message };
  }
});

// IPC: 写入二进制文件（base64 编码）
ipcMain.handle('write-file-binary', async (_e, filePath, base64Content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    // 支持 data URL 格式 (data:image/png;base64,...)
    const base64 = base64Content.includes(',') ? base64Content.split(',')[1] : base64Content;
    fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
    return true;
  } catch (err) {
    console.error('[write-file-binary] 写入失败:', filePath, err.message);
    return { error: err.message };
  }
});

// IPC: 确保目录存在
ipcMain.handle('ensure-dir', async (_e, dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
    return true;
  } catch (err) {
    console.error('[ensure-dir]', dirPath, err.message);
    return { error: err.message };
  }
});

// IPC: 列出目录文件
ipcMain.handle('list-dir', async (_e, dirPath) => {
  try { return fs.readdirSync(dirPath); } catch { return []; }
});

// IPC: 判断路径是否为目录
ipcMain.handle('is-dir', async (_e, itemPath) => {
  try { return fs.statSync(itemPath).isDirectory(); } catch { return false; }
});

// IPC: 路径拼接
ipcMain.handle('path-join', (_e, ...args) => path.join(...args));

// IPC: 删除文件
ipcMain.handle('delete-file', async (_e, filePath) => {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  } catch { return false; }
});

// IPC: 重命名文件夹
ipcMain.handle('rename-folder', async (_e, oldPath, newPath) => {
  try {
    if (fs.existsSync(oldPath) && !fs.existsSync(newPath)) {
      fs.renameSync(oldPath, newPath);
      return { success: true, newPath };
    }
    if (fs.existsSync(newPath)) return { error: '目标路径已存在' };
    return { error: '原路径不存在' };
  } catch (err) {
    console.error('[rename-folder]', err.message);
    return { error: err.message };
  }
});

// IPC: 删除文件夹（递归删除）
ipcMain.handle('delete-folder', async (_e, folderPath) => {
  try {
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
    return { success: true };
  } catch (err) {
    console.error('[delete-folder]', err.message);
    return { error: err.message };
  }
});

// IPC: 选择图片文件（用于精灵贴图）
ipcMain.handle('select-image-file', async () => {
  const win = editorWindow && !editorWindow.isDestroyed() ? editorWindow : mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: 复制文件到目标路径（用于上传图片到项目 assets 目录）
ipcMain.handle('copy-file', async (_e, srcPath, destPath) => {
  try {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(srcPath, destPath);
    return true;
  } catch (err) {
    console.error('[copy-file] 复制失败:', err.message);
    return { error: err.message };
  }
});

// IPC: 读取二进制文件并返回 base64（用于图片预览）
ipcMain.handle('read-file-binary', async (_e, filePath) => {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.toString('base64');
  } catch (err) {
    console.error('[read-file-binary]', filePath, err.message);
    return null;
  }
});

// IPC: 选择音频文件（用于声音模块）
ipcMain.handle('select-audio-file', async () => {
  const win = editorWindow && !editorWindow.isDestroyed() ? editorWindow : mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [
      { name: '音频文件', extensions: ['mp3', 'wav', 'ogg', 'm4a', 'aac'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// IPC: 保存文件对话框
ipcMain.handle('save-file-dialog', async (_e, defaultName, filters) => {
  const win = editorWindow && !editorWindow.isDestroyed() ? editorWindow : mainWindow;
  const result = await dialog.showSaveDialog(win, {
    defaultPath: defaultName || 'output',
    filters: filters || [{ name: '所有文件', extensions: ['*'] }],
  });
  if (result.canceled) return null;
  return result.filePath;
});

// IPC: 递归读取目录下所有文件（返回 {path, content} 数组）
ipcMain.handle('read-dir-recursive', async (_e, dirPath) => {
  const results = [];
  function walk(dir, prefix) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      entries.forEach(e => {
        const full = path.join(dir, e.name);
        const rel = prefix ? prefix + '/' + e.name : e.name;
        if (e.isDirectory()) {
          walk(full, rel);
        } else if (e.isFile()) {
          try {
            const content = fs.readFileSync(full, 'utf-8');
            results.push({ path: rel, content });
          } catch {}
        }
      });
    } catch {}
  }
  walk(dirPath, '');
  return results;
});

// IPC: 窗口控制
ipcMain.handle('window-minimize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.minimize();
});

ipcMain.handle('window-maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  }
});

ipcMain.handle('window-close', () => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) win.close();
});

// IPC: 打开社区登录窗口
ipcMain.handle('open-community-login', async () => {
  const loginWin = new BrowserWindow({
    width: 480,
    height: 640,
    title: '社区登录',
    icon: APP_ICON,
    backgroundColor: '#0f0f1a',
    parent: editorWindow || mainWindow,
    modal: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // 加载社区登录页
  const loginUrl = 'https://tomlct2015.github.io/Objector-Coder/community/login.html';
  try {
    await loginWin.loadURL(loginUrl);
  } catch (e) {
    console.error('[社区登录] 加载失败:', e);
  }

  // 当窗口关闭时，编辑器可以尝试恢复 session
  return new Promise((resolve) => {
    loginWin.on('closed', () => {
      resolve(true);
    });
  });
});

// IPC: 打开添加节点子窗口（高级模式）
let _addNodeRequestId = 0;
ipcMain.handle('open-add-node-dialog', async (_e, types) => {
  const requestId = ++_addNodeRequestId;
  const parentWin = BrowserWindow.fromWebContents(_e.sender);

  const dialogWin = new BrowserWindow({
    width: 440,
    height: 560,
    title: '添加节点',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,
    parent: parentWin || editorWindow || mainWindow,
    modal: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  dialogWin.loadFile(path.join(__dirname, 'add-node-dialog.html'));

  return new Promise((resolve) => {
    let resolved = false;

    function cleanup() {
      ipcMain.removeListener('add-node-select', handler);
      ipcMain.removeListener('add-node-cancel', cancelHandler);
    }

    // 子窗口发回选中类型
    function handler(_evt, type) {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ requestId, type });
    }

    // 子窗口取消
    function cancelHandler() {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ requestId, type: null });
    }

    ipcMain.on('add-node-select', handler);
    ipcMain.on('add-node-cancel', cancelHandler);

    // 窗口关闭（未选择）
    dialogWin.on('closed', () => {
      if (resolved) return;
      resolved = true;
      cleanup();
      resolve({ requestId, type: null });
    });

    // 窗口加载完成后发送节点类型数据
    dialogWin.webContents.on('did-finish-load', () => {
      dialogWin.webContents.send('add-node-types', types);
    });
  });
});

// IPC: 在系统浏览器中打开 URL
ipcMain.handle('open-external', async (_e, url) => {
  try {
    shell.openExternal(url);
    return true;
  } catch (err) {
    console.error('[open-external]', err.message);
    return { error: err.message };
  }
});

// IPC: 打开 JS 代码编辑器窗口（非模态，独立窗口）
let _jsEditorWin = null;
let _jsEditorData = null;  // 暂存待发送的数据
let _jsEditorSender = null;  // 记录发起请求的 webContents

ipcMain.handle('open-js-editor', async (_e, data) => {
  // 关闭已有窗口
  if (_jsEditorWin && !_jsEditorWin.isDestroyed()) {
    _jsEditorWin.close();
  }

  _jsEditorData = data;  // { spriteIdx, name, code }
  _jsEditorSender = _e.sender;

  const parentWin = BrowserWindow.fromWebContents(_e.sender);
  _jsEditorWin = new BrowserWindow({
    width: 700,
    height: 550,
    title: 'JS 代码编辑器',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,  // 自定义标题栏（非 modal，不会卡死）
    parent: null,  // 非模态，可移动到其他屏幕
    resizable: true,
    minimizable: true,
    maximizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  _jsEditorWin.loadFile(path.join(__dirname, 'js-editor-window.html'));

  _jsEditorWin.on('closed', () => {
    _jsEditorWin = null;
    _jsEditorData = null;
  });

  return { ok: true };
});

// JS 编辑器窗口就绪，发送数据
ipcMain.on('js-editor-ready', (_e) => {
  if (_jsEditorWin && _jsEditorData && _jsEditorWin.webContents === _e.sender) {
    _jsEditorWin.webContents.send('js-editor-init', _jsEditorData);
  }
});

// JS 编辑器保存，转发代码到主编辑器窗口
ipcMain.on('js-editor-save', (_e, spriteIdx, code) => {
  if (_jsEditorSender && !_jsEditorSender.isDestroyed()) {
    _jsEditorSender.send('js-editor-code-updated', spriteIdx, code);
  }
});

// JS 编辑器窗口控制 - 使用 sender 直接获取窗口引用
ipcMain.on('js-editor-close-window', (_e) => {
  const win = BrowserWindow.fromWebContents(_e.sender);
  if (win && !win.isDestroyed()) win.close();
});
ipcMain.on('js-editor-confirm-close', async (_e, spriteIdx) => {
  const win = BrowserWindow.fromWebContents(_e.sender);
  if (!win || win.isDestroyed()) return;
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: ['取消', '不保存并关闭'],
    defaultId: 0,
    cancelId: 0,
    title: '未保存的更改',
    message: '有未保存的更改，确定关闭吗？',
  });
  if (response === 1 && !win.isDestroyed()) {
    win.close();
  }
});
ipcMain.on('js-editor-toggle-fullscreen', (_e) => {
  const win = BrowserWindow.fromWebContents(_e.sender);
  if (win && !win.isDestroyed()) {
    win.setFullScreen(!win.isFullScreen());
  }
});
ipcMain.on('js-editor-toggle-maximize', (_e) => {
  const win = BrowserWindow.fromWebContents(_e.sender);
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.restore();
    } else {
      win.maximize();
    }
  }
});
ipcMain.on('js-editor-minimize', (_e) => {
  const win = BrowserWindow.fromWebContents(_e.sender);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});
