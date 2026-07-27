/**
 * 内置扩展 - 预装扩展积木，无需加载文件
 */
(function () {

  // ========== 1. 时间工具 ==========
  ExtensionManager.registerExtension({
    id: 'ext_time',
    name: '时间',
    color: '#5D9CEC',
    blocks: [
      {
        type: 'ext_time_now', label: '当前时间戳（毫秒）', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_seconds', label: '当前秒数', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_minutes', label: '当前分钟', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_hours', label: '当前小时', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_date', label: '当前日期', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_format', label: '格式化时间 {fmt}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 'fmt', type: 'string', default: 'YYYY-MM-DD HH:mm:ss' }],
      },
      {
        type: 'ext_time_timer', label: '计时器（秒）', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
      {
        type: 'ext_time_reset_timer', label: '重置计时器', shape: 'stack',
        ports: { flowIn: true, flowOut: true }, params: [],
      },
    ],
    executors: {
      ext_time_now: 'function() { return Date.now(); }',
      ext_time_seconds: 'function() { return new Date().getSeconds(); }',
      ext_time_minutes: 'function() { return new Date().getMinutes(); }',
      ext_time_hours: 'function() { return new Date().getHours(); }',
      ext_time_date: 'function() { var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }',
      ext_time_format: 'function(params) { var d=new Date(); var f=params.fmt; f=f.replace("YYYY",d.getFullYear()).replace("MM",String(d.getMonth()+1).padStart(2,"0")).replace("DD",String(d.getDate()).padStart(2,"0")).replace("HH",String(d.getHours()).padStart(2,"0")).replace("mm",String(d.getMinutes()).padStart(2,"0")).replace("ss",String(d.getSeconds()).padStart(2,"0")); return f; }',
      ext_time_timer: 'function() { return Math.floor((Date.now() - (window.__extTimerStart || Date.now())) / 1000); }',
      ext_time_reset_timer: 'function() { window.__extTimerStart = Date.now(); }',
    },
  });

  // ========== 2. 绘图工具 ==========
  ExtensionManager.registerExtension({
    id: 'ext_drawing',
    name: '绘图',
    color: '#48CFAD',
    blocks: [
      {
        type: 'ext_draw_clear', label: '清除画布', shape: 'stack',
        ports: { flowIn: true, flowOut: true }, params: [],
      },
      {
        type: 'ext_draw_pen_color', label: '设置画笔颜色 {color}', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'color', type: 'string', default: '#ffffff' }],
      },
      {
        type: 'ext_draw_pen_size', label: '设置画笔粗细 {size}', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'size', type: 'number', default: 2 }],
      },
      {
        type: 'ext_draw_pen_down', label: '落笔', shape: 'stack',
        ports: { flowIn: true, flowOut: true }, params: [],
      },
      {
        type: 'ext_draw_pen_up', label: '抬笔', shape: 'stack',
        ports: { flowIn: true, flowOut: true }, params: [],
      },
      {
        type: 'ext_draw_line', label: '画线 从({x1},{y1}) 到({x2},{y2})', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
          { name: 'x1', type: 'number', default: -100 }, { name: 'y1', type: 'number', default: 0 },
          { name: 'x2', type: 'number', default: 100 }, { name: 'y2', type: 'number', default: 0 },
        ],
      },
      {
        type: 'ext_draw_circle', label: '画圆 中心({x},{y}) 半径{r}', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
          { name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: 0 },
          { name: 'r', type: 'number', default: 50 },
        ],
      },
      {
        type: 'ext_draw_rect', label: '画矩形 ({x},{y}) 宽{w} 高{h}', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
          { name: 'x', type: 'number', default: -50 }, { name: 'y', type: 'number', default: -50 },
          { name: 'w', type: 'number', default: 100 }, { name: 'h', type: 'number', default: 80 },
        ],
      },
      {
        type: 'ext_draw_text', label: '写文字 {text} 在({x},{y})', shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [
          { name: 'text', type: 'string', default: 'Hello' },
          { name: 'x', type: 'number', default: 0 }, { name: 'y', type: 'number', default: 0 },
        ],
      },
    ],
    executors: {
      ext_draw_clear: 'function() { var c=document.getElementById("stage-canvas"); if(c){var ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);} }',
      ext_draw_pen_color: 'function(params) { window.__penColor = params.color; }',
      ext_draw_pen_size: 'function(params) { window.__penSize = Number(params.size); }',
      ext_draw_pen_down: 'function() { window.__penDown = true; }',
      ext_draw_pen_up: 'function() { window.__penDown = false; }',
      ext_draw_line: 'function(params) { var c=document.getElementById("stage-canvas");if(!c)return;var ctx=c.getContext("2d");ctx.strokeStyle=window.__penColor||"#fff";ctx.lineWidth=window.__penSize||2;ctx.beginPath();ctx.moveTo(Number(params.x1)+c.width/2,c.height/2-Number(params.y1));ctx.lineTo(Number(params.x2)+c.width/2,c.height/2-Number(params.y2));ctx.stroke(); }',
      ext_draw_circle: 'function(params) { var c=document.getElementById("stage-canvas");if(!c)return;var ctx=c.getContext("2d");ctx.strokeStyle=window.__penColor||"#fff";ctx.lineWidth=window.__penSize||2;ctx.beginPath();ctx.arc(Number(params.x)+c.width/2,c.height/2-Number(params.y),Number(params.r),0,Math.PI*2);ctx.stroke(); }',
      ext_draw_rect: 'function(params) { var c=document.getElementById("stage-canvas");if(!c)return;var ctx=c.getContext("2d");ctx.strokeStyle=window.__penColor||"#fff";ctx.lineWidth=window.__penSize||2;ctx.strokeRect(Number(params.x)+c.width/2,c.height/2-Number(params.y)-Number(params.h),Number(params.w),Number(params.h)); }',
      ext_draw_text: 'function(params) { var c=document.getElementById("stage-canvas");if(!c)return;var ctx=c.getContext("2d");ctx.fillStyle=window.__penColor||"#fff";ctx.font="14px sans-serif";ctx.fillText(params.text,Number(params.x)+c.width/2,c.height/2-Number(params.y)); }',
    },
  });

  // ========== 3. 字符串工具 ==========
  ExtensionManager.registerExtension({
    id: 'ext_string',
    name: '字符串',
    color: '#FC6E51',
    blocks: [
      {
        type: 'ext_str_length', label: '{s} 的长度', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_char_at', label: '{s} 第 {i} 个字符', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'i', type: 'number', default: 1 }],
      },
      {
        type: 'ext_str_substring', label: '{s} 从 {start} 到 {end}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'start', type: 'number', default: 1 }, { name: 'end', type: 'number', default: 3 }],
      },
      {
        type: 'ext_str_replace', label: '{s} 中 {old} 替换为 {new}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'old', type: 'string', default: '' }, { name: 'new', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_upper', label: '{s} 转大写', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_lower', label: '{s} 转小写', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_trim', label: '去除 {s} 两端空格', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_split', label: '用 {sep} 分割 {s}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'sep', type: 'string', default: ',' }],
      },
      {
        type: 'ext_str_contains', label: '{s} 包含 {sub}', shape: 'boolean',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'sub', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_reverse', label: '反转 {s}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }],
      },
      {
        type: 'ext_str_repeat', label: '重复 {s} {n} 次', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 's', type: 'string', default: '' }, { name: 'n', type: 'number', default: 3 }],
      },
    ],
    executors: {
      ext_str_length: 'function(params) { return String(params.s).length; }',
      ext_str_char_at: 'function(params) { return String(params.s).charAt(Number(params.i) - 1); }',
      ext_str_substring: 'function(params) { return String(params.s).substring(Number(params.start) - 1, Number(params.end)); }',
      ext_str_replace: 'function(params) { return String(params.s).split(params.old).join(params.new); }',
      ext_str_upper: 'function(params) { return String(params.s).toUpperCase(); }',
      ext_str_lower: 'function(params) { return String(params.s).toLowerCase(); }',
      ext_str_trim: 'function(params) { return String(params.s).trim(); }',
      ext_str_split: 'function(params) { return String(params.s).split(params.sep); }',
      ext_str_contains: 'function(params) { return String(params.s).includes(params.sub); }',
      ext_str_reverse: 'function(params) { return String(params.s).split("").reverse().join(""); }',
      ext_str_repeat: 'function(params) { return String(params.s).repeat(Math.max(0, Number(params.n))); }',
    },
  });

  // ========== 4. 随机与颜色 ==========
  ExtensionManager.registerExtension({
    id: 'ext_color',
    name: '颜色',
    color: '#ED5565',
    blocks: [
      {
        type: 'ext_color_rgb', label: 'RGB({r},{g},{b})', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [
          { name: 'r', type: 'number', default: 255 },
          { name: 'g', type: 'number', default: 0 },
          { name: 'b', type: 'number', default: 0 },
        ],
      },
      {
        type: 'ext_color_hex', label: '颜色 #{hex}', shape: 'reporter',
        ports: { flowIn: false, flowOut: false },
        params: [{ name: 'hex', type: 'string', default: 'FF5500' }],
      },
      {
        type: 'ext_color_random', label: '随机颜色', shape: 'reporter',
        ports: { flowIn: false, flowOut: false }, params: [],
      },
    ],
    executors: {
      ext_color_rgb: 'function(params) { var r=Math.max(0,Math.min(255,Number(params.r)));var g=Math.max(0,Math.min(255,Number(params.g)));var b=Math.max(0,Math.min(255,Number(params.b)));return "#"+r.toString(16).padStart(2,"0")+g.toString(16).padStart(2,"0")+b.toString(16).padStart(2,"0"); }',
      ext_color_hex: 'function(params) { return "#" + params.hex; }',
      ext_color_random: 'function() { return "#"+Math.floor(Math.random()*16777215).toString(16).padStart(6,"0"); }',
    },
  });

})();
