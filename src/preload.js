const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectExtensionFile: () => ipcRenderer.invoke('select-extension-file'),
  selectImageFile: () => ipcRenderer.invoke('select-image-file'),
  selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
  copyFile: (src, dest) => ipcRenderer.invoke('copy-file', src, dest),
  readFileBinary: (p) => ipcRenderer.invoke('read-file-binary', p),
  openExtensionDocs: () => ipcRenderer.invoke('open-extension-docs'),
  openEditor: (projectPath, mode, renderMode) => ipcRenderer.invoke('open-editor', projectPath, mode, renderMode),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, c) => ipcRenderer.invoke('write-file', p, c),
  ensureDir: (d) => ipcRenderer.invoke('ensure-dir', d),
  listDir: (d) => ipcRenderer.invoke('list-dir', d),
  isDir: (p) => ipcRenderer.invoke('is-dir', p),
  pathJoin: (...args) => ipcRenderer.invoke('path-join', ...args),
  deleteFile: (p) => ipcRenderer.invoke('delete-file', p),
  renameFolder: (oldPath, newPath) => ipcRenderer.invoke('rename-folder', oldPath, newPath),
  deleteFolder: (folderPath) => ipcRenderer.invoke('delete-folder', folderPath),
  saveFileDialog: (defaultName, filters) => ipcRenderer.invoke('save-file-dialog', defaultName, filters),
  readDirRecursive: (d) => ipcRenderer.invoke('read-dir-recursive', d),
  // 监听加载项目事件（编辑器窗口使用）
  onLoadProject: (callback) => ipcRenderer.on('load-project', (_e, path, mode, renderMode) => callback(path, mode, renderMode)),
  // 窗口控制
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  // 社区
  openCommunityLogin: () => ipcRenderer.invoke('open-community-login'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  // 添加节点子窗口（高级模式）
  openAddNodeDialog: (types) => ipcRenderer.invoke('open-add-node-dialog', types),
  // JS 代码编辑器窗口
  openJsEditor: (data) => ipcRenderer.invoke('open-js-editor', data),
  onJsEditorCodeUpdated: (callback) => ipcRenderer.on('js-editor-code-updated', (_e, spriteIdx, code) => callback(spriteIdx, code)),
});
