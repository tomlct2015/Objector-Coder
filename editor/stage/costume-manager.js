/**
 * 造型管理器 - 全局造型库管理
 * 
 * 设计：所有图片存储在项目 assets/ 目录，多个精灵可共享同一造型。
 * 造型以文件名为键（如 "cat.png"），加载后的 Image 对象缓存在内存中。
 */
const CostumeManager = (function () {
  // 造型库：name -> { name, filePath, image, base64 }
  let _library = {};
  // 项目路径
  let _projectPath = '';
  // assets 目录
  const ASSETS_DIR = 'assets';

  function getAssetsPath() {
    return _projectPath + '/' + ASSETS_DIR;
  }

  /** 初始化：从项目 assets 目录加载已有造型 */
  async function init(projectPath) {
    _projectPath = projectPath;
    _library = {};

    const assetsPath = getAssetsPath();
    await window.api.ensureDir(assetsPath);

    const files = await window.api.listDir(assetsPath);
    const imageExts = /\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i;
    const imageFiles = files.filter(f => imageExts.test(f));

    for (const name of imageFiles) {
      const filePath = assetsPath + '/' + name;
      const entry = {
        name: name,
        filePath: filePath,
        image: null,
        base64: null,
      };
      // 预加载图片
      await _loadImage(entry);
      _library[name] = entry;
    }

    console.log(`[CostumeManager] 已加载 ${Object.keys(_library).length} 个造型`);
    return Object.keys(_library).length;
  }

  /** 加载单个造型的 Image 对象 */
  function _loadImage(entry) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        entry.image = img;
        resolve(true);
      };
      img.onerror = () => {
        console.warn('[CostumeManager] 加载失败:', entry.name);
        resolve(false);
      };
      img.src = 'file://' + entry.filePath;
    });
  }

  /** 上传图片到项目 assets 目录 */
  async function uploadCostume(srcFilePath) {
    if (!srcFilePath) return null;

    // 提取文件名
    const fileName = srcFilePath.split(/[\\/]/).pop();
    let destName = fileName;

    // 如果已存在同名文件，添加后缀
    let counter = 1;
    while (_library[destName]) {
      const ext = fileName.lastIndexOf('.') > 0 ? fileName.slice(fileName.lastIndexOf('.')) : '';
      const base = fileName.slice(0, fileName.length - ext.length);
      destName = base + '_' + counter + ext;
      counter++;
    }

    const destPath = getAssetsPath() + '/' + destName;
    const result = await window.api.copyFile(srcFilePath, destPath);

    if (result && result.error) {
      console.error('[CostumeManager] 复制失败:', result.error);
      return null;
    }

    // 创建造型条目
    const entry = {
      name: destName,
      filePath: destPath,
      image: null,
      base64: null,
    };

    await _loadImage(entry);
    _library[destName] = entry;

    return destName;
  }

  /** 删除造型 */
  async function deleteCostume(name) {
    const entry = _library[name];
    if (!entry) return false;

    await window.api.deleteFile(entry.filePath);
    delete _library[name];
    return true;
  }

  /** 获取造型的 Image 对象（用于渲染） */
  function getImage(name) {
    const entry = _library[name];
    return entry ? entry.image : null;
  }

  /** 获取造型的完整文件路径 */
  function getFilePath(name) {
    const entry = _library[name];
    return entry ? entry.filePath : null;
  }

  /** 获取造型的 base64 数据（用于序列化/HTML导出） */
  async function getBase64(name) {
    const entry = _library[name];
    if (!entry) return null;
    if (entry.base64) return entry.base64;

    const b64 = await window.api.readFileBinary(entry.filePath);
    if (b64) {
      entry.base64 = b64;
    }
    return b64;
  }

  /** 获取所有造型名称 */
  function getAllNames() {
    return Object.keys(_library);
  }

  /** 获取造型库数据（用于 UI 渲染） */
  function getLibrary() {
    return _library;
  }

  /** 获取造型数量 */
  function getCount() {
    return Object.keys(_library).length;
  }

  /** 判断造型是否存在 */
  function hasCostume(name) {
    return !!_library[name];
  }

  /** 获取项目路径 */
  function getProjectPath() {
    return _projectPath;
  }

  return {
    init, uploadCostume, deleteCostume,
    getImage, getFilePath, getBase64,
    getAllNames, getLibrary, getCount, hasCostume,
    getProjectPath, getAssetsPath,
  };
})();
