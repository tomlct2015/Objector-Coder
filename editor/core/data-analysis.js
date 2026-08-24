/**
 * DataAnalysis - 数据分析模块
 * 提供类似 Python 的数据分析环境：图表、统计、数据处理
 */
const DataAnalysis = (function () {
  let _editor = null;        // CodeMirror 实例
  let _chart = null;         // Chart.js 实例
  let _dataStore = {};       // 全局数据存储（用户定义的变量）
  let _logEl = null;
  let _tableEl = null;
  let _chartCanvas = null;
  let _running = false;

  const DEFAULT_CODE = `# 数据分析示例
# 支持类似 Python 的语法

# 导入数据（点击工具栏按钮导入 CSV/JSON，或手动定义）
data = [10, 25, 30, 45, 60, 35, 50]
labels = ["一月", "二月", "三月", "四月", "五月", "六月", "七月"]

# 绘制柱状图
plot.bar(labels, data, title="月度数据统计")

# 统计信息
print("平均值:", stats.mean(data))
print("中位数:", stats.median(data))
print("标准差:", stats.std(data))
print("最大值:", stats.max(data))
print("最小值:", stats.min(data))
print("总和:", stats.sum(data))

# 显示数据表格
table.show(labels, data)
`;

  /** 初始化数据分析模式 */
  function init() {
    // 显示数据分析布局，隐藏其他布局
    document.getElementById('main-layout')?.classList.add('hidden');
    document.getElementById('advanced-layout')?.classList.add('hidden');
    document.getElementById('data-layout')?.classList.remove('hidden');
    // 隐藏积木面板和舞台
    document.getElementById('palette-panel')?.classList.add('hidden');

    // 初始化 CodeMirror
    const editorEl = document.getElementById('data-editor');
    if (editorEl && typeof CodeMirror !== 'undefined') {
      _editor = CodeMirror(editorEl, {
        mode: 'javascript',
        theme: 'material-darker',
        lineNumbers: true,
        tabSize: 2,
        indentWithTabs: false,
        matchBrackets: true,
        autoCloseBrackets: true,
        value: DEFAULT_CODE,
        extraKeys: {
          'Ctrl-Enter': () => run(),
          'Cmd-Enter': () => run(),
        }
      });
    }

    _logEl = document.getElementById('data-log');
    _tableEl = document.getElementById('data-table');
    _chartCanvas = document.getElementById('data-chart-canvas');

    // 绑定工具栏按钮
    document.getElementById('data-run')?.addEventListener('click', run);
    document.getElementById('data-stop')?.addEventListener('click', stop);
    document.getElementById('data-clear-output')?.addEventListener('click', clearOutput);
    document.getElementById('data-import-csv')?.addEventListener('click', () => importFile('csv'));
    document.getElementById('data-import-json')?.addEventListener('click', () => importFile('json'));

    // 输出 tab 切换
    document.querySelectorAll('#data-output-tabs .data-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#data-output-tabs .data-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const tabName = tab.dataset.tab;
        document.getElementById('data-chart-content')?.classList.toggle('hidden', tabName !== 'chart');
        document.getElementById('data-table-content')?.classList.toggle('hidden', tabName !== 'table');
        document.getElementById('data-log-content')?.classList.toggle('hidden', tabName !== 'log');
        if (tabName === 'chart' && _chart) _chart.resize();
      });
    });

    // 分割条拖拽
    _initDivider();

    updateInfo();
  }

  /** 分割条拖拽 */
  function _initDivider() {
    const divider = document.getElementById('data-divider');
    const codePanel = document.getElementById('data-code-panel');
    if (!divider || !codePanel) return;

    let dragging = false;
    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const main = document.getElementById('data-main');
      if (!main) return;
      const rect = main.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const minW = 200, maxW = rect.width - 200;
      codePanel.style.width = Math.max(minW, Math.min(newWidth, maxW)) + 'px';
      if (_editor) _editor.refresh();
      if (_chart) _chart.resize();
    });
    document.addEventListener('mouseup', () => { dragging = false; });
  }

  /** 运行代码 */
  function run() {
    if (!_editor) return;
    const code = _editor.getValue();
    _running = true;
    document.getElementById('data-run').disabled = true;
    document.getElementById('data-stop').disabled = false;

    clearOutput();
    _dataStore = {};

    // 构建内置 API
    const api = _buildAPI();

    try {
      // 将 Python 风格语法转换为 JavaScript
      const jsCode = _transpileCode(code);

      // 在沙箱中执行
      const fn = new Function('print', 'plot', 'stats', 'table', 'import_csv', 'import_json', 'data', jsCode);
      fn(api.print, api.plot, api.stats, api.table, api.import_csv, api.import_json, _dataStore);
    } catch (e) {
      _appendLog('❌ 错误: ' + e.message, 'error');
    }

    _running = false;
    document.getElementById('data-run').disabled = false;
    document.getElementById('data-stop').disabled = true;
    updateInfo();
  }

  /** 停止运行 */
  function stop() {
    _running = false;
    document.getElementById('data-run').disabled = false;
    document.getElementById('data-stop').disabled = true;
    _appendLog('⏹ 已停止', 'info');
  }

  /** 清除输出 */
  function clearOutput() {
    if (_logEl) _logEl.textContent = '';
    if (_tableEl) _tableEl.innerHTML = '';
    if (_chart) {
      _chart.destroy();
      _chart = null;
    }
  }

  /** 构建内置 API */
  function _buildAPI() {
    return {
      print: function (...args) {
        _appendLog(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
      },
      plot: {
        bar: (labels, data, opts) => _drawChart('bar', labels, data, opts),
        line: (labels, data, opts) => _drawChart('line', labels, data, opts),
        pie: (labels, data, opts) => _drawChart('pie', labels, data, opts),
        scatter: (labels, data, opts) => _drawChart('scatter', labels, data, opts),
        doughnut: (labels, data, opts) => _drawChart('doughnut', labels, data, opts),
        radar: (labels, data, opts) => _drawChart('radar', labels, data, opts),
      },
      stats: {
        mean: (arr) => arr.reduce((a, b) => a + b, 0) / arr.length,
        sum: (arr) => arr.reduce((a, b) => a + b, 0),
        min: (arr) => Math.min(...arr),
        max: (arr) => Math.max(...arr),
        median: (arr) => {
          const sorted = [...arr].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        },
        std: (arr) => {
          const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
          return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
        },
        variance: (arr) => {
          const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
          return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
        },
        range: (arr) => Math.max(...arr) - Math.min(...arr),
        count: (arr) => arr.length,
        percentile: (arr, p) => {
          const sorted = [...arr].sort((a, b) => a - b);
          const idx = (p / 100) * (sorted.length - 1);
          const lo = Math.floor(idx), hi = Math.ceil(idx);
          return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
        },
      },
      table: {
        show: (labels, ...cols) => _showTable(labels, cols),
      },
      import_csv: (name) => _dataStore[name] || null,
      import_json: (name) => _dataStore[name] || null,
    };
  }

  /** Python 风格语法转 JavaScript */
  function _transpileCode(code) {
    let js = code;
    // # 注释 → // 注释
    js = js.replace(/^( *)#(.*)$/gm, '$1//$2');
    // print() → print()  (保持不变，使用自定义 print)
    // = 赋值（简单变量）→ let/const
    js = js.replace(/^([a-zA-Z_]\w*) *= *(.+)$/gm, (match, name, value) => {
      if (['print', 'plot', 'stats', 'table', 'import_csv', 'import_json', 'data'].includes(name)) return match;
      return 'let ' + name + ' = ' + value;
    });
    return js;
  }

  /** 绘制图表 */
  function _drawChart(type, labels, data, opts = {}) {
    if (!_chartCanvas || typeof Chart === 'undefined') return;

    // 切换到图表 tab
    document.querySelector('[data-tab="chart"]')?.click();

    if (_chart) _chart.destroy();

    const title = opts.title || '';
    const colors = _generateColors(Array.isArray(data[0]) ? data.length : (data.length || 8));

    const datasets = [];
    if (type === 'pie' || type === 'doughnut' || type === 'radar') {
      datasets.push({
        data: data,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('0.7', '1')),
        borderWidth: 1,
      });
    } else if (Array.isArray(data[0])) {
      // 多数据集
      data.forEach((d, i) => {
        datasets.push({
          label: (opts.labels && opts.labels[i]) || ('数据 ' + (i + 1)),
          data: d,
          backgroundColor: colors[i],
          borderColor: colors[i].replace('0.7', '1'),
          borderWidth: 2,
          fill: type === 'line' ? false : undefined,
          tension: type === 'line' ? 0.3 : undefined,
        });
      });
    } else {
      datasets.push({
        label: title || '数据',
        data: data,
        backgroundColor: type === 'bar' ? colors[0] : colors,
        borderColor: colors.map(c => c.replace('0.7', '1')),
        borderWidth: type === 'line' ? 2 : 1,
        fill: type === 'line' ? false : undefined,
        tension: type === 'line' ? 0.3 : undefined,
        pointRadius: type === 'scatter' ? 5 : undefined,
      });
    }

    _chart = new Chart(_chartCanvas, {
      type: type,
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: !!title, text: title, color: '#cdd6f4', font: { size: 16 } },
          legend: { labels: { color: '#cdd6f4' } },
        },
        scales: (type === 'pie' || type === 'doughnut' || type === 'radar') ? {} : {
          x: { ticks: { color: '#a6adc8' }, grid: { color: 'rgba(166,173,200,0.1)' } },
          y: { ticks: { color: '#a6adc8' }, grid: { color: 'rgba(166,173,200,0.1)' } },
        },
      }
    });
  }

  /** 显示数据表格 */
  function _showTable(labels, cols) {
    if (!_tableEl) return;

    // 切换到表格 tab
    document.querySelector('[data-tab="table"]')?.click();

    let html = '<table class="data-table"><thead><tr><th>#</th>';
    if (labels) labels.forEach(l => { html += '<th>' + l + '</th>'; });
    html += '</tr></thead><tbody>';

    const rowCount = (cols[0] || []).length;
    for (let i = 0; i < rowCount; i++) {
      html += '<tr><td>' + (i + 1) + '</td>';
      cols.forEach(col => {
        html += '<td>' + (col[i] !== undefined ? col[i] : '') + '</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    _tableEl.innerHTML = html;
  }

  /** 生成颜色数组 */
  function _generateColors(n) {
    const palette = [
      'rgba(137,180,250,0.7)', 'rgba(166,227,161,0.7)', 'rgba(249,226,175,0.7)',
      'rgba(243,139,168,0.7)', 'rgba(203,166,247,0.7)', 'rgba(148,226,213,0.7)',
      'rgba(250,179,135,0.7)', 'rgba(116,199,236,0.7)', 'rgba(245,194,231,0.7)',
      'rgba(166,209,237,0.7)', 'rgba(235,160,172,0.7)', 'rgba(180,190,254,0.7)',
    ];
    const result = [];
    for (let i = 0; i < n; i++) result.push(palette[i % palette.length]);
    return result;
  }

  /** 追加日志 */
  function _appendLog(text, type = 'normal') {
    if (!_logEl) return;
    const span = document.createElement('span');
    span.style.color = type === 'error' ? '#f38ba8' : type === 'info' ? '#89b4fa' : '#cdd6f4';
    span.textContent = text + '\n';
    _logEl.appendChild(span);
    _logEl.scrollTop = _logEl.scrollHeight;
  }

  /** 导入文件 */
  function importFile(format) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'csv' ? '.csv' : '.json';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      const text = await file.text();
      const name = file.name.replace(/\.\w+$/, '');

      if (format === 'csv') {
        const parsed = _parseCSV(text);
        _dataStore[name] = parsed;
        _appendLog('✅ 已导入 CSV: ' + file.name + ' (' + parsed.rows.length + ' 行, ' + parsed.headers.length + ' 列)', 'info');
        // 插入代码
        if (_editor) {
          const insertCode = `\n# 已导入: ${file.name}\n${name} = data['${name}']\nheaders = ${JSON.stringify(parsed.headers)}\n`;
          _editor.setValue(_editor.getValue() + insertCode);
        }
      } else {
        const parsed = JSON.parse(text);
        _dataStore[name] = parsed;
        _appendLog('✅ 已导入 JSON: ' + file.name, 'info');
        if (_editor) {
          const insertCode = `\n# 已导入: ${file.name}\n${name} = data['${name}']\n`;
          _editor.setValue(_editor.getValue() + insertCode);
        }
      }
      updateInfo();
    };
    input.click();
  }

  /** 解析 CSV */
  function _parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => {
        v = v.trim();
        const num = Number(v);
        return isNaN(num) ? v : num;
      });
      rows.push(values);
    }
    // 构建列数据
    const columns = {};
    headers.forEach((h, idx) => {
      columns[h] = rows.map(r => r[idx]);
    });
    return { headers, rows, columns };
  }

  /** 更新信息 */
  function updateInfo() {
    const el = document.getElementById('data-info');
    if (el) {
      const keys = Object.keys(_dataStore);
      el.textContent = keys.length > 0
        ? '已加载数据: ' + keys.join(', ')
        : '使用工具栏导入 CSV/JSON 数据';
    }
  }

  /** 获取代码编辑器 */
  function getEditor() { return _editor; }

  /** 获取代码 */
  function getCode() { return _editor ? _editor.getValue() : ''; }

  /** 设置代码 */
  function setCode(code) { if (_editor) _editor.setValue(code); }

  return { init, run, stop, clearOutput, importFile, getEditor, getCode, setCode };
})();
