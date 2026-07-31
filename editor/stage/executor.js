/**
 * 执行引擎 - 遍历积木图并执行
 */
const Executor = (function () {
  let _running = false;
  let _stopRequested = false;
  let _globalVars = {};
  let _classes = {};
  let _dynamicFunctions = {};  // 动态注册的函数: name -> { codeBlock, paramNames }
  let _output = [];
  let _answer = '';
  let _sprites = [];
  let _keyHandler = null;
  let _timers = [];
  let _broadcastListeners = [];
  let _turboMode = 0;  // turbo 嵌套计数器，>0 表示处于 turbo 模式
  let _spriteClickHandler = null;  // 精灵点击事件处理器
  let _savedBlocks = null;  // 保存编辑器状态的积木（运行时用全部精灵积木替换）
  let _blockSpriteIdx = {};  // blockId → spriteIdx 映射（并发执行时恢复精灵上下文）

  function getOutput() { return _output; }
  function clearOutput() { _output = []; }

  function log(msg) {
    _output.push(String(msg));
    const logEl = document.getElementById('output-log');
    if (logEl) logEl.textContent = _output.join('\n');
  }

  /** 运行所有事件积木 */
  async function run() {
    if (_running) return;
    _running = true;
    _stopRequested = false;
    _globalVars = {};
    _classes = {};
    _output = [];
    _turboMode = 0;

    document.getElementById('btn-run').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    EditorState.running = true;
    document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Running...' : '运行中...';

    // 切换到输出面板
    switchTab('output');

    try {
      // 运行时使用所有精灵的积木（而非仅当前精灵）
      _savedBlocks = EditorState.blocks;
      const _savedActiveIdx = typeof StageManager !== 'undefined' ? StageManager.getActiveSpriteIdx() : 0;
      _blockSpriteIdx = {};  // blockId → spriteIdx 映射
      if (typeof StageManager !== 'undefined' && StageManager.getAllBlocks) {
        // 进入执行模式：禁止 setActiveSprite 同步积木
        if (StageManager.setExecuting) StageManager.setExecuting(true);
        EditorState.blocks = StageManager.getAllBlocks();
        // 构建 blockId → spriteIdx 映射，用于并发执行时切换当前精灵
        const sprites = StageManager.getSprites();
        for (let si = 0; si < sprites.length; si++) {
          if (sprites[si].blocks) {
            for (const bid of Object.keys(sprites[si].blocks)) {
              _blockSpriteIdx[bid] = si;
            }
          }
        }
      }

      // 先收集类定义
      for (const b of Object.values(EditorState.blocks)) {
        if (b.type === 'class_define') {
          await executeClassDefine(b);
        }
      }

      // 注册按键事件处理
      const keyBlocks = Object.values(EditorState.blocks).filter(b => b.type === 'event_key_pressed');
      if (keyBlocks.length > 0) {
        const firedKeys = {};
        _keyHandler = (e) => {
          if (_stopRequested || !_running) return;
          const keyName = SensingInput._mapKey ? SensingInput._mapKey(e.key) : e.key.toLowerCase();
          keyBlocks.forEach(b => {
            const targetKey = (b.params && b.params.key) || 'space';
            if (targetKey === keyName && !firedKeys[keyName]) {
              firedKeys[keyName] = true;
              const si = _blockSpriteIdx[b.id];
              if (si !== undefined) StageManager.setActiveSprite(si);
              executeChain(b, {}).catch(err => log('错误: ' + err.message));
            }
          });
        };
        const keyUpHandler = (e) => {
          const keyName = SensingInput._mapKey ? SensingInput._mapKey(e.key) : e.key.toLowerCase();
          delete firedKeys[keyName];
        };
        document.addEventListener('keydown', _keyHandler);
        document.addEventListener('keyup', keyUpHandler);
        _keyHandler._upHandler = keyUpHandler;
      }

    // 注册定时器事件
    const timerBlocks = Object.values(EditorState.blocks).filter(b => b.type === 'event_timer');
    timerBlocks.forEach(tb => {
      const sec = Number(tb.params?.sec || 1);
      const ms = Math.max(sec * 1000, 50);
      const intervalId = setInterval(() => {
        if (_stopRequested || !_running) return;
        const si = _blockSpriteIdx[tb.id];
        if (si !== undefined) StageManager.setActiveSprite(si);
        executeChain(tb, {}).catch(err => log('定时器错误: ' + err.message));
      }, ms);
      _timers.push(intervalId);
    });

    // 注册广播接收者
    const receiveBlocks = Object.values(EditorState.blocks).filter(b => b.type === 'event_receive');
    _broadcastListeners = receiveBlocks;
    // 广播触发时需要设置正确的精灵索引
    const broadcastBlockSpriteIdx = _blockSpriteIdx;

    // 注册精灵点击事件
    const spriteClickBlocks = Object.values(EditorState.blocks).filter(b => b.type === 'event_sprite_clicked');
    if (spriteClickBlocks.length > 0) {
      const stageCanvas = document.getElementById('stage-canvas');
      if (stageCanvas) {
        _spriteClickHandler = (e) => {
          if (_stopRequested || !_running) return;
          const rect = stageCanvas.getBoundingClientRect();
          const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
          const wx = Math.round(sx / rect.width * StageManager.STAGE_W - StageManager.STAGE_W / 2);
          const wy = Math.round(sy / rect.height * StageManager.STAGE_H - StageManager.STAGE_H / 2);
          // 检测点击了哪个精灵
          const sprites = StageManager.getSprites();
          for (let i = sprites.length - 1; i >= 0; i--) {
            const s = sprites[i];
            if (!s.visible) continue;
            const dx = wx - s.x, dy = wy - s.y;
            const hitRadius = 30 * (s.size / 100);
            if (dx * dx + dy * dy <= hitRadius * hitRadius) {
              // 点击了精灵 i
              StageManager.setActiveSprite(i);
              spriteClickBlocks.forEach(b => {
                const si = _blockSpriteIdx[b.id];
                if (si !== undefined) StageManager.setActiveSprite(si);
                executeChain(b, {}).catch(err => log('精灵点击错误: ' + err.message));
              });
              break;
            }
          }
        };
        stageCanvas.addEventListener('click', _spriteClickHandler);
      }
    }

    // 找到所有 event_start 积木并并发执行（每个精灵独立运行）
    const starts = Object.values(EditorState.blocks).filter(b => b.type === 'event_start');
    await Promise.all(starts.map(start => {
      if (_stopRequested) return Promise.resolve();
      const si = _blockSpriteIdx[start.id];
      if (si !== undefined) StageManager.setActiveSprite(si);
      return executeChain(start, {});
    }));

    // 如果有按键事件/定时器/广播接收者/精灵点击，保持运行
    const hasPersistentEvents = keyBlocks.length > 0 || timerBlocks.length > 0 || receiveBlocks.length > 0 || spriteClickBlocks.length > 0;
    if (hasPersistentEvents && !_stopRequested) {
      document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Running (waiting for event...)' : '运行中（等待事件...）';
      while (!_stopRequested) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    } catch (err) {
      log('错误: ' + err.message);
    }

    // 清理定时器
    _timers.forEach(id => clearInterval(id));
    _timers = [];
    _broadcastListeners = [];

    // 清理按键监听
    if (_keyHandler) {
      document.removeEventListener('keydown', _keyHandler);
      if (_keyHandler._upHandler) document.removeEventListener('keyup', _keyHandler._upHandler);
      _keyHandler = null;
    }

    // 清理精灵点击
    if (_spriteClickHandler) {
      const stageCanvas = document.getElementById('stage-canvas');
      if (stageCanvas) stageCanvas.removeEventListener('click', _spriteClickHandler);
      _spriteClickHandler = null;
    }

    _running = false;
    EditorState.running = false;
    // 退出执行模式，恢复编辑器状态
    if (typeof StageManager !== 'undefined' && StageManager.setExecuting) {
      StageManager.setExecuting(false);
    }
    if (_savedBlocks) {
      EditorState.blocks = _savedBlocks;
      _savedBlocks = null;
    }
    // 恢复到运行前的精灵状态
    if (typeof StageManager !== 'undefined' && StageManager.setActiveSprite) {
      StageManager.setActiveSprite(typeof _savedActiveIdx !== 'undefined' ? _savedActiveIdx : 0);
    }
    if (typeof DevMode !== 'undefined') DevMode.setExecutingBlock(null);
    document.getElementById('btn-run').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    document.getElementById('status-text').textContent = i18n.isEnglish() ? 'Finished' : '运行结束';
  }

  function stop() {
    _stopRequested = true;
  }

  /** 执行积木链 */
  async function executeChain(block, localScope) {
    let cur = block;
    while (cur && !_stopRequested) {
      // 并发执行时，每个 block 执行前恢复其所属精灵的上下文
      const si = _blockSpriteIdx[cur.id];
      if (si !== undefined && typeof StageManager !== 'undefined') StageManager.setActiveSprite(si);
      const result = await executeBlock(cur, localScope);
      if (result === '__RETURN__' || result === '__STOP__') return result;
      cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
    }
  }

  /** 执行单个积木 */
  async function executeBlock(block, scope) {
    // 开发者模式调试钩子
    if (typeof DevMode !== 'undefined' && DevMode.isDeveloper()) {
      await DevMode.beforeExecuteBlock(block);
    }
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return;
    const p = await resolveParams(block, scope);
    const type = block.type;

    // 优先检查扩展自定义执行器
    const customExec = ExtensionManager.getExecutor(type);
    if (customExec) {
      const result = await customExec(p, scope);
      if (result === '__RETURN__' || result === '__STOP__') return result;
      await delay(1);
      return;
    }

    // 事件
    if (type === 'event_start') { /* 入口，无操作 */ }
    else if (type === 'event_key_pressed') { /* 按键事件入口，无操作 */ }
    else if (type === 'event_broadcast') {
      // 广播消息：触发所有匹配的 event_receive 积木
      const msg = String(p.msg);
      _broadcastListeners.forEach(rb => {
        const targetMsg = String(rb.params?.msg || '');
        if (targetMsg === msg) {
          const si = broadcastBlockSpriteIdx[rb.id];
          if (si !== undefined) StageManager.setActiveSprite(si);
          executeChain(rb, {}).catch(err => log('广播错误: ' + err.message));
        }
      });
    }
    else if (type === 'event_broadcast_wait') {
      // 广播并等待：触发所有接收者并等待完成
      const msg = String(p.msg);
      const promises = [];
      _broadcastListeners.forEach(rb => {
        const targetMsg = String(rb.params?.msg || '');
        if (targetMsg === msg) {
          const si = broadcastBlockSpriteIdx[rb.id];
          if (si !== undefined) StageManager.setActiveSprite(si);
          promises.push(executeChain(rb, {}));
        }
      });
      if (promises.length > 0) await Promise.all(promises);
    }
    else if (type === 'event_receive') { /* 广播接收入口，由广播触发 */ }
    else if (type === 'event_timer') { /* 定时器入口，由 setInterval 触发 */ }
    else if (type === 'event_sprite_clicked') { /* 精灵点击事件入口，由舞台点击触发 */ }

    // 运动（操作当前选中的精灵）
    else if (type === 'move_steps') { StageManager.moveSprite(StageManager.getActiveSpriteIdx(), Number(p.steps)); }
    else if (type === 'turn_right') { StageManager.rotateSprite(StageManager.getActiveSpriteIdx(), Number(p.deg)); }
    else if (type === 'turn_left') { StageManager.rotateSprite(StageManager.getActiveSpriteIdx(), -Number(p.deg)); }
    else if (type === 'go_to_xy') { StageManager.setSpritePos(StageManager.getActiveSpriteIdx(), Number(p.x), Number(p.y)); }
    else if (type === 'go_to_random') {
      const hw = StageManager.STAGE_W / 2, hh = StageManager.STAGE_H / 2;
      StageManager.setSpritePos(StageManager.getActiveSpriteIdx(), Math.random() * hw * 2 - hw, Math.random() * hh * 2 - hh);
    }
    else if (type === 'go_to_mouse') { StageManager.setSpritePos(StageManager.getActiveSpriteIdx(), SensingInput.getMouseX(), SensingInput.getMouseY()); }
    else if (type === 'go_to_sprite') {
      const t = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t) StageManager.setSpritePos(StageManager.getActiveSpriteIdx(), t.x, t.y);
    }
    else if (type === 'change_x') { const s = StageManager.getActiveSprite(); if (s) { s.x += Number(p.dx); } }
    else if (type === 'set_x') { const s = StageManager.getActiveSprite(); if (s) s.x = Number(p.x); }
    else if (type === 'change_y') { const s = StageManager.getActiveSprite(); if (s) { s.y += Number(p.dy); } }
    else if (type === 'set_y') { const s = StageManager.getActiveSprite(); if (s) s.y = Number(p.y); }
    else if (type === 'glide_to') {
      const idx = StageManager.getActiveSpriteIdx();
      const s = StageManager.getActiveSprite();
      if (s) {
        const startX = s.x, startY = s.y;
        const tx = Number(p.x), ty = Number(p.y);
        const totalMs = Math.max(Number(p.sec) * 1000, 16);
        const startT = Date.now();
        while (!_stopRequested) {
          const elapsed = Date.now() - startT;
          const t = Math.min(elapsed / totalMs, 1);
          StageManager.setSpritePos(idx, startX + (tx - startX) * t, startY + (ty - startY) * t);
          if (t >= 1) break;
          await delay(16);
        }
      }
    }
    else if (type === 'glide_to_random') {
      const hw = StageManager.STAGE_W / 2, hh = StageManager.STAGE_H / 2;
      const tx = Math.random() * hw * 2 - hw, ty = Math.random() * hh * 2 - hh;
      const idx = StageManager.getActiveSpriteIdx(), s = StageManager.getActiveSprite();
      if (s) {
        const startX = s.x, startY = s.y;
        const totalMs = Math.max(Number(p.sec) * 1000, 16);
        const startT = Date.now();
        while (!_stopRequested) {
          const elapsed = Date.now() - startT;
          const t = Math.min(elapsed / totalMs, 1);
          StageManager.setSpritePos(idx, startX + (tx - startX) * t, startY + (ty - startY) * t);
          if (t >= 1) break;
          await delay(16);
        }
      }
    }
    else if (type === 'glide_to_mouse') {
      const idx = StageManager.getActiveSpriteIdx(), s = StageManager.getActiveSprite();
      if (s) {
        const startX = s.x, startY = s.y;
        const totalMs = Math.max(Number(p.sec) * 1000, 16);
        const startT = Date.now();
        while (!_stopRequested) {
          const elapsed = Date.now() - startT;
          const t = Math.min(elapsed / totalMs, 1);
          const tx = SensingInput.getMouseX(), ty = SensingInput.getMouseY();
          StageManager.setSpritePos(idx, startX + (tx - startX) * t, startY + (ty - startY) * t);
          if (t >= 1) break;
          await delay(16);
        }
      }
    }
    else if (type === 'glide_to_sprite') {
      const t2 = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t2) {
        const idx = StageManager.getActiveSpriteIdx(), s = StageManager.getActiveSprite();
        if (s) {
          const startX = s.x, startY = s.y;
          const totalMs = Math.max(Number(p.sec) * 1000, 16);
          const startT = Date.now();
          while (!_stopRequested) {
            const elapsed = Date.now() - startT;
            const ratio = Math.min(elapsed / totalMs, 1);
            StageManager.setSpritePos(idx, startX + (t2.x - startX) * ratio, startY + (t2.y - startY) * ratio);
            if (ratio >= 1) break;
            await delay(16);
          }
        }
      }
    }
    else if (type === 'set_direction') { StageManager.setSpriteDir(StageManager.getActiveSpriteIdx(), Number(p.deg)); }
    else if (type === 'point_towards_mouse') { StageManager.pointTowards(StageManager.getActiveSpriteIdx(), SensingInput.getMouseX(), SensingInput.getMouseY()); }
    else if (type === 'point_towards_sprite') {
      const t3 = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t3) StageManager.pointTowards(StageManager.getActiveSpriteIdx(), t3.x, t3.y);
    }
    else if (type === 'change_direction') { StageManager.rotateSprite(StageManager.getActiveSpriteIdx(), Number(p.ddir)); }
    else if (type === 'bounce_edge') { StageManager.bounceSprite(StageManager.getActiveSpriteIdx()); }
    else if (type === 'rotation_style') {
      const s = StageManager.getActiveSprite();
      if (s) {
        if (p.mode === '左右翻转') s.rotationStyle = 'leftRight';
        else if (p.mode === '不旋转') s.rotationStyle = 'noRotate';
        else s.rotationStyle = 'allAround';
      }
    }
    // 速度系统
    else if (type === 'set_velocity') { StageManager.setVelocity(StageManager.getActiveSpriteIdx(), p.vx, p.vy); }
    else if (type === 'change_velocity') { StageManager.changeVelocity(StageManager.getActiveSpriteIdx(), p.vx, p.vy); }
    else if (type === 'set_speed_dir') { StageManager.setSpeedDirection(StageManager.getActiveSpriteIdx(), p.speed, p.deg); }
    else if (type === 'apply_friction') { StageManager.applyFriction(StageManager.getActiveSpriteIdx(), p.f); }
    else if (type === 'apply_gravity') { StageManager.applyGravity(StageManager.getActiveSpriteIdx(), p.g); }
    else if (type === 'update_velocity') { StageManager.updateVelocity(StageManager.getActiveSpriteIdx()); }
    else if (type === 'bounce_edge_velocity') { StageManager.bounceEdgeVelocity(StageManager.getActiveSpriteIdx(), p.e); }
    // 追踪系统
    else if (type === 'move_towards_mouse') { StageManager.moveTowards(StageManager.getActiveSpriteIdx(), SensingInput.getMouseX(), SensingInput.getMouseY(), p.steps); }
    else if (type === 'move_towards_sprite') {
      const t4 = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t4) StageManager.moveTowards(StageManager.getActiveSpriteIdx(), t4.x, t4.y, p.steps);
    }
    else if (type === 'move_away_from_sprite') {
      const t5 = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t5) StageManager.moveAwayFrom(StageManager.getActiveSpriteIdx(), t5.x, t5.y, p.steps);
    }
    // 圆周运动
    else if (type === 'orbit_sprite') {
      const t6 = StageManager.getSprites().find(s => s.name === p.sprite);
      if (t6) StageManager.orbitAround(StageManager.getActiveSpriteIdx(), t6.x, t6.y, p.deg, p.r);
    }
    // 随机移动
    else if (type === 'random_move') {
      const mn = Number(p.min), mx = Number(p.max);
      const steps = Math.random() * (mx - mn) + mn;
      StageManager.moveSprite(StageManager.getActiveSpriteIdx(), steps);
    }
    else if (type === 'random_turn') {
      const mn2 = Number(p.min), mx2 = Number(p.max);
      const deg = Math.random() * (mx2 - mn2) + mn2;
      StageManager.rotateSprite(StageManager.getActiveSpriteIdx(), deg);
    }
    // 位置历史
    else if (type === 'go_back') { StageManager.goBack(StageManager.getActiveSpriteIdx()); }
    // 边界操作
    else if (type === 'clamp_to_stage') { StageManager.clampToStage(StageManager.getActiveSpriteIdx()); }
    else if (type === 'wrap_around') { StageManager.wrapAround(StageManager.getActiveSpriteIdx()); }

    // 外观
    else if (type === 'looks_show') { StageManager.setSpriteVisible(StageManager.getActiveSpriteIdx(), true); }
    else if (type === 'looks_hide') { StageManager.setSpriteVisible(StageManager.getActiveSpriteIdx(), false); }
    else if (type === 'looks_say') {
      StageManager.setSpriteSay(StageManager.getActiveSpriteIdx(), String(p.text));
      await delay(Number(p.sec) * 1000);
      StageManager.setSpriteSay(StageManager.getActiveSpriteIdx(), '');
    }
    else if (type === 'looks_set_size') { StageManager.setSpriteSize(StageManager.getActiveSpriteIdx(), Number(p.size)); }
    else if (type === 'looks_change_size') { StageManager.changeSpriteSize(StageManager.getActiveSpriteIdx(), Number(p.n)); }
    else if (type === 'looks_say_nowait') { StageManager.setSpriteSay(StageManager.getActiveSpriteIdx(), String(p.text)); }
    else if (type === 'looks_think') {
      const s = StageManager.getActiveSprite();
      if (s) { s.thinkText = String(p.text); StageManager.setSpriteSay(StageManager.getActiveSpriteIdx(), '💭 ' + String(p.text)); }
    }
    else if (type === 'looks_next_costume') {
      if (typeof CostumeManager !== 'undefined') {
        const names = CostumeManager.getAllNames();
        if (names.length > 0) {
          const idx = StageManager.getActiveSpriteIdx();
          const s = StageManager.getActiveSprite();
          const curName = s ? s.costumeName : '';
          const curIdx = names.indexOf(curName);
          const nextName = names[(curIdx + 1) % names.length];
          await StageManager.setSpriteCostume(idx, nextName);
        }
      }
    }
    else if (type === 'looks_set_color') {
      const s = StageManager.getActiveSprite();
      if (s) { s.colorEffect = Number(p.val); }
    }
    else if (type === 'looks_clear_effects') {
      const s = StageManager.getActiveSprite();
      if (s) { s.colorEffect = 0; s.size = 100; }
    }

    // 控制
    else if (type === 'wait') { await delay(Number(p.sec) * 1000); }
    else if (type === 'repeat') {
      const n = Number(p.times);
      for (let i = 0; i < n && !_stopRequested; i++) {
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, { ...scope, __i: i }); if (r === '__RETURN__') return r; }
      }
    }
    else if (type === 'forever') {
      while (!_stopRequested) {
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
        await delay(16);
      }
    }
    else if (type === 'if_then') {
      if (await resolveBool(p.cond, block, 'cond', scope)) {
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
      }
    }
    else if (type === 'if_else') {
      if (await resolveBool(p.cond, block, 'cond', scope)) {
        const subTop = getSubTop(block, 'then');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
      } else {
        const subTop = getSubTop(block, 'else');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
      }
    }
    else if (type === 'repeat_until') {
      while (!_stopRequested && !(await resolveBool(p.cond, block, 'cond', scope))) {
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
        await delay(16);
      }
    }
    else if (type === 'stop_all') { return '__STOP__'; }
    else if (type === 'control_label_run') {
      // 执行 C 型体内部的积木链
      const subTop = getSubTop(block, 'body');
      if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
    }
    else if (type === 'control_turbo') {
      // ⚡ 一帧内执行：内部所有 delay 立即返回
      _turboMode++;
      try {
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') { _turboMode--; return r; } }
      } finally {
        _turboMode--;
      }
    }
    else if (type === 'control_goto_label') {
      // 跳转到指定标签的积木并开始执行
      const targetLabel = String(p.label);
      const target = findBlockByLabel(targetLabel);
      if (target) {
        // 找到目标积木的下一个积木（跳过标签本身）开始执行
        const nextBlock = target.flowOut ? EditorState.blocks[target.flowOut] : null;
        if (nextBlock) {
          const r = await executeChain(nextBlock, scope);
          if (r === '__RETURN__' || r === '__STOP__') return r;
        }
        return '__STOP__';
      } else {
        log('警告: 找不到代码标签 "' + targetLabel + '"');
      }
    }
    // === 元编程：代码块被触发时执行子代码 ===
    else if (type === 'control_code_block') {
      // 代码块被 flow-in 触发时，执行内部子代码
      const subTop = getSubTop(block, 'body');
      if (subTop) {
        const r = await executeChain(subTop, scope);
        if (r === '__RETURN__') return r;
      }
    }
    // === 元编程：运行积木本身 ===
    else if (type === 'control_run_block') {
      // 运行 [积木本身]：执行传入的积木引用
      const blockVal = p.block;
      if (blockVal && blockVal.__blockRef) {
        const targetBlock = EditorState.blocks[blockVal.__blockRef];
        if (targetBlock) {
          // 如果是函数定义，执行函数体
          if (targetBlock.type === 'func_define' || blockVal.__isFunction) {
            const fnBody = targetBlock.flowOut ? EditorState.blocks[targetBlock.flowOut] : null;
            if (fnBody) {
              const r = await executeChain(fnBody, scope);
              if (r === '__RETURN__') return r;
            }
          }
          // 如果是代码块闭包，执行其内部子代码
          else if (targetBlock.__closure) {
            const subTop = getSubTop(targetBlock, 'body');
            if (subTop) {
              const r = await executeChain(subTop, targetBlock.__closure);
              if (r === '__RETURN__') return r;
            }
          } else {
            // 直接执行该积木链
            const r = await executeChain(targetBlock, scope);
            if (r === '__RETURN__' || r === '__STOP__') return r;
          }
        }
      }
    }

    // 变量
    else if (type === 'var_set') { setVar(p.name, p.val, scope); }
    else if (type === 'var_change') {
      const cur = getVar(p.name, scope);
      setVar(p.name, Number(cur) + Number(p.val), scope);
    }
    else if (type === 'var_show') { /* 变量显示：在舞台上展示变量值（简化处理） */ }
    else if (type === 'var_hide') { /* 变量隐藏 */ }

    // 局部域 - 内部创建的变量只能在此区域内访问
    else if (type === 'scope_local') {
      const localScope = { ...scope, __local: true };
      const subTop = getSubTop(block, 'body');
      if (subTop) {
        const r = await executeChain(subTop, localScope);
        if (r === '__RETURN__') return r;
      }
    }

    // 函数
    else if (type === 'func_define') { /* 注册函数 */ }
    // 动态函数定义：将代码块本身注册为函数
    else if (type === 'func_set_define') {
      const name = String(p.name).trim();
      const codeVal = p.code;
      if (name && codeVal && codeVal.__blockRef) {
        const paramNames = (block._extraParams || []).map(ep => String(block.params[ep.name] || '').trim()).filter(Boolean);
        _dynamicFunctions[name] = {
          blockRef: codeVal.__blockRef,
          closure: codeVal.__closure || null,
          paramNames: paramNames
        };
      }
    }
    else if (type === 'func_call') {
      // 先查动态函数
      const dynFn = _dynamicFunctions[p.name];
      if (dynFn) {
        const callArgs = await collectCallArgs(block, scope);
        const fnScope = {};
        dynFn.paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
        const targetBlock = EditorState.blocks[dynFn.blockRef];
        if (targetBlock) {
          const subTop = dynFn.closure ? getSubTop(targetBlock, 'body') : (targetBlock.type === 'control_code_block' ? getSubTop(targetBlock, 'body') : targetBlock);
          const execScope = dynFn.closure ? { ...dynFn.closure, ...fnScope } : { ...scope, ...fnScope };
          if (subTop) {
            const r = await executeChain(subTop, execScope);
            if (r === '__RETURN__') return execScope.__return;
          }
        }
      } else {
        const fn = findFunction(p.name);
        if (fn) {
          // 收集调用实参值（支持多参数动态槽）
          const callArgs = await collectCallArgs(block, scope);
          // 收集定义形参名
          const defParamNames = (fn._extraParams || []).map(ep => String(fn.params[ep.name] || '').trim()).filter(Boolean);
          const fnScope = {};
          defParamNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          const next = fn.flowOut ? EditorState.blocks[fn.flowOut] : null;
          if (next) { const r = await executeChain(next, fnScope); if (r === '__RETURN__') return fnScope.__return; }
        }
      }
    }
    else if (type === 'func_return') { scope.__return = p.val; return '__RETURN__'; }

    // 列表（列表对象存储在变量中）
    else if (type === 'list_push') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr.push(p.val);
    }
    else if (type === 'list_delete') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr.splice(Number(p.idx) - 1, 1);
    }
    else if (type === 'list_insert') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr.splice(Number(p.idx) - 1, 0, p.val);
    }
    else if (type === 'list_set') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr[Number(p.idx) - 1] = p.val;
    }
    else if (type === 'list_clear') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr.length = 0;
    }
    else if (type === 'list_sort') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) {
        arr.sort((a, b) => {
          const na = Number(a), nb = Number(b);
          if (!isNaN(na) && !isNaN(nb)) return p.order === '降序' ? nb - na : na - nb;
          return p.order === '降序' ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
        });
      }
    }
    else if (type === 'list_reverse') {
      const arr = resolveListArray(p.list, scope);
      if (Array.isArray(arr)) arr.reverse();
    }
    else if (type === 'list_foreach') {
      const arr = resolveListArray(p.list, scope);
      const list = Array.isArray(arr) ? arr : [];
      for (let i = 0; i < list.length && !_stopRequested; i++) {
        const subScope = { ...scope, [p.var]: list[i] };
        const subTop = getSubTop(block, 'body');
        if (subTop) { const r = await executeChain(subTop, subScope); if (r === '__RETURN__') return r; }
      }
    }

    // OOP
    else if (type === 'class_define') { /* 已在预处理 */ }
    else if (type === 'class_init') {
      // 初始化方法：C 型积木，执行内部代码
      const subTop = getSubTop(block, 'body');
      if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
    }
    else if (type === 'class_method') {
      // 方法定义：C 型积木，执行内部代码
      const subTop = getSubTop(block, 'body');
      if (subTop) { const r = await executeChain(subTop, scope); if (r === '__RETURN__') return r; }
    }
    else if (type === 'class_set_attr') {
      const obj = scope.self || scope;
      obj[p.attr] = p.val;
    }
    else if (type === 'class_set_attr_external') {
      const obj = resolveObj(p.obj, scope);
      if (obj) obj[p.attr] = p.val;
      else log('警告: 找不到对象 "' + p.obj + '"');
    }
    else if (type === 'class_call_method') {
      // 调用对象方法（stack 上下文）
      const obj = resolveObj(p.obj, scope);
      if (obj && obj.__className) {
        const cls = _classes[obj.__className];
        if (cls && cls.methods[p.method]) {
          const methodBlock = cls.methods[p.method];
          const fnScope = { self: obj };
          const paramNames = (methodBlock._extraParams || []).map(ep => String(methodBlock.params[ep.name] || '').trim()).filter(Boolean);
          const callArgs = await collectCallArgs(block, scope);
          paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          const subTop = getSubTop(methodBlock, 'body');
          if (subTop) { await executeChain(subTop, fnScope); }
          return fnScope.__return;
        }
        log('警告: 对象没有方法 "' + p.method + '"');
      } else {
        log('警告: 找不到对象 "' + p.obj + '"');
      }
    }
    // IO
    else if (type === 'io_print') { log(p.text); }
    else if (type === 'io_print_line') { log(p.text + '\n'); }
    else if (type === 'io_clear_output') { clearOutput(); const logEl = document.getElementById('output-log'); if (logEl) logEl.textContent = ''; }
    else if (type === 'io_alert') { alert(String(p.msg)); }
    else if (type === 'io_log') { console.log('[Objector]', p.text); log('[日志] ' + p.text); }
    else if (type === 'io_input') {
      log('询问: ' + p.q);
      _answer = (await showCustomPrompt(String(p.q))) || '';
      log('回答: ' + _answer);
    }
    else if (type === 'io_save_data') { _globalVars['__data_' + p.key] = p.val; }
    else if (type === 'io_read_file') {
      // 文件读取（Electron 环境）
      if (typeof window !== 'undefined' && window.api && window.api.readFile) {
        try { return await window.api.readFile(String(p.path)); } catch { return ''; }
      }
      return '';
    }
    else if (type === 'io_write_file') {
      // 文件写入（Electron 环境）
      if (typeof window !== 'undefined' && window.api && window.api.writeFile) {
        try { await window.api.writeFile(String(p.path), String(p.text)); } catch {}
      }
    }

    // === 声音 ===
    else if (type === 'sound_play') { SoundManager.play(String(p.name)); }
    else if (type === 'sound_play_wait') { await SoundManager.playAndWait(String(p.name)); }
    else if (type === 'sound_stop') { SoundManager.stopAll(); }
    else if (type === 'sound_stop_name') { SoundManager.stop(String(p.name)); }
    else if (type === 'sound_set_volume') { SoundManager.setVolume(Number(p.vol)); }
    else if (type === 'sound_change_volume') { SoundManager.changeVolume(Number(p.val)); }
    else if (type === 'sound_load') {
      if (p.path) {
        const name = await SoundManager.loadSound(String(p.path));
        if (name) log('已加载声音: ' + name);
      }
    }

    // === 侦测 ===
    else if (type === 'sensing_reset_timer') { SensingInput.resetTimer(); }

    // === 造型 ===
    else if (type === 'looks_set_costume') {
      if (p.name) {
        const idx = StageManager.getActiveSpriteIdx();
        await StageManager.setSpriteCostume(idx, String(p.name));
      }
    }

    await delay(1);
  }

  // Helpers
  async function resolveParams(block, scope) {
    const result = {};
    const def = BlockRegistry.getBlock(block.type);
    if (!def) return result;
    const allParams = [...(def.params || []), ...(block._extraParams || [])];
    for (const p of allParams) {
      // 检查是否有 reporter 连接
      const connId = block.paramConnections && block.paramConnections[p.name];
      if (connId) {
        const reporter = EditorState.blocks[connId];
        if (reporter) {
          // block 类型参数：返回积木引用而不是执行结果
          if (p.type === 'block') {
            result[p.name] = { __blockRef: connId };
            continue;
          }
          result[p.name] = await evaluateReporter(reporter, scope);
          continue;
        }
      }
      result[p.name] = block.params[p.name];
    }
    return result;
  }

  async function evaluateReporter(block, scope) {
    const type = block.type;
    const p = await resolveParams(block, scope);
    switch (type) {
      case 'op_add': return Number(p.a) + Number(p.b);
      case 'op_sub': return Number(p.a) - Number(p.b);
      case 'op_mul': return Number(p.a) * Number(p.b);
      case 'op_div': return Number(p.b) ? Number(p.a) / Number(p.b) : 0;
      case 'op_mod': return Number(p.a) % Number(p.b);
      case 'op_random': return Math.floor(Math.random() * (Number(p.b) - Number(p.a) + 1)) + Number(p.a);
      case 'op_random_float': return Math.random();
      case 'op_pow': return Math.pow(Number(p.a), Number(p.b));
      case 'op_lt': return Number(p.a) < Number(p.b);
      case 'op_gt': return Number(p.a) > Number(p.b);
      case 'op_lte': return Number(p.a) <= Number(p.b);
      case 'op_gte': return Number(p.a) >= Number(p.b);
      case 'op_eq': return p.a == p.b;
      case 'op_neq': return p.a != p.b;
      case 'op_and': return (await resolveBool(p.a)) && (await resolveBool(p.b));
      case 'op_or': return (await resolveBool(p.a)) || (await resolveBool(p.b));
      case 'op_not': return !(await resolveBool(p.a));
      case 'op_join': return String(p.a) + String(p.b);
      case 'op_strlen': return String(p.s).length;
      case 'op_substr': return String(p.s).substring(Number(p.start) - 1, Number(p.end));
      case 'op_str_index': { const idx = String(p.s).indexOf(String(p.sub)); return idx === -1 ? 0 : idx + 1; }
      case 'op_str_contains': return String(p.s).includes(String(p.sub));
      case 'op_str_upper': return String(p.s).toUpperCase();
      case 'op_str_lower': return String(p.s).toLowerCase();
      case 'op_str_trim': return String(p.s).trim();
      case 'op_str_repeat': return String(p.s).repeat(Math.max(0, Number(p.n)));
      case 'op_str_replace': return String(p.s).split(String(p.from)).join(String(p.to));
      case 'op_char_at': return String(p.s).charAt(Number(p.n) - 1) || '';
      case 'op_to_number': return Number(p.s) || 0;
      case 'op_to_string': return String(p.n);
      case 'op_min': return Math.min(Number(p.a), Number(p.b));
      case 'op_max': return Math.max(Number(p.a), Number(p.b));
      case 'op_clamp': return Math.min(Math.max(Number(p.n), Number(p.min)), Number(p.max));
      case 'op_lerp': return Number(p.a) + (Number(p.b) - Number(p.a)) * Number(p.t);
      case 'op_pi': return Math.PI;
      case 'op_e': return Math.E;
      case 'op_math': {
        const n = Number(p.n);
        const fn = p.fn;
        if (fn === 'abs') return Math.abs(n);
        if (fn === 'floor') return Math.floor(n);
        if (fn === 'ceil') return Math.ceil(n);
        if (fn === 'round') return Math.round(n);
        if (fn === 'sqrt') return Math.sqrt(n);
        if (fn === 'sin') return Math.sin(n);
        if (fn === 'cos') return Math.cos(n);
        if (fn === 'tan') return Math.tan(n);
        if (fn === 'asin') return Math.asin(n);
        if (fn === 'acos') return Math.acos(n);
        if (fn === 'atan') return Math.atan(n);
        if (fn === 'log') return Math.log(n);
        if (fn === 'log2') return Math.log2(n);
        if (fn === 'exp') return Math.exp(n);
        if (fn === 'sign') return Math.sign(n);
        return n;
      }
      case 'var_get': {
        // 先查动态函数
        if (_dynamicFunctions[p.name]) {
          const df = _dynamicFunctions[p.name];
          return { __blockRef: df.blockRef, __isFunction: true, __dynamicFn: p.name };
        }
        // 如果变量名是函数名，返回函数本身作为可调用引用
        const fn = findFunction(p.name);
        if (fn) return { __blockRef: fn.id, __isFunction: true };
        return getVar(p.name, scope);
      }
      case 'func_param_get': return getVar(p.name, scope);
      case 'func_call_reporter': {
        // 在 reporter 上下文中调用函数并获取返回值
        // 先查动态函数
        const dynFn = _dynamicFunctions[p.name];
        if (dynFn) {
          const callArgs = await collectCallArgs(block, scope);
          const fnScope = {};
          dynFn.paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          const targetBlock = EditorState.blocks[dynFn.blockRef];
          if (targetBlock) {
            const subTop = dynFn.closure ? getSubTop(targetBlock, 'body') : (targetBlock.type === 'control_code_block' ? getSubTop(targetBlock, 'body') : targetBlock);
            const execScope = dynFn.closure ? { ...dynFn.closure, ...fnScope } : { ...scope, ...fnScope };
            if (subTop) {
              await executeChain(subTop, execScope);
              return execScope.__return;
            }
          }
        }
        const fn = findFunction(p.name);
        if (fn) {
          const callArgs = await collectCallArgs(block, scope);
          const defParamNames = (fn._extraParams || []).map(ep => String(fn.params[ep.name] || '').trim()).filter(Boolean);
          const fnScope = {};
          defParamNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
          const next = fn.flowOut ? EditorState.blocks[fn.flowOut] : null;
          if (next) {
            await executeChain(next, fnScope);
            return fnScope.__return;
          }
        }
        return undefined;
      }
      case 'io_answer': return _answer;
      case 'io_confirm': return confirm(String(p.msg));
      case 'list_create': {
        // 动态收集所有 item 参数槽的值，组合成数组
        const result = [];
        const allKeys = Object.keys(block.params).filter(k => k.startsWith('item'));
        for (const key of allKeys) {
          const val = p[key] !== undefined ? p[key] : block.params[key];
          if (val === undefined || val === null || String(val).trim() === '') continue;
          if (Array.isArray(val)) {
            val.forEach(v => result.push(v));
          } else {
            String(val).split(',').forEach(s => {
              const trimmed = s.trim();
              if (trimmed !== '') result.push(trimmed);
            });
          }
        }
        return result;
      }
      case 'list_get': {
        const arr = resolveListArray(p.list, scope);
        return Array.isArray(arr) ? arr[Number(p.idx) - 1] : undefined;
      }
      case 'list_length': {
        const arr = resolveListArray(p.list, scope);
        return Array.isArray(arr) ? arr.length : 0;
      }
      case 'list_contains': {
        const arr = resolveListArray(p.list, scope);
        return Array.isArray(arr) ? arr.includes(p.val) : false;
      }
      case 'list_index_of': {
        const arr = resolveListArray(p.list, scope);
        if (!Array.isArray(arr)) return 0;
        const idx = arr.indexOf(p.val);
        return idx === -1 ? 0 : idx + 1; // 1-based
      }
      case 'list_join': {
        const arr = resolveListArray(p.list, scope);
        return Array.isArray(arr) ? arr.join(String(p.sep)) : '';
      }
      case 'io_load_data': return _globalVars['__data_' + p.key] || '';
      case 'class_get_attr': {
        const obj = resolveObj(p.obj, scope);
        return obj ? obj[p.attr] : undefined;
      }
      case 'get_x': return StageManager.getActiveSprite()?.x || 0;
      case 'get_y': return StageManager.getActiveSprite()?.y || 0;
      case 'get_direction': return StageManager.getActiveSprite()?.direction || 90;
      case 'get_vx': return StageManager.getActiveSprite()?.vx || 0;
      case 'get_vy': return StageManager.getActiveSprite()?.vy || 0;
      case 'get_speed': return StageManager.getSpeed(StageManager.getActiveSpriteIdx());
      case 'distance_to_mouse': return StageManager.getDistanceToPoint(StageManager.getActiveSpriteIdx(), SensingInput.getMouseX(), SensingInput.getMouseY());
      case 'direction_to_mouse': return StageManager.getDirectionToPoint(StageManager.getActiveSpriteIdx(), SensingInput.getMouseX(), SensingInput.getMouseY());
      case 'distance_to_sprite': {
        const tds = StageManager.getSprites().find(s => s.name === p.sprite);
        return tds ? StageManager.getDistanceToPoint(StageManager.getActiveSpriteIdx(), tds.x, tds.y) : 0;
      }
      case 'direction_to_sprite': {
        const tdr = StageManager.getSprites().find(s => s.name === p.sprite);
        return tdr ? StageManager.getDirectionToPoint(StageManager.getActiveSpriteIdx(), tdr.x, tdr.y) : 0;
      }
      case 'is_at_edge': return StageManager.isTouchingEdge(StageManager.getActiveSpriteIdx());
      case 'looks_get_size': return StageManager.getActiveSprite()?.size || 100;
      case 'class_self': return scope.self || null;
      case 'class_param_get': return getVar(p.name, scope);
      case 'class_create': {
        // 创建对象实例（reporter 上下文）
        const className = String(p.cls);
        const cls = _classes[className];
        if (cls) {
          const instance = { __className: className };
          // 如果有初始化方法，执行它
          if (cls.initBlock) {
            const initBlock = cls.initBlock;
            const subTop = getSubTop(initBlock, 'body');
            const fnScope = { self: instance };
            const paramNames = (initBlock._extraParams || []).map(ep => String(initBlock.params[ep.name] || '').trim()).filter(Boolean);
            const callArgs = await collectCallArgs(block, scope);
            paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
            if (subTop) await executeChain(subTop, fnScope);
          }
          _globalVars['__obj_' + className + '_' + Date.now()] = instance;
          return instance;
        }
        log('警告: 找不到类 "' + className + '"');
        return null;
      }
      case 'class_call_method_reporter': {
        // 调用对象方法并返回值（reporter 上下文）
        const obj = resolveObj(p.obj, scope);
        if (obj && obj.__className) {
          const cls = _classes[obj.__className];
          if (cls && cls.methods[p.method]) {
            const methodBlock = cls.methods[p.method];
            const fnScope = { self: obj };
            const paramNames = (methodBlock._extraParams || []).map(ep => String(methodBlock.params[ep.name] || '').trim()).filter(Boolean);
            const callArgs = await collectCallArgs(block, scope);
            paramNames.forEach((name, i) => { fnScope[name] = callArgs[i] !== undefined ? callArgs[i] : ''; });
            const subTop = getSubTop(methodBlock, 'body');
            if (subTop) { await executeChain(subTop, fnScope); }
            return fnScope.__return;
          }
        }
        return undefined;
      }

      // === 元编程：积木本身作为值 ===
      case 'control_code_block': {
        // 代码块：返回闭包（包含子代码引用和当前作用域）
        const subTop = getSubTop(block, 'body');
        return {
          __blockRef: block.id,
          __closure: { ...scope },  // 捕获当前作用域
        };
      }
      case 'control_run_return_block': {
        // 运行 [积木本身] 并返回：执行并返回结果
        const blockVal = p.block;
        if (blockVal && blockVal.__blockRef) {
          const targetBlock = EditorState.blocks[blockVal.__blockRef];
          if (targetBlock) {
            // 如果是函数定义，执行函数体并获取返回值
            if (targetBlock.type === 'func_define' || blockVal.__isFunction) {
              const fnBody = targetBlock.flowOut ? EditorState.blocks[targetBlock.flowOut] : null;
              if (fnBody) {
                let result = undefined;
                const execSync = (b) => {
                  let cur = b;
                  while (cur) {
                    if (cur.type === 'func_return') {
                      const cp = resolveParams(cur, scope);
                      result = cp.val;
                      return;
                    }
                    cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
                  }
                };
                execSync(fnBody);
                return result;
              }
            }
            else if (targetBlock.__closure) {
              // 执行代码块闭包的内部子代码
              const subTop = getSubTop(targetBlock, 'body');
              if (subTop) {
                // 同步执行获取返回值（reporter 上下文）
                let result = undefined;
                const execSync = (b) => {
                  let cur = b;
                  while (cur) {
                    if (cur.type === 'func_return') {
                      const cp = resolveParams(cur, targetBlock.__closure);
                      result = cp.val;
                      return;
                    }
                    cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
                  }
                };
                execSync(subTop);
                return result;
              }
            } else {
              // 直接执行积木并获取返回值
              let result = undefined;
              const execSync = (b) => {
                let cur = b;
                while (cur) {
                  if (cur.type === 'func_return') {
                    const cp = resolveParams(cur, scope);
                    result = cp.val;
                    return;
                  }
                  cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
                }
              };
              execSync(targetBlock);
              return result;
            }
          }
        }
        return undefined;
      }

      // === 声音 ===
      case 'sound_get_volume': return SoundManager.getVolume();

      // === 侦测 ===
      case 'sensing_touching_edge': return StageManager.isTouchingEdge(StageManager.getActiveSpriteIdx());
      case 'sensing_touching_sprite': {
        const sprites = StageManager.getSprites();
        const target = sprites.findIndex(s => s.name === p.sprite);
        if (target >= 0) return StageManager.isTouchingSprite(StageManager.getActiveSpriteIdx(), target);
        return false;
      }
      case 'sensing_mouse_x': return SensingInput.getMouseX();
      case 'sensing_mouse_y': return SensingInput.getMouseY();
      case 'sensing_mouse_down': return SensingInput.isMouseDown();
      case 'sensing_key_pressed': return SensingInput.isKeyPressed(p.key);
      case 'sensing_distance_to': {
        const sprites2 = StageManager.getSprites();
        const target2 = sprites2.findIndex(s => s.name === p.sprite);
        if (target2 >= 0) return StageManager.distanceToSprite(StageManager.getActiveSpriteIdx(), target2);
        return 0;
      }
      case 'sensing_timer': return SensingInput.getTimer();
      case 'sensing_sprite_x': {
        const sp = StageManager.getSprites().find(s => s.name === p.sprite);
        return sp ? sp.x : 0;
      }
      case 'sensing_sprite_y': {
        const sp = StageManager.getSprites().find(s => s.name === p.sprite);
        return sp ? sp.y : 0;
      }
      case 'sensing_sprite_direction': {
        const sp = StageManager.getSprites().find(s => s.name === p.sprite);
        return sp ? sp.direction : 90;
      }
      case 'sensing_sprite_size': {
        const sp = StageManager.getSprites().find(s => s.name === p.sprite);
        return sp ? sp.size : 100;
      }
      case 'sensing_answer': return _answer;
      case 'sensing_current': {
        const now = new Date();
        switch (p.unit) {
          case '年': return now.getFullYear();
          case '月': return now.getMonth() + 1;
          case '日': return now.getDate();
          case '时': return now.getHours();
          case '分': return now.getMinutes();
          case '秒': return now.getSeconds();
          case '星期': return now.getDay() || 7;
          default: return now.getSeconds();
        }
      }
      case 'sensing_username': return '用户';
      case 'sensing_stage_width': return StageManager.STAGE_W || 480;
      case 'sensing_stage_height': return StageManager.STAGE_H || 360;
      case 'sensing_sprite_count': return StageManager.getSprites().length;
      case 'sensing_timestamp': return Date.now();
      case 'sensing_format_time': {
        const now = new Date();
        let fmt = String(p.fmt || 'yyyy-MM-dd HH:mm:ss');
        fmt = fmt.replace('yyyy', now.getFullYear());
        fmt = fmt.replace('MM', String(now.getMonth() + 1).padStart(2, '0'));
        fmt = fmt.replace('dd', String(now.getDate()).padStart(2, '0'));
        fmt = fmt.replace('HH', String(now.getHours()).padStart(2, '0'));
        fmt = fmt.replace('mm', String(now.getMinutes()).padStart(2, '0'));
        fmt = fmt.replace('ss', String(now.getSeconds()).padStart(2, '0'));
        return fmt;
      }

      default: {
        // 检查扩展自定义执行器
        const customExec = ExtensionManager.getExecutor(type);
        if (customExec) return customExec(p, scope);
        return block.params ? Object.values(block.params)[0] : 0;
      }
    }
  }

  async function resolveBool(val, block, paramName, scope) {
    if (block && paramName) {
      const connId = block.paramConnections && block.paramConnections[paramName];
      if (connId) {
        const reporter = EditorState.blocks[connId];
        if (reporter) {
          const r = await evaluateReporter(reporter, scope);
          return !!r;
        }
      }
    }
    return !!val;
  }

  function setVar(name, val, scope) {
    if (scope[name] !== undefined) { scope[name] = val; }
    else if (scope.__local) { scope[name] = val; } // 局部域：创建在本地
    else { _globalVars[name] = val; }
  }
  function getVar(name, scope) {
    if (scope[name] !== undefined) return scope[name];
    return _globalVars[name];
  }

  /** 解析对象引用：支持对象实例、'self'、变量名 */
  function resolveObj(val, scope) {
    if (val && typeof val === 'object' && val.__className) return val;
    const name = String(val);
    if (name === 'self') return scope.self || null;
    if (scope[name] !== undefined && typeof scope[name] === 'object') return scope[name];
    const g = _globalVars[name];
    if (g && typeof g === 'object') return g;
    return null;
  }

  /** 解析列表参数 - 如果值本身是数组则直接返回，否则作为变量名查找 */
  function resolveListArray(val, scope) {
    if (Array.isArray(val)) return val;
    // 尝试从变量中获取
    const v = getVar(String(val), scope);
    if (Array.isArray(v)) return v;
    return null;
  }

  function getSubTop(block, subName) {
    const subId = block.subBlocks && block.subBlocks[subName];
    return subId ? EditorState.blocks[subId] : null;
  }

  function findFunction(name) {
    return Object.values(EditorState.blocks).find(b => b.type === 'func_define' && b.params.name === name);
  }

  /** 根据标签名查找积木：支持 control_label_run 的 param 和任意积木的 _importantLabel */
  function findBlockByLabel(label) {
    return Object.values(EditorState.blocks).find(b => {
      if (b.type === 'control_label_run' && b.params && b.params.label === label) return true;
      if (b._importantLabel === label) return true;
      return false;
    });
  }

  async function executeClassDefine(block) {
    const name = block.params.name;
    _classes[name] = { name, initBlock: null, methods: {} };
    let cur = block.flowOut ? EditorState.blocks[block.flowOut] : null;
    while (cur) {
      if (cur.type === 'class_init') _classes[name].initBlock = cur;
      if (cur.type === 'class_method') _classes[name].methods[cur.params.name] = cur;
      cur = cur.flowOut ? EditorState.blocks[cur.flowOut] : null;
    }
  }

  function delay(ms) {
    if (_turboMode > 0) return Promise.resolve();  // turbo 模式下跳过所有延时
    return new Promise(r => setTimeout(r, ms));
  }

  /** 收集函数调用的实参值（支持多参数动态槽） */
  async function collectCallArgs(block, scope) {
    if (!block._extraParams || block._extraParams.length === 0) return [];
    const result = [];
    for (const ep of block._extraParams) {
      const connId = block.paramConnections && block.paramConnections[ep.name];
      if (connId) {
        const reporter = EditorState.blocks[connId];
        if (reporter) {
          result.push(await evaluateReporter(reporter, scope));
          continue;
        }
      }
      result.push(block.params[ep.name] || '');
    }
    return result;
  }

  function _getGlobalVars() { return { ..._globalVars }; }

  return { run, stop, getOutput, clearOutput, _getGlobalVars };
})();
