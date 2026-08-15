/**
 * 积木面板 - 左侧分类和积木列表
 */
const Palette = (function () {
  let currentCategory = 'events';
  let paletteCanvas = null;
  let _dragBound = false;

  function init() {
    const catContainer = document.getElementById('palette-categories');
    const blocksContainer = document.getElementById('palette-blocks');

    // 清空旧内容，避免重复
    catContainer.innerHTML = '';
    blocksContainer.innerHTML = '';

    // 渲染分类按钮
    const allCats = BlockRegistry.getCategories();
    const filteredCats = (typeof DevMode !== 'undefined') ? DevMode.filterCategories(allCats) : allCats;
    filteredCats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat.id === currentCategory ? ' active' : '');
      // 新手模式下标记高级分类
      if (typeof DevMode !== 'undefined' && DevMode.isBeginner() && DevMode.BEGINNER_ADVANCED.includes(cat.id)) {
        btn.classList.add('advanced-hint');
      }
      btn.textContent = (typeof i18n !== 'undefined') ? i18n.t('categories.' + cat.id, cat.name) : cat.name;
      btn.style.color = cat.color;
      btn.dataset.catId = cat.id;
      btn.addEventListener('click', () => {
        currentCategory = cat.id;
        catContainer.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderBlocks();
      });
      catContainer.appendChild(btn);
    });

    renderBlocks();

    // 绑定拖拽事件（只在首次绑定时生效）
    if (!_dragBound) {
      blocksContainer.addEventListener('mousedown', onPaletteMouseDown);
      _dragBound = true;
    }
  }

  function renderBlocks() {
    const container = document.getElementById('palette-blocks');
    container.innerHTML = '';

    const blocks = BlockRegistry.getBlocksByCategory(currentCategory);
    const cat = BlockRegistry.getCategory(currentCategory);

    // 新手模式提示
    if (typeof DevMode !== 'undefined' && DevMode.isBeginner() && DevMode.BEGINNER_ADVANCED.includes(currentCategory)) {
      const tip = document.createElement('div');
      tip.style.cssText = 'font-size:11px;color:var(--yellow);padding:4px 6px;background:rgba(249,226,175,0.1);border-radius:4px;margin-bottom:4px;';
      tip.textContent = (typeof i18n !== 'undefined') ? i18n.t('beginnerTip') : '⭐ 高级分类：适合有一定基础的用户';
      container.appendChild(tip);
    }

    blocks.forEach(def => {
      // 使用小 Canvas 绘制积木预览
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'cursor:grab;padding:2px 0;';
      wrapper.dataset.blockType = def.type;

      const c = document.createElement('canvas');
      const preview = BlockRegistry.createBlock(def.type, 0, 0);
      const sz = BlockRenderer.measureBlock(preview);
      c.width = sz.w + 4;
      c.height = sz.h + 4;
      c.style.cssText = 'display:block;';

      const ctx = c.getContext('2d');
      ctx.translate(2, 2);
      preview.x = 0; preview.y = 0;
      BlockRenderer.drawBlock(ctx, preview, false, null);

      wrapper.appendChild(c);
      container.appendChild(wrapper);
    });
  }

  let draggingType = null;
  let dragGhost = null;

  function onPaletteMouseDown(e) {
    const wrapper = e.target.closest('[data-block-type]');
    if (!wrapper) return;
    draggingType = wrapper.dataset.blockType;

    // 创建拖拽幽灵
    dragGhost = document.createElement('div');
    dragGhost.style.cssText = 'position:fixed;pointer-events:none;z-index:9999;opacity:0.7;';
    const c = document.createElement('canvas');
    const preview = BlockRegistry.createBlock(draggingType, 0, 0);
    const sz = BlockRenderer.measureBlock(preview);
    c.width = sz.w; c.height = sz.h;
    const ctx = c.getContext('2d');
    preview.x = 0; preview.y = 0;
    BlockRenderer.drawBlock(ctx, preview, false, null);
    dragGhost.appendChild(c);
    document.body.appendChild(dragGhost);
    dragGhost.style.left = (e.clientX - sz.w / 2) + 'px';
    dragGhost.style.top = (e.clientY - sz.h / 2) + 'px';

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (dragGhost) {
      const sz = dragGhost.querySelector('canvas');
      dragGhost.style.left = (e.clientX - sz.width / 2) + 'px';
      dragGhost.style.top = (e.clientY - sz.height / 2) + 'px';
    }
  }

  function onDragEnd(e) {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);

    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
    }

    if (!draggingType) return;

    // 确定放置目标：普通模式用 editor-panel，高级模式用 canvas 本身
    let targetEl = null;
    const advancedLayout = document.getElementById('advanced-layout');
    const isAdvanced = advancedLayout && !advancedLayout.classList.contains('hidden');

    if (isAdvanced && typeof EditorCanvas !== 'undefined' && EditorCanvas.getCanvas) {
      // 高级模式：canvas 被移入 script-blocks-content，用 canvas 本身作为目标
      targetEl = EditorCanvas.getCanvas();
    } else {
      targetEl = document.getElementById('editor-panel');
    }

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 &&
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top && e.clientY <= rect.bottom) {
        EditorCanvas.addBlockFromPalette(draggingType, e.clientX - rect.left, e.clientY - rect.top);
      }
    }

    draggingType = null;
  }

  return { init };
})();
