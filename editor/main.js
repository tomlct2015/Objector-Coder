const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');

if (require('electron-squirrel-startup')) app.quit();

const APP_ICON = path.join(__dirname, '..', 'Objector2.png');

let mainWindow;
let editorWindow;
let _pendingEditorInit = null;

// ========== 命令行参数解析（右键菜单 / 文件关联） ==========
let _startupProjectPath = null;

function parseProjectFromArgs(argv) {
  // 跳过 electron 和脚本路径，取第一个非标志参数
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const arg of args) {
    if (arg.startsWith('--')) continue;
    const resolved = path.resolve(arg);
    try {
      const stat = fs.statSync(resolved);
      if (stat.isDirectory()) {
        // 检查是否是 Objector 项目（含 project.json）
        if (fs.existsSync(path.join(resolved, 'project.json'))) {
          return resolved;
        }
        // 普通文件夹：检查是否可作为项目打开
        return resolved;
      }
      if (stat.isFile() && resolved.toLowerCase().endsWith('.zip')) {
        return resolved; // zip 文件，需要解压
      }
    } catch {}
  }
  return null;
}

_startupProjectPath = parseProjectFromArgs(process.argv);

// ========== 单实例锁（防止多开，支持右键菜单传递参数） ==========
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    // 第二个实例启动时，将参数传递给第一个实例
    const projectPath = parseProjectFromArgs(commandLine);
    if (projectPath && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send('open-project-from-args', projectPath);
    }
  });
}

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

app.whenReady().then(() => {
  createWindow();

  // 启动时如果有命令行传入的项目路径，发送给渲染器
  if (_startupProjectPath) {
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('open-project-from-args', _startupProjectPath);
      _startupProjectPath = null;
    });
  }
});
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

// IPC: 解压 ZIP 文件到临时目录并返回项目路径
ipcMain.handle('extract-zip-project', async (_e, zipPath) => {
  try {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // 在用户临时目录下创建解压目标
    const tmpBase = path.join(app.getPath('temp'), 'ObjectorProjects');
    if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });

    // 用 ZIP 文件名作为子目录名
    const baseName = path.basename(zipPath, '.zip');
    const destDir = path.join(tmpBase, baseName);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    zip.extractAllTo(destDir, true);

    // 检查解压后是否有 project.json，如果没有则创建一个
    if (!fs.existsSync(path.join(destDir, 'project.json'))) {
      // 检查是否在子目录中
      const subDirs = fs.readdirSync(destDir, { withFileTypes: true })
        .filter(e => e.isDirectory());
      if (subDirs.length === 1 && fs.existsSync(path.join(destDir, subDirs[0].name, 'project.json'))) {
        return path.join(destDir, subDirs[0].name);
      }
      // 创建默认的 project.json
      const config = {
        name: baseName,
        version: '1.0',
        mode: 'normal',
        renderMode: '2d',
        created: new Date().toISOString(),
        stageWidth: 480,
        stageHeight: 360,
      };
      fs.writeFileSync(path.join(destDir, 'project.json'), JSON.stringify(config, null, 2));
      if (!fs.existsSync(path.join(destDir, 'scripts'))) fs.mkdirSync(path.join(destDir, 'scripts'));
      fs.writeFileSync(path.join(destDir, 'scripts', 'main.json'), '{}');
    }

    return destDir;
  } catch (err) {
    console.error('[extract-zip-project]', err.message);
    // 回退：使用 PowerShell 解压
    try {
      const { execSync } = require('child_process');
      const tmpBase = path.join(app.getPath('temp'), 'ObjectorProjects');
      if (!fs.existsSync(tmpBase)) fs.mkdirSync(tmpBase, { recursive: true });
      const baseName = path.basename(zipPath, '.zip');
      const destDir = path.join(tmpBase, baseName);
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);
      // 检查子目录
      const subDirs = fs.readdirSync(destDir, { withFileTypes: true }).filter(e => e.isDirectory());
      if (subDirs.length === 1 && fs.existsSync(path.join(destDir, subDirs[0].name, 'project.json'))) {
        return path.join(destDir, subDirs[0].name);
      }
      if (!fs.existsSync(path.join(destDir, 'project.json'))) {
        const config = {
          name: baseName,
          version: '1.0',
          mode: 'normal',
          renderMode: '2d',
          created: new Date().toISOString(),
          stageWidth: 480,
          stageHeight: 360,
        };
        fs.writeFileSync(path.join(destDir, 'project.json'), JSON.stringify(config, null, 2));
        if (!fs.existsSync(path.join(destDir, 'scripts'))) fs.mkdirSync(path.join(destDir, 'scripts'));
        fs.writeFileSync(path.join(destDir, 'scripts', 'main.json'), '{}');
      }
      return destDir;
    } catch (err2) {
      return { error: err2.message };
    }
  }
});

// IPC: 运行代码（流式输出 + stdin 支持）
let _runningCodeProcess = null;
let _codeSender = null; // 记录发起运行的 webContents，用于推送流式输出

ipcMain.handle('run-code', async (_e, lang, code, projectPath) => {
  // 先杀掉上一个进程
  if (_runningCodeProcess) {
    try { _runningCodeProcess.kill(); } catch {}
    _runningCodeProcess = null;
  }
  _codeSender = _e.sender;

  const tmpDir = path.join(app.getPath('temp'), 'ObjectorCodeRun');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  // 通用：用 spawn 启动进程，流式推送 stdout/stderr
  function runWithSpawn(cmd, args, label) {
    return new Promise((resolve) => {
      try {
        const child = spawn(cmd, args, {
          cwd: projectPath || tmpDir,
          env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONDONTWRITEBYTECODE: '1' },
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        _runningCodeProcess = child;

        child.stdout.on('data', (data) => {
          const text = data.toString('utf-8');
          if (_codeSender && !_codeSender.isDestroyed()) {
            _codeSender.send('code-output', text);
          }
        });
        child.stderr.on('data', (data) => {
          const text = data.toString('utf-8');
          if (_codeSender && !_codeSender.isDestroyed()) {
            _codeSender.send('code-output', text, 'stderr');
          }
        });
        child.on('close', (exitCode) => {
          _runningCodeProcess = null;
          if (_codeSender && !_codeSender.isDestroyed()) {
            _codeSender.send('code-done', exitCode);
          }
          resolve({ ok: true, exitCode });
        });
        child.on('error', (err) => {
          _runningCodeProcess = null;
          if (_codeSender && !_codeSender.isDestroyed()) {
            _codeSender.send('code-output', '❌ ' + err.message, 'stderr');
            _codeSender.send('code-done', 1);
          }
          resolve({ error: true, message: err.message });
        });
      } catch (err) {
        resolve({ error: true, message: err.message });
      }
    });
  }

  // === JavaScript ===
  if (lang === 'javascript') {
    const nodePath = process.execPath;
    const codeFile = path.join(tmpDir, 'main.js');
    const wrappedCode = `
process.stdout.write = (function(orig) {
  return function(chunk) { return orig.call(process.stdout, chunk); };
})(process.stdout.write.bind(process.stdout));
try {
${code}
} catch(e) {
  process.stderr.write('❌ ' + e.message + '\\n');
}
`;
    fs.writeFileSync(codeFile, wrappedCode, 'utf-8');
    return runWithSpawn(nodePath, [codeFile], 'node');
  }

  // === Python ===
  if (lang === 'python') {
    const pythonPaths = [
      'python', 'python3', 'py',
      'C:\\Python39\\python.exe', 'C:\\Python310\\python.exe', 'C:\\Python311\\python.exe',
      'C:\\Python312\\python.exe', 'C:\\Python313\\python.exe',
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python313', 'python.exe'),
    ];
    let pythonExe = null;
    for (const p of pythonPaths) {
      try {
        if (p === 'python' || p === 'python3' || p === 'py') {
          const r = require('child_process').execFileSync(p, ['--version'], { timeout: 3000, encoding: 'utf-8' });
          if (r && r.includes('Python')) { pythonExe = p; break; }
        } else if (fs.existsSync(p)) {
          pythonExe = p; break;
        }
      } catch {}
    }
    if (!pythonExe) {
      if (_codeSender && !_codeSender.isDestroyed()) {
        _codeSender.send('code-output', '❌ 未找到 Python 解释器。\n\n请安装 Python: https://www.python.org/downloads/\n或确认 Python 已添加到 PATH 环境变量。', 'stderr');
        _codeSender.send('code-done', 1);
      }
      return { error: true, message: 'Python not found' };
    }
    const codeFile = path.join(tmpDir, 'main.py');
    // 用 -u 参数强制无缓冲输出
    fs.writeFileSync(codeFile, code, 'utf-8');
    // 发送解释器信息
    if (_codeSender && !_codeSender.isDestroyed()) {
      _codeSender.send('code-output', '[' + pythonExe + ']\n');
    }
    return runWithSpawn(pythonExe, ['-u', codeFile], 'python');
  }

  // === C++ ===
  if (lang === 'cpp') {
    const gppPaths = [
      'g++',
      'C:\\msys64\\ucrt64\\bin\\g++.exe',
      'C:\\msys64\\mingw64\\bin\\g++.exe',
      'C:\\mingw64\\bin\\g++.exe',
      'C:\\MinGW\\bin\\g++.exe',
      'C:\\TDM-GCC-64\\bin\\g++.exe',
    ];
    let gppExe = null;
    for (const p of gppPaths) {
      try {
        if (p === 'g++') {
          const r = require('child_process').execFileSync(p, ['--version'], { timeout: 3000, encoding: 'utf-8' });
          if (r) { gppExe = p; break; }
        } else if (fs.existsSync(p)) {
          gppExe = p; break;
        }
      } catch {}
    }
    if (!gppExe) {
      if (_codeSender && !_codeSender.isDestroyed()) {
        _codeSender.send('code-output', '❌ 未找到 C++ 编译器 (g++)。\n\n请安装 MinGW-w64: https://www.mingw-w64.org/\n或确认 g++ 已添加到 PATH 环境变量。', 'stderr');
        _codeSender.send('code-done', 1);
      }
      return { error: true, message: 'g++ not found' };
    }
    const srcFile = path.join(tmpDir, 'main.cpp');
    const exeFile = path.join(tmpDir, process.platform === 'win32' ? 'main.exe' : 'main');
    fs.writeFileSync(srcFile, code, 'utf-8');

    // 先编译（阻塞）
    if (_codeSender && !_codeSender.isDestroyed()) {
      _codeSender.send('code-output', '⏳ 编译中...\n');
    }
    return new Promise((resolve) => {
      execFile(gppExe, ['-o', exeFile, srcFile, '-std=c++17'], { timeout: 30000 }, (compileErr, compileOut, compileErr2) => {
        if (compileErr || (compileErr2 && compileErr2.trim())) {
          if (_codeSender && !_codeSender.isDestroyed()) {
            _codeSender.send('code-output', '❌ 编译失败:\n' + (compileErr2 || compileErr.message), 'stderr');
            _codeSender.send('code-done', 1);
          }
          resolve({ error: true, message: 'compile failed' });
          return;
        }
        if (_codeSender && !_codeSender.isDestroyed()) {
          _codeSender.send('code-output', '[' + gppExe + '] 编译成功\n');
        }
        runWithSpawn(exeFile, [], 'cpp').then(resolve);
      });
    });
  }

  return { output: '❌ 不支持的语言: ' + lang, error: true };
});

// IPC: 向正在运行的进程发送 stdin（用于 input()）
ipcMain.handle('code-stdin', async (_e, text) => {
  if (_runningCodeProcess && _runningCodeProcess.stdin && !_runningCodeProcess.stdin.destroyed) {
    _runningCodeProcess.stdin.write(text + '\n');
    return { ok: true };
  }
  return { ok: false, error: '没有正在运行的进程' };
});

// IPC: 停止正在运行的代码
ipcMain.handle('stop-code', async () => {
  if (_runningCodeProcess) {
    try { _runningCodeProcess.kill('SIGTERM'); } catch {}
    _runningCodeProcess = null;
    return { stopped: true };
  }
  return { stopped: false };
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

// ========== AI 助手窗口 ==========
let aiWindow = null;
let _aiAbortController = null;

// IPC: 打开 AI 窗口
ipcMain.handle('open-ai-window', async (_e, initData) => {
  if (aiWindow && !aiWindow.isDestroyed()) {
    aiWindow.focus();
    // 发送最新数据
    aiWindow.webContents.send('ai-block-catalog', initData?.blockCatalog || '');
    aiWindow.webContents.send('ai-current-blocks', initData?.currentBlocks || '');
    return true;
  }

  aiWindow = new BrowserWindow({
    width: 520,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    title: 'Objector AI 助手',
    icon: APP_ICON,
    backgroundColor: '#1e1e2e',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  aiWindow.loadFile(path.join(__dirname, 'ai-window.html'));

  aiWindow.webContents.on('did-finish-load', () => {
    if (initData) {
      aiWindow.webContents.send('ai-block-catalog', initData.blockCatalog || '');
      aiWindow.webContents.send('ai-current-blocks', initData.currentBlocks || '');
    }
  });

  aiWindow.on('closed', () => { aiWindow = null; });
  return true;
});

// IPC: AI 流式聊天
ipcMain.handle('ai-stream-chat', async (_e, messages) => {
  const config = _getAIConfig();
  if (!config.apiKey && config.provider !== 'ollama') {
    return { error: '请先配置 AI API Key' };
  }

  // 定义工具
  const tools = [
    {
      type: 'function',
      function: {
        name: 'generate_blocks',
        description: '根据描述生成积木并添加到编辑区。传入积木 JSON 数组。',
        parameters: {
          type: 'object',
          properties: {
            blocks: {
              type: 'array',
              description: '积木数组',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', description: '积木类型 ID' },
                  params: { type: 'object', description: '积木参数' },
                  x: { type: 'number' }, y: { type: 'number' },
                },
                required: ['type'],
              },
            },
          },
          required: ['blocks'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'modify_blocks',
        description: '修改或删除现有积木。action: delete(删除), move(移动), update(更新参数)',
        parameters: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['delete', 'move', 'update'] },
            blockIds: { type: 'array', items: { type: 'string' } },
            params: { type: 'object' },
            x: { type: 'number' }, y: { type: 'number' },
          },
          required: ['action', 'blockIds'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'screenshot',
        description: '截取当前积木编辑区的截图，返回 base64 图片',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'fetch_url',
        description: '获取网页内容用于回答用户问题',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '网页 URL' },
          },
          required: ['url'],
        },
      },
    },
  ];

  const sender = _e.sender;
  _aiAbortController = new AbortController();

  try {
    const url = config.baseUrl + '/chat/completions';
    const headers = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers['Authorization'] = 'Bearer ' + config.apiKey;

    const body = {
      model: config.model,
      messages,
      tools,
      stream: true,
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.7,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: _aiAbortController.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      return { error: `API ${response.status}: ${errText.slice(0, 200)}` };
    }

    // Process SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    let toolCalls = {};

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          if (!delta) continue;

          // Text content
          if (delta.content) {
            fullContent += delta.content;
            if (!sender.isDestroyed()) {
              sender.send('ai-stream-token', delta.content);
            }
          }

          // Tool calls
          if (delta.tool_calls) {
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, name: '', arguments: '' };
              }
              if (tc.function?.name) toolCalls[tc.index].name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].arguments += tc.function.arguments;
            }
          }
        } catch {}
      }
    }

    // Send done
    if (!sender.isDestroyed()) {
      sender.send('ai-stream-done', fullContent);
    }

    // Process tool calls
    for (const tc of Object.values(toolCalls)) {
      if (tc.name && tc.id) {
        try {
          const args = JSON.parse(tc.arguments);
          if (!sender.isDestroyed()) {
            sender.send('ai-tool-call', { name: tc.name, args, id: tc.id });
          }
        } catch {}
      }
    }

    return { ok: true };
  } catch (e) {
    if (e.name === 'AbortError') {
      if (!sender.isDestroyed()) sender.send('ai-stream-done', fullContent || '');
      return { ok: true };
    }
    return { error: e.message };
  }
});

// IPC: 停止流式生成
ipcMain.handle('ai-stop-stream', () => {
  if (_aiAbortController) {
    _aiAbortController.abort();
    _aiAbortController = null;
  }
  return true;
});

// IPC: 执行工具（从 AI 窗口调用）
ipcMain.handle('ai-execute-tool', async (_e, name, args) => {
  const targetWin = editorWindow && !editorWindow.isDestroyed() ? editorWindow : mainWindow;
  if (!targetWin) return '编辑器窗口未打开';

  if (name === 'screenshot') {
    // 截取编辑器画布
    try {
      const image = await targetWin.webContents.capturePage();
      const buffer = image.toPNG();
      return 'data:image/png;base64,' + buffer.toString('base64');
    } catch (e) {
      return '截图失败: ' + e.message;
    }
  }

  if (name === 'generate_blocks' || name === 'modify_blocks') {
    // 转发给编辑器执行
    return new Promise((resolve) => {
      targetWin.webContents.send('ai-execute-tool', name, args);
      ipcMain.once('ai-tool-exec-result', (_evt, result) => {
        resolve(result);
      });
    });
  }

  if (name === 'fetch_url') {
    try {
      const resp = await fetch(args.url, {
        headers: { 'User-Agent': 'Objector AI Assistant' },
        signal: AbortSignal.timeout(15000),
      });
      const text = await resp.text();
      // 简单提取正文
      const cleaned = text.replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
      return cleaned || '无法获取网页内容';
    } catch (e) {
      return '获取失败: ' + e.message;
    }
  }

  return '未知工具: ' + name;
});

// IPC: 工具执行结果回传给 AI 窗口
ipcMain.handle('ai-tool-result', async (_e, toolId, result) => {
  // This is handled in the AI window's JS
  return true;
});

// IPC: 获取当前积木数据（AI 窗口调用）
ipcMain.handle('ai-get-current-blocks', async () => {
  const targetWin = editorWindow && !editorWindow.isDestroyed() ? editorWindow : mainWindow;
  if (!targetWin) return '';
  return new Promise((resolve) => {
    targetWin.webContents.send('ai-request-blocks');
    ipcMain.once('ai-blocks-response', (_evt, blocks) => {
      resolve(blocks);
    });
  });
});

// IPC: AI 配置管理
function _getAIConfig() {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'ai-config.json');
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
    }
  } catch {}
  return { provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '', maxTokens: 2048, temperature: 0.7 };
}

ipcMain.handle('get-ai-config', () => {
  return _getAIConfig();
});

ipcMain.handle('save-ai-config', (_e, cfg) => {
  try {
    const cfgPath = path.join(app.getPath('userData'), 'ai-config.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
});
