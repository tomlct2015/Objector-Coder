/**
 * 侦测输入追踪器 - 追踪鼠标/键盘状态
 */
const SensingInput = (function () {
  let _mouseX = 0;
  let _mouseY = 0;
  let _mouseDown = false;
  let _keysDown = {};  // key -> true
  let _timerStart = Date.now();

  function init(canvasEl) {
    // 鼠标移动
    canvasEl.addEventListener('mousemove', (e) => {
      const rect = canvasEl.getBoundingClientRect();
      // 转换为舞台坐标（中心为 0,0）
      _mouseX = e.clientX - rect.left - rect.width / 2;
      _mouseY = -(e.clientY - rect.top - rect.height / 2);  // y 轴翻转
    });

    // 鼠标按下/释放
    canvasEl.addEventListener('mousedown', () => { _mouseDown = true; });
    canvasEl.addEventListener('mouseup', () => { _mouseDown = false; });

    // 键盘
    document.addEventListener('keydown', (e) => {
      const mapped = mapKey(e.key);
      _keysDown[mapped] = true;
    });

    document.addEventListener('keyup', (e) => {
      const mapped = mapKey(e.key);
      _keysDown[mapped] = false;
    });
  }

  function mapKey(key) {
    const map = {
      ' ': 'space',
      'ArrowUp': 'up', 'ArrowDown': 'down', 'ArrowLeft': 'left', 'ArrowRight': 'right',
      'Enter': 'enter', 'Shift': 'shift', 'Control': 'control', 'Alt': 'alt',
      'Escape': 'escape', 'Tab': 'tab', 'Backspace': 'backspace',
    };
    return map[key] || key.toLowerCase();
  }

  function getMouseX() { return _mouseX; }
  function getMouseY() { return _mouseY; }
  function isMouseDown() { return _mouseDown; }
  function isKeyPressed(key) {
    const k = String(key).toLowerCase().trim();
    return !!_keysDown[k];
  }

  function getTimer() {
    return (Date.now() - _timerStart) / 1000;  // 秒
  }

  function resetTimer() {
    _timerStart = Date.now();
  }

  return {
    init, getMouseX, getMouseY, isMouseDown, isKeyPressed,
    getTimer, resetTimer, _mapKey: mapKey,
  };
})();
