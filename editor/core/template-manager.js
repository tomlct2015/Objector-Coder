/**
 * 项目模板管理器 - 提供预设模板快速创建项目
 */
const TemplateManager = (function () {
  // 内置模板定义
  const TEMPLATES = {
    // ========== 基础模板 ==========
    'blank': {
      name: '空白项目',
      nameEn: 'Blank Project',
      icon: '📄',
      desc: '从空白开始创建',
      descEn: 'Start from scratch',
      blocks: {},
    },

    // ========== 游戏模板 ==========
    'catch-game': {
      name: '接物游戏',
      nameEn: 'Catch Game',
      icon: '🎮',
      desc: '用键盘控制角色接住掉落物品',
      descEn: 'Use keyboard to catch falling items',
      blocks: _createCatchGameBlocks(),
    },
    'platformer': {
      name: '平台跳跃',
      nameEn: 'Platformer',
      icon: '🏃',
      desc: '经典横版跳跃游戏',
      descEn: 'Classic side-scrolling jump game',
      blocks: _createPlatformerBlocks(),
    },
    'pong': {
      name: '乒乓球',
      nameEn: 'Pong Game',
      icon: '🏓',
      desc: '经典双人乒乓球对战',
      descEn: 'Classic two-player pong game',
      blocks: _createPongBlocks(),
    },

    // ========== 动画模板 ==========
    'bouncing-ball': {
      name: '弹跳小球',
      nameEn: 'Bouncing Ball',
      icon: '⚽',
      desc: '物理效果：重力、反弹',
      descEn: 'Physics: gravity and bounce',
      blocks: _createBouncingBallBlocks(),
    },
    'solar-system': {
      name: '太阳系动画',
      nameEn: 'Solar System',
      icon: '🌍',
      desc: '行星围绕太阳旋转',
      descEn: 'Planets orbiting the sun',
      blocks: _createSolarSystemBlocks(),
    },

    // ========== 工具模板 ==========
    'calculator': {
      name: '计算器',
      nameEn: 'Calculator',
      icon: '🧮',
      desc: '简单的数学计算器',
      descEn: 'Simple math calculator',
      blocks: _createCalculatorBlocks(),
    },
    'drawing': {
      name: '画图工具',
      nameEn: 'Drawing Tool',
      icon: '🎨',
      desc: '鼠标绘图程序',
      descEn: 'Mouse drawing program',
      blocks: _createDrawingBlocks(),
    },
  };

  // ========== 模板积木生成器 ==========

  function _createCatchGameBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    // event_start -> forever loop with key controls
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200, {}, 'tpl_forever');
    blocks[start].ports.flowOut = forever;
    
    // Inside forever: if key pressed, move
    const ifRight = b('control_if', 150, 300, {}, 'tpl_if_right');
    const keyRight = b('sensing_key_pressed', 180, 330, { key: 'ArrowRight' }, 'tpl_key_right');
    const moveRight = b('motion_change_x', 200, 380, { dx: 10 }, 'tpl_move_right');
    
    blocks[forever].ports.subBlocks = [ifRight];
    blocks[ifRight].ports.params = { condition: keyRight };
    blocks[ifRight].ports.subBlocks = [moveRight];

    // Another if for left key
    const ifLeft = b('control_if', 400, 300, {}, 'tpl_if_left');
    const keyLeft = b('sensing_key_pressed', 430, 330, { key: 'ArrowLeft' }, 'tpl_key_left');
    const moveLeft = b('motion_change_x', 450, 380, { dx: -10 }, 'tpl_move_left');
    
    blocks[forever].ports.subBlocks.push(ifLeft);
    blocks[ifLeft].ports.params = { condition: keyLeft };
    blocks[ifLeft].ports.subBlocks = [moveLeft];

    return blocks;
  }

  function _createPlatformerBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200);
    blocks[start].ports.flowOut = forever;

    // Gravity
    const gravity = b('motion_set_physics', 150, 300, { gravity: 0.5 }, 'tpl_gravity');
    blocks[forever].ports.subBlocks = [gravity];

    // Jump on space
    const ifSpace = b('control_if', 350, 300, {}, 'tpl_if_space');
    const keySpace = b('sensing_key_pressed', 380, 330, { key: 'Space' }, 'tpl_key_space');
    const jump = b('motion_set_velocity_y', 400, 380, { vy: -10 }, 'tpl_jump');
    
    blocks[forever].ports.subBlocks.push(ifSpace);
    blocks[ifSpace].ports.params = { condition: keySpace };
    blocks[ifSpace].ports.subBlocks = [jump];

    return blocks;
  }

  function _createPongBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200);
    blocks[start].ports.flowOut = forever;

    // Ball movement
    const moveBall = b('motion_move_steps', 150, 300, { steps: 5 }, 'tpl_move_ball');
    blocks[forever].ports.subBlocks = [moveBall];

    // Edge bounce
    const ifEdge = b('control_if', 300, 300, {}, 'tpl_if_edge');
    const touchingEdge = b('sensing_touching_edge', 330, 330, {}, 'tpl_touch_edge');
    const bounce = b('motion_turn_degrees', 350, 380, { degrees: 180 }, 'tpl_bounce');
    
    blocks[forever].ports.subBlocks.push(ifEdge);
    blocks[ifEdge].ports.params = { condition: touchingEdge };
    blocks[ifEdge].ports.subBlocks = [bounce];

    return blocks;
  }

  function _createBouncingBallBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200);
    blocks[start].ports.flowOut = forever;

    // Gravity and bounce
    const gravity = b('motion_set_physics', 150, 300, { gravity: 0.3 }, 'tpl_gravity2');
    blocks[forever].ports.subBlocks = [gravity];

    // Floor bounce
    const ifFloor = b('control_if', 350, 300, {}, 'tpl_if_floor');
    const sensing = b('sensing_touching_edge', 380, 330, {}, 'tpl_sense_floor');
    const bounceUp = b('motion_set_velocity_y', 400, 380, { vy: -8 }, 'tpl_bounce_up');
    
    blocks[forever].ports.subBlocks.push(ifFloor);
    blocks[ifFloor].ports.params = { condition: sensing };
    blocks[ifFloor].ports.subBlocks = [bounceUp];

    return blocks;
  }

  function _createSolarSystemBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200);
    blocks[start].ports.flowOut = forever;

    // Rotate around center
    const rotate = b('motion_turn_degrees', 150, 300, { degrees: 2 }, 'tpl_orbit');
    blocks[forever].ports.subBlocks = [rotate];

    return blocks;
  }

  function _createCalculatorBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const ask = b('sensing_ask', 100, 200, { question: '输入数字:' }, 'tpl_ask');
    const say = b('looks_say', 100, 300, { text: '' }, 'tpl_say');
    
    blocks[start].ports.flowOut = ask;
    blocks[ask].ports.flowOut = say;

    return blocks;
  }

  function _createDrawingBlocks() {
    const blocks = {};
    const b = (type, x, y, params, id) => {
      const bid = id || 'tpl_' + Math.random().toString(36).slice(2, 8);
      blocks[bid] = { id: bid, type, x, y, params: params || {}, ports: {} };
      return bid;
    };
    
    const start = b('event_start', 100, 100);
    const forever = b('control_forever', 100, 200);
    blocks[start].ports.flowOut = forever;

    // Follow mouse
    const goToMouse = b('motion_goto_mouse', 150, 300, {}, 'tpl_goto_mouse');
    blocks[forever].ports.subBlocks = [goToMouse];

    // If mouse down, draw
    const ifDown = b('control_if', 350, 300, {}, 'tpl_if_down');
    const sensing = b('sensing_mouse_down', 380, 330, {}, 'tpl_mouse_down');
    const penDown = b('looks_set_size', 400, 380, { size: 5 }, 'tpl_pen');
    
    blocks[forever].ports.subBlocks.push(ifDown);
    blocks[ifDown].ports.params = { condition: sensing };
    blocks[ifDown].ports.subBlocks = [penDown];

    return blocks;
  }

  /** 获取所有模板 */
  function getTemplates() {
    return Object.entries(TEMPLATES).map(([id, tpl]) => ({
      id,
      name: i18n.isEnglish() ? tpl.nameEn : tpl.name,
      icon: tpl.icon,
      desc: i18n.isEnglish() ? tpl.descEn : tpl.desc,
    }));
  }

  /** 获取指定模板的积木数据 */
  function getTemplateBlocks(templateId) {
    const tpl = TEMPLATES[templateId];
    if (!tpl) return {};
    // 深拷贝并生成新的 ID
    return JSON.parse(JSON.stringify(tpl.blocks));
  }

  /** 检查模板是否存在 */
  function hasTemplate(templateId) {
    return !!TEMPLATES[templateId];
  }

  /** 显示模板选择对话框 */
  function showTemplateDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-prompt-overlay';
      
      const templates = getTemplates();
      const cards = templates.map(t => `
        <div class="template-card" data-id="${t.id}" style="cursor:pointer;padding:16px;background:var(--bg-surface);border:1px solid var(--border);border-radius:8px;text-align:center;transition:all .2s;">
          <div style="font-size:36px;margin-bottom:8px;">${t.icon}</div>
          <div style="font-weight:600;margin-bottom:4px;">${t.name}</div>
          <div style="font-size:12px;color:var(--text-muted);">${t.desc}</div>
        </div>
      `).join('');

      overlay.innerHTML = `
        <div class="custom-prompt-box" style="max-width:700px;max-height:80vh;overflow-y:auto;">
          <h2 style="text-align:center;margin-bottom:16px;">
            ${i18n.isEnglish() ? 'Choose a Template' : '选择项目模板'}
          </h2>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:16px;">
            ${cards}
          </div>
          <div style="text-align:center;">
            <button id="tpl-cancel" class="tb-btn">${i18n.t('dialog.cancel')}</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      // 绑定点击事件
      overlay.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.dataset.id;
          document.body.removeChild(overlay);
          resolve(id);
        });
        card.addEventListener('mouseenter', () => {
          card.style.borderColor = 'var(--accent)';
          card.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.borderColor = 'var(--border)';
          card.style.transform = '';
        });
      });

      overlay.querySelector('#tpl-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(null);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(null);
        }
      });
    });
  }

  return {
    getTemplates, getTemplateBlocks, hasTemplate, showTemplateDialog
  };
})();
