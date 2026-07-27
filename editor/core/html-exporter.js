/**
 * HTML 导出器 - 将项目转换为可独立运行的 HTML 文件
 */
const HtmlExporter = (function () {

  /** 生成可运行的 HTML */
  function generateHTML(projectName, blocksData, spritesData) {
    const blocks = JSON.stringify(blocksData);
    const sprites = JSON.stringify(spritesData || []);

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${projectName} - Objector</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { background:#1e1e2e; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:'Segoe UI','Microsoft YaHei',sans-serif; }
    h1 { color:#89b4fa; font-size:18px; margin-bottom:12px; }
    #stage { background:#fff; border-radius:8px; box-shadow:0 8px 32px rgba(0,0,0,.5); cursor:crosshair; }
    #output { color:#a6adc8; font-family:'Cascadia Code','Consolas',monospace; font-size:12px; margin-top:12px; max-width:480px; width:100%; height:120px; overflow-y:auto; background:#181825; border-radius:6px; padding:8px; white-space:pre-wrap; }
    .controls { margin-top:12px; display:flex; gap:8px; }
    .controls button { background:#313244; color:#cdd6f4; border:1px solid #45475a; border-radius:6px; padding:6px 16px; cursor:pointer; font-size:13px; }
    .controls button:hover { background:#45475a; border-color:#89b4fa; }
    .controls .run { background:#1a3a1a; color:#a6e3a1; border-color:#2d5a2d; }
    .controls .run:hover { background:#2d5a2d; }
    .controls .stop { background:#3a1a1a; color:#f38ba8; border-color:#5a2d2d; }
    .controls .stop:hover { background:#5a2d2d; }
  </style>
</head>
<body>
  <h1>${projectName}</h1>
  <canvas id="stage" width="480" height="360"></canvas>
  <div id="output"></div>
  <div class="controls">
    <button class="run" onclick="startRun()">▶ 运行</button>
    <button class="stop" onclick="stopRun()">⏹ 停止</button>
  </div>

<script>
// ===== Objector Runtime =====
const STAGE_W = 480, STAGE_H = 360;
const canvas = document.getElementById('stage');
const ctx = canvas.getContext('2d');
const outputEl = document.getElementById('output');

let running = false, stopRequested = false;
let globalVars = {};
let dynamicFunctions = {};
let sprites = ${sprites};
let blocks = ${blocks};
let timers = [];
let keyHandler = null;
let mouseX = 0, mouseY = 0, mouseDown = false;
let pressedKeys = {};
let broadcastListeners = [];
let output = [];
let turboMode = 0;

// 初始化精灵
sprites.forEach(s => {
  s.x = s.x || 0; s.y = s.y || 0;
  s.direction = s.direction || 90;
  s.size = s.size || 100;
  s.visible = s.visible !== false;
  s.sayText = ''; s.sayTimer = null;
  s.vx = 0; s.vy = 0;
  s.rotationStyle = 'allAround';
  s._posHistory = [];
  s.image = null;
  if (s.costumePath) {
    const img = new Image();
    img.onload = () => { s.image = img; };
    img.src = s.costumePath;
  }
});

// 鼠标追踪
canvas.addEventListener('mousemove', e => {
  const r = canvas.getBoundingClientRect();
  mouseX = Math.round((e.clientX - r.left) / r.width * STAGE_W - STAGE_W/2);
  mouseY = Math.round((e.clientY - r.top) / r.height * STAGE_H - STAGE_H/2);
});
canvas.addEventListener('mousedown', () => { mouseDown = true; });
canvas.addEventListener('mouseup', () => { mouseDown = false; });

function log(msg) {
  output.push(String(msg));
  outputEl.textContent = output.join('\\n');
}
function delay(ms) {
  if (turboMode > 0) return Promise.resolve();
  return new Promise(r => setTimeout(r, ms));
}
function getActiveSprite() { return sprites[0]; }
function getActiveSpriteIdx() { return 0; }
function setSpritePos(idx, x, y) { sprites[idx].x = x; sprites[idx].y = y; }
function setSpriteDir(idx, d) { sprites[idx].direction = ((d - 90) % 360 + 360) % 360 + 90; }
function rotateSprite(idx, d) { sprites[idx].direction += d; }
function moveSprite(idx, steps) {
  const s = sprites[idx]; if (!s) return;
  const rad = (s.direction - 90) * Math.PI / 180;
  s.x += steps * Math.cos(rad);
  s.y += steps * Math.sin(rad);
}
function setSpriteVisible(idx, v) { sprites[idx].visible = v; }
function setSpriteSay(idx, text) { sprites[idx].sayText = text; }
function setSpriteSize(idx, sz) { sprites[idx].size = sz; }
function changeSpriteSize(idx, n) { sprites[idx].size += n; }
function bounceSprite(idx) {
  const s = sprites[idx]; if (!s) return;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  if (s.x < -hw || s.x > hw) s.direction = 180 - s.direction;
  if (s.y < -hh || s.y > hh) s.direction = -s.direction;
}
function pointTowards(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return;
  const dx = tx - s.x, dy = ty - s.y;
  s.direction = Math.atan2(dy, dx) * 180 / Math.PI + 90;
}
function moveTowards(idx, tx, ty, steps) {
  const s = sprites[idx]; if (!s) return;
  const dx = tx - s.x, dy = ty - s.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 1) return;
  s.x += (dx/dist) * steps;
  s.y += (dy/dist) * steps;
}
function getDistanceToPoint(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return 0;
  return Math.sqrt((tx-s.x)**2 + (ty-s.y)**2);
}
function getDirectionToPoint(idx, tx, ty) {
  const s = sprites[idx]; if (!s) return 0;
  return Math.atan2(ty - s.y, tx - s.x) * 180 / Math.PI + 90;
}
function isTouchingEdge(idx) {
  const s = sprites[idx]; if (!s) return false;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  return s.x <= -hw || s.x >= hw || s.y <= -hh || s.y >= hh;
}
function clampToStage(idx) {
  const s = sprites[idx]; if (!s) return;
  const hw = STAGE_W/2, hh = STAGE_H/2;
  s.x = Math.max(-hw, Math.min(hw, s.x));
  s.y = Math.max(-hh, Math.min(hh, s.y));
}
function mapKey(key) {
  const map = { ' ':'space','ArrowUp':'up','ArrowDown':'down','ArrowLeft':'left','ArrowRight':'right','Enter':'enter','Shift':'shift','Control':'control','Alt':'alt','Escape':'escape','Tab':'tab','Backspace':'backspace' };
  return map[key] || key.toLowerCase();
}

// 渲染
function render() {
  ctx.clearRect(0, 0, STAGE_W, STAGE_H);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, STAGE_W, STAGE_H);
  sprites.forEach(s => {
    if (!s.visible) return;
    ctx.save();
    ctx.translate(s.x + STAGE_W/2, s.y + STAGE_H/2);
    if (s.rotationStyle === 'allAround') ctx.rotate((s.direction - 90) * Math.PI / 180);
    else if (s.rotationStyle === 'leftRight' && s.direction > 180) ctx.scale(-1, 1);
    const sz = s.size / 100;
    ctx.scale(sz, sz);
    if (s.image) {
      ctx.drawImage(s.image, -30, -30, 60, 60);
    } else {
      ctx.fillStyle = s.color || '#89b4fa';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(6, -10); ctx.lineTo(-6, -10); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    if (s.sayText) {
      const bx = s.x + STAGE_W/2 + 25, by = s.y + STAGE_H/2 - 30;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#333'; ctx.lineWidth = 1;
      ctx.font = '12px sans-serif';
      const tw = ctx.measureText(s.sayText).width;
      ctx.beginPath(); ctx.roundRect(bx, by, tw+12, 22, 6); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#333'; ctx.fillText(s.sayText, bx+6, by+15);
    }
  });
  if (running) requestAnimationFrame(render);
}

// 执行引擎
async function executeChain(block, scope) {
  let cur = block;
  while (cur && !stopRequested) {
    const r = await executeBlock(cur, scope);
    if (r === '__RETURN__' || r === '__STOP__') return r;
    cur = cur.flowOut ? blocks[cur.flowOut] : null;
  }
}
function resolveParams(block, scope) {
  const result = {};
  // block 类型参数列表（返回积木引用而非执行结果）
  const BLOCK_TYPE_PARAMS = ['block'];
  if (block.params) {
    for (const [k, v] of Object.entries(block.params)) {
      const connId = block.paramConnections && block.paramConnections[k];
      if (connId && blocks[connId]) {
        // block 类型参数：返回积木引用
        if (BLOCK_TYPE_PARAMS.includes(k)) {
          result[k] = { __blockRef: connId };
        } else {
          result[k] = evaluateReporter(blocks[connId], scope);
        }
      } else {
        result[k] = v;
      }
    }
  }
  return result;
}
function evaluateReporter(block, scope) {
  const p = resolveParams(block, scope);
  switch(block.type) {
    case 'op_add': return Number(p.a) + Number(p.b);
    case 'op_sub': return Number(p.a) - Number(p.b);
    case 'op_mul': return Number(p.a) * Number(p.b);
    case 'op_div': return Number(p.b) ? Number(p.a) / Number(p.b) : 0;
    case 'op_mod': return Number(p.a) % Number(p.b);
    case 'op_random': return Math.floor(Math.random() * (Number(p.b) - Number(p.a) + 1)) + Number(p.a);
    case 'op_lt': return Number(p.a) < Number(p.b);
    case 'op_gt': return Number(p.a) > Number(p.b);
    case 'op_eq': return p.a == p.b;
    case 'op_and': return !!p.a && !!p.b;
    case 'op_or': return !!p.a || !!p.b;
    case 'op_not': return !p.a;
    case 'op_join': return String(p.a) + String(p.b);
    case 'op_strlen': return String(p.s).length;
    case 'op_math': { const n=Number(p.n); const fn=p.fn; if(fn==='abs')return Math.abs(n); if(fn==='floor')return Math.floor(n); if(fn==='ceil')return Math.ceil(n); if(fn==='sqrt')return Math.sqrt(n); if(fn==='sin')return Math.sin(n); if(fn==='cos')return Math.cos(n); if(fn==='tan')return Math.tan(n); return n; }
    case 'var_get': {
      if (dynamicFunctions[p.name]) {
        const df = dynamicFunctions[p.name];
        return { __blockRef: df.blockRef, __isFunction: true, __dynamicFn: p.name };
      }
      const fn = findFunction(p.name);
      if (fn) return { __blockRef: fn.id, __isFunction: true };
      return getVar(p.name, scope);
    }
    case 'get_x': return getActiveSprite()?.x || 0;
    case 'get_y': return getActiveSprite()?.y || 0;
    case 'get_direction': return getActiveSprite()?.direction || 90;
    case 'get_speed': { const s=getActiveSprite(); return s ? Math.sqrt(s.vx*s.vx+s.vy*s.vy) : 0; }
    case 'sensing_mouse_x': return mouseX;
    case 'sensing_mouse_y': return mouseY;
    case 'sensing_mouse_down': return mouseDown;
    case 'sensing_key_pressed': return !!pressedKeys[p.key];
    case 'sensing_timer': return (Date.now() - window.__timerStart) / 1000;
    case 'sensing_touching_edge': return isTouchingEdge(0);
    case 'sensing_current': { const now=new Date(); switch(p.unit){case'年':return now.getFullYear();case'月':return now.getMonth()+1;case'日':return now.getDate();case'时':return now.getHours();case'分':return now.getMinutes();case'秒':return now.getSeconds();default:return now.getSeconds();} }
    case 'io_answer': return window.__answer || '';
    case 'list_create': return [];
    case 'list_get': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr[Number(p.idx)-1]:undefined; }
    case 'list_length': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr.length:0; }
    case 'list_contains': { const arr=resolveListArray(p.list,scope); return Array.isArray(arr)?arr.includes(p.val):false; }
    case 'distance_to_mouse': return getDistanceToPoint(0, mouseX, mouseY);
    case 'direction_to_mouse': return getDirectionToPoint(0, mouseX, mouseY);
    case 'is_at_edge': return isTouchingEdge(0);
    case 'looks_get_size': return getActiveSprite()?.size || 100;
    // 元编程：积木本身作为值
    case 'control_code_block': {
      const sub = getSubTop(block, 'body');
      return { __blockRef: block.id, __closure: { ...scope } };
    }
    case 'control_run_return_block': {
      const bv = p.block;
      if (bv && bv.__blockRef) {
        const tb = blocks[bv.__blockRef];
        if (tb && tb.__closure) {
          const sub = getSubTop(tb, 'body');
          if (sub) {
            let result = undefined;
            const execSync = (b) => {
              let cur = b;
              while (cur) {
                if (cur.type === 'func_return') { result = resolveParams(cur, tb.__closure).val; return; }
                cur = cur.flowOut ? blocks[cur.flowOut] : null;
              }
            };
            execSync(sub);
            return result;
          }
        } else if (tb) {
          let result = undefined;
          const execSync = (b) => {
            let cur = b;
            while (cur) {
              if (cur.type === 'func_return') { result = resolveParams(cur, scope).val; return; }
              cur = cur.flowOut ? blocks[cur.flowOut] : null;
            }
          };
          execSync(tb);
          return result;
        }
      }
      return undefined;
    }
    default: return p[Object.keys(p)[0]] || 0;
  }
}
function resolveBool(val, block, paramName, scope) {
  if (block && paramName) {
    const connId = block.paramConnections && block.paramConnections[paramName];
    if (connId && blocks[connId]) return !!evaluateReporter(blocks[connId], scope);
  }
  return !!val;
}
function getVar(name, scope) { if (scope[name]!==undefined) return scope[name]; return globalVars[name]; }
function setVar(name, val, scope) { if (scope[name]!==undefined) scope[name]=val; else if(scope.__local) scope[name]=val; else globalVars[name]=val; }
function resolveListArray(val, scope) { if (Array.isArray(val)) return val; const v=getVar(String(val),scope); return Array.isArray(v)?v:null; }
function getSubTop(block, subName) { const subId = block.subBlocks && block.subBlocks[subName]; return subId ? blocks[subId] : null; }
function findFunction(name) { return Object.values(blocks).find(b => b.type === 'func_define' && b.params.name === name); }
function findBlockByLabel(label) {
  return Object.values(blocks).find(b => {
    if (b.type === 'control_label_run' && b.params && b.params.label === label) return true;
    if (b._importantLabel === label) return true;
    return false;
  });
}

async function executeBlock(block, scope) {
  const p = resolveParams(block, scope);
  const type = block.type;
  if (type==='event_start') {}
  else if (type==='event_broadcast') { const msg=String(p.msg); broadcastListeners.forEach(rb=>{ if(String(rb.params?.msg||'')===msg) executeChain(rb,{}).catch(e=>log('广播错误:'+e.message)); }); }
  else if (type==='event_broadcast_wait') { const msg=String(p.msg); const promises=[]; broadcastListeners.forEach(rb=>{ if(String(rb.params?.msg||'')===msg) promises.push(executeChain(rb,{})); }); if(promises.length>0) await Promise.all(promises); }
  else if (type==='event_receive') {}
  else if (type==='event_timer') {}
  else if (type==='event_key_pressed') {}
  else if (type==='move_steps') moveSprite(0, Number(p.steps));
  else if (type==='turn_right') rotateSprite(0, Number(p.deg));
  else if (type==='turn_left') rotateSprite(0, -Number(p.deg));
  else if (type==='go_to_xy') setSpritePos(0, Number(p.x), Number(p.y));
  else if (type==='go_to_random') { const hw=STAGE_W/2,hh=STAGE_H/2; setSpritePos(0,Math.random()*hw*2-hw,Math.random()*hh*2-hh); }
  else if (type==='go_to_mouse') setSpritePos(0, mouseX, mouseY);
  else if (type==='change_x') { const s=getActiveSprite(); if(s) s.x+=Number(p.dx); }
  else if (type==='set_x') { const s=getActiveSprite(); if(s) s.x=Number(p.x); }
  else if (type==='change_y') { const s=getActiveSprite(); if(s) s.y+=Number(p.dy); }
  else if (type==='set_y') { const s=getActiveSprite(); if(s) s.y=Number(p.y); }
  else if (type==='set_direction') setSpriteDir(0, Number(p.deg));
  else if (type==='point_towards_mouse') pointTowards(0, mouseX, mouseY);
  else if (type==='change_direction') rotateSprite(0, Number(p.ddir));
  else if (type==='bounce_edge') bounceSprite(0);
  else if (type==='rotation_style') { const s=getActiveSprite(); if(s){if(p.mode==='左右翻转')s.rotationStyle='leftRight';else if(p.mode==='不旋转')s.rotationStyle='noRotate';else s.rotationStyle='allAround';} }
  else if (type==='glide_to') { const s=getActiveSprite(); if(s){const sx=s.x,sy=s.y,tx=Number(p.x),ty=Number(p.y),ms=Math.max(Number(p.sec)*1000,16),st=Date.now(); while(!stopRequested){const t=Math.min((Date.now()-st)/ms,1);setSpritePos(0,sx+(tx-sx)*t,sy+(ty-sy)*t);if(t>=1)break;await delay(16);} } }
  else if (type==='random_move') { const mn=Number(p.min),mx=Number(p.max); moveSprite(0,Math.random()*(mx-mn)+mn); }
  else if (type==='random_turn') { const mn=Number(p.min),mx=Number(p.max); rotateSprite(0,Math.random()*(mx-mn)+mn); }
  else if (type==='clamp_to_stage') clampToStage(0);
  else if (type==='move_towards_mouse') moveTowards(0,mouseX,mouseY,p.steps);
  else if (type==='looks_show') setSpriteVisible(0, true);
  else if (type==='looks_hide') setSpriteVisible(0, false);
  else if (type==='looks_say') { setSpriteSay(0,String(p.text)); await delay(Number(p.sec)*1000); setSpriteSay(0,''); }
  else if (type==='looks_say_nowait') { setSpriteSay(0,String(p.text)); }
  else if (type==='looks_think') { setSpriteSay(0,'💭 '+String(p.text)); }
  else if (type==='looks_next_costume') { /* web: limited costume cycling */ }
  else if (type==='looks_set_size') setSpriteSize(0, Number(p.size));
  else if (type==='looks_change_size') changeSpriteSize(0, Number(p.n));
  else if (type==='wait') await delay(Number(p.sec)*1000);
  else if (type==='repeat') { const n=Number(p.times); for(let i=0;i<n&&!stopRequested;i++){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,{...scope,__i:i});if(r==='__RETURN__')return r;}} }
  else if (type==='forever') { while(!stopRequested){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}await delay(16);} }
  else if (type==='if_then') { if(resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}} }
  else if (type==='if_else') { if(resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'then');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}}else{const sub=getSubTop(block,'else');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}} }
  else if (type==='repeat_until') { while(!stopRequested&&!resolveBool(p.cond,block,'cond',scope)){const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;}await delay(16);} }
  else if (type==='stop_all') return '__STOP__';
  else if (type==='control_label_run') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  else if (type==='control_turbo') { turboMode++; try{const sub=getSubTop(block,'body');if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__'){turboMode--;return r;}}}finally{turboMode--;} }
  else if (type==='control_goto_label') { const targetLabel=String(p.label); const target=findBlockByLabel(targetLabel); if(target){const nextBlock=target.flowOut?blocks[target.flowOut]:null; if(nextBlock){const r=await executeChain(nextBlock,scope);if(r==='__RETURN__'||r==='__STOP__')return r;} return '__STOP__';} else { log('警告: 找不到代码标签 "'+targetLabel+'"'); } }
  else if (type==='control_run_block') {
    const bv=p.block;
    if(bv&&bv.__blockRef){
      const tb=blocks[bv.__blockRef];
      if(tb){
        // 函数定义
        if(tb.type==='func_define'||bv.__isFunction){
          const fnBody=tb.flowOut?blocks[tb.flowOut]:null;
          if(fnBody){const r=await executeChain(fnBody,scope);if(r==='__RETURN__')return r;}
        }
        // 代码块闭包
        else if(tb.__closure){
          const sub=getSubTop(tb,'body');
          if(sub){const r=await executeChain(sub,tb.__closure);if(r==='__RETURN__')return r;}
        }
        // 直接执行
        else{const r=await executeChain(tb,scope);if(r==='__RETURN__'||r==='__STOP__')return r;}
      }
    }
  }
  else if (type==='control_code_block') { const sub=getSubTop(block,'body'); if(sub){const r=await executeChain(sub,scope);if(r==='__RETURN__')return r;} }
  else if (type==='var_set') setVar(p.name, p.val, scope);
  else if (type==='var_change') { const cur=getVar(p.name,scope); setVar(p.name,Number(cur)+Number(p.val),scope); }
  else if (type==='var_show') { /* simplified */ }
  else if (type==='var_hide') { /* simplified */ }
  else if (type==='io_print') log(p.text);
  else if (type==='io_input') { log('询问: '+p.q); window.__answer=prompt(String(p.q))||''; log('回答: '+window.__answer); }
  else if (type==='sensing_reset_timer') window.__timerStart=Date.now();
  else if (type==='func_set_define') {
    const name=String(p.name).trim();
    const codeVal=p.code;
    if(name&&codeVal&&codeVal.__blockRef){
      const paramNames=(block._extraParams||[]).map(ep=>String(block.params[ep.name]||'').trim()).filter(Boolean);
      dynamicFunctions[name]={blockRef:codeVal.__blockRef,closure:codeVal.__closure||null,paramNames:paramNames};
    }
  }
  else if (type==='func_call') {
    const dynFn=dynamicFunctions[p.name];
    if(dynFn){
      const callArgs=(block._extraArgs||[]).map(ep=>{const connId=block.paramConnections&&block.paramConnections[ep.name];if(connId&&blocks[connId])return evaluateReporter(blocks[connId],scope);return block.params[ep.name]||'';});
      const fnScope={};
      dynFn.paramNames.forEach((name,i)=>{fnScope[name]=callArgs[i]!==undefined?callArgs[i]:'';});
      const tb=blocks[dynFn.blockRef];
      if(tb){
        const subTop=dynFn.closure?getSubTop(tb,'body'):(tb.type==='control_code_block'?getSubTop(tb,'body'):tb);
        const execScope=dynFn.closure?{...dynFn.closure,...fnScope}:{...scope,...fnScope};
        if(subTop){const r=await executeChain(subTop,execScope);if(r==='__RETURN__')return execScope.__return;}
      }
    } else {
      const fn=findFunction(p.name);
      if(fn){const callArgs=(block._extraParams||[]).map(ep=>{const connId=block.paramConnections&&block.paramConnections[ep.name];if(connId&&blocks[connId])return evaluateReporter(blocks[connId],scope);return block.params[ep.name]||'';});const fnScope={};const defParamNames=(fn._extraParams||[]).map(ep=>String(fn.params[ep.name]||'').trim()).filter(Boolean);defParamNames.forEach((name,i)=>{fnScope[name]=callArgs[i]!==undefined?callArgs[i]:'';});const next=fn.flowOut?blocks[fn.flowOut]:null;if(next){const r=await executeChain(next,fnScope);if(r==='__RETURN__')return fnScope.__return;}}
    }
  }
  else if (type==='func_return') { scope.__return=p.val; return '__RETURN__'; }
  else if (type==='list_push') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.push(p.val); }
  else if (type==='list_delete') { const arr=resolveListArray(p.list,scope); if(Array.isArray(arr))arr.splice(Number(p.idx)-1,1); }
  await delay(1);
}

async function startRun() {
  if (running) return;
  running = true; stopRequested = false;
  globalVars = {}; output = [];
  outputEl.textContent = '';
  window.__timerStart = Date.now();
  window.__answer = '';

  // 注册按键
  const keyBlocks = Object.values(blocks).filter(b => b.type === 'event_key_pressed');
  const firedKeys = {};
  if (keyBlocks.length > 0) {
    keyHandler = (e) => {
      if (!running || stopRequested) return;
      const kn = mapKey(e.key);
      pressedKeys[kn] = true;
      keyBlocks.forEach(b => {
        const tk = (b.params && b.params.key) || 'space';
        if (tk === kn && !firedKeys[kn]) { firedKeys[kn] = true; executeChain(b, {}).catch(err => log(err.message)); }
      });
    };
    const upHandler = (e) => { const kn = mapKey(e.key); delete firedKeys[kn]; delete pressedKeys[kn]; };
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('keyup', upHandler);
    keyHandler._up = upHandler;
  }

  // 注册定时器
  const timerBlocks = Object.values(blocks).filter(b => b.type === 'event_timer');
  timerBlocks.forEach(tb => {
    const ms = Math.max(Number(tb.params?.sec || 1) * 1000, 50);
    timers.push(setInterval(() => { if (!stopRequested) executeChain(tb, {}).catch(e => log(e.message)); }, ms));
  });

  // 注册广播接收者
  broadcastListeners = Object.values(blocks).filter(b => b.type === 'event_receive');

  render();

  // 运行 event_start
  const starts = Object.values(blocks).filter(b => b.type === 'event_start');
  for (const s of starts) { if (stopRequested) break; await executeChain(s, {}); }

  // 保持运行
  const hasEvents = keyBlocks.length > 0 || timerBlocks.length > 0 || broadcastListeners.length > 0;
  if (hasEvents && !stopRequested) {
    while (!stopRequested) await delay(100);
  }

  stopRun();
}

function stopRun() {
  stopRequested = true;
  running = false;
  timers.forEach(id => clearInterval(id));
  timers = [];
  broadcastListeners = [];
  pressedKeys = {};
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler);
    if (keyHandler._up) document.removeEventListener('keyup', keyHandler._up);
    keyHandler = null;
  }
}
</script>
</body>
</html>`;
  }

  /** 导出 HTML 文件 */
  async function exportProject() {
    if (!EditorState.projectPath) {
      alert(i18n.t('status.openProjectFirst'));
      return;
    }

    const projectName = EditorState.projectName || 'Objector';
    const blocksData = EditorState.blocks || {};

    // 获取精灵数据（包含贴图 base64）
    const spritesData = [];
    const sprites = StageManager.getSprites();
    for (const s of sprites) {
      const spriteData = {
        name: s.name,
        x: s.x, y: s.y,
        direction: s.direction,
        size: s.size,
        visible: s.visible,
        color: s.color || '#89b4fa',
      };
      // 如果有贴图，转为 base64
      if (s.image) {
        try {
          const tmpCanvas = document.createElement('canvas');
          tmpCanvas.width = 60; tmpCanvas.height = 60;
          const tmpCtx = tmpCanvas.getContext('2d');
          tmpCtx.drawImage(s.image, 0, 0, 60, 60);
          spriteData.costumePath = tmpCanvas.toDataURL('image/png');
        } catch (e) {}
      }
      spritesData.push(spriteData);
    }

    const html = generateHTML(projectName, blocksData, spritesData);

    // Web 版：直接触发浏览器下载
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = projectName + '.html';
    a.click();
    URL.revokeObjectURL(url);

    document.getElementById('status-text').textContent = (i18n.isEnglish() ? 'Exported HTML: ' : '已导出 HTML: ') + projectName + '.html';
    setTimeout(() => {
      document.getElementById('status-text').textContent = i18n.t('status.ready');
    }, 3000);
  }

  return { exportProject, generateHTML };
})();
