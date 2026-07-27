/**
 * 精灵类
 * 
 * 造型系统改造：
 * - costumeName 存储造型文件名（如 "cat.png"），对应 CostumeManager 中的键
 * - costumeImage 通过 CostumeManager.getImage(costumeName) 动态获取
 * - 多个精灵可共享同一造型，共享同一 Image 对象（节省内存）
 */
class Sprite {
  constructor(name, x, y) {
    this.name = name || '精灵' + Date.now().toString(36).slice(-4);
    this.x = x || 0;
    this.y = y || 0;
    this.direction = 90;
    this.size = 100;
    this.visible = true;
    this.costume = 'default';
    // 造型：存储文件名，Image 从 CostumeManager 获取
    this.costumeName = '';       // 造型文件名（如 "cat.png"）
    this.costumePath = '';       // 兼容旧版：完整路径（仅用于旧项目兼容）
    this.sayText = '';
    this.color = '#4C97FF';
    this.penDown = false;
    // 速度系统
    this.vx = 0;
    this.vy = 0;
    // 旋转模式: 'allAround' | 'leftRight' | 'noRotate'
    this.rotationStyle = 'allAround';
    // 位置历史（最多 50 步）
    this._posHistory = [];
  }

  /** 获取当前造型的 Image 对象（从 CostumeManager） */
  get costumeImage() {
    if (this.costumeName && typeof CostumeManager !== 'undefined') {
      return CostumeManager.getImage(this.costumeName);
    }
    // 兼容旧版：如果 costumePath 存在但 CostumeManager 没有，返回 null
    return null;
  }

  /** 设置造型（通过 CostumeManager 中的名称） */
  setCostume(name) {
    if (name && typeof CostumeManager !== 'undefined' && CostumeManager.hasCostume(name)) {
      this.costumeName = name;
      this.costumePath = CostumeManager.getFilePath(name) || '';
      return true;
    }
    return false;
  }

  /** 加载贴图（兼容旧版：直接从路径加载） */
  loadCostume(imagePath) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.costumePath = imagePath;
        // 从路径推断文件名
        const name = imagePath.split(/[\\/]/).pop();
        this.costumeName = name;
        resolve(true);
      };
      img.onerror = () => {
        this.costumePath = '';
        this.costumeName = '';
        resolve(false);
      };
      img.src = 'file://' + imagePath;
    });
  }

  /** 清除贴图，恢复默认 */
  clearCostume() {
    this.costumeName = '';
    this.costumePath = '';
  }
}
