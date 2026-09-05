/**
 * AI 辅助编程模块 - 通过自然语言生成积木、解释代码、调试建议
 * 支持 OpenAI 兼容 API（OpenAI、DeepSeek、Ollama 等）
 */
const AIAssistant = (function () {
  let _config = {
    provider: 'openai',      // openai | deepseek | ollama | custom
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    maxTokens: 2048,
    temperature: 0.7,
  };

  // 从 localStorage 加载配置
  function _loadConfig() {
    try {
      const saved = localStorage.getItem('ai-config');
      if (saved) {
        Object.assign(_config, JSON.parse(saved));
      }
    } catch {}
  }

  function _saveConfig() {
    localStorage.setItem('ai-config', JSON.stringify(_config));
  }

  /** 获取可用积木类型的描述 */
  function _getBlockCatalog() {
    const allBlocks = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getAllBlocks() : {};
    const categories = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getCategories() : [];
    let catalog = '可用积木分类和类型：\n';
    categories.forEach(cat => {
      const blocks = Object.values(allBlocks).filter(b => b.category === cat.id);
      catalog += `\n【${cat.name}】\n`;
      blocks.forEach(b => {
        const params = (b.params || []).map(p => `{${p.name}:${p.type}=${p.default || ''}}`).join(',');
        catalog += `  - ${b.type}: ${b.label}${params ? ' 参数:' + params : ''}\n`;
      });
    });
    return catalog;
  }

  /** 获取当前项目积木的文本描述 */
  function _getCurrentBlocksDescription() {
    const blocks = window.EditorState?.blocks || {};
    if (Object.keys(blocks).length === 0) return '当前项目没有积木。';
    let desc = `当前项目有 ${Object.keys(blocks).length} 个积木：\n`;
    Object.values(blocks).forEach(b => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(b.type) : null;
      const label = def ? def.label : b.type;
      const paramStr = Object.entries(b.params || {}).map(([k, v]) => `${k}=${v}`).join(', ');
      desc += `  [${b.id}] ${label}${paramStr ? ' (' + paramStr + ')' : ''} at (${Math.round(b.x)}, ${Math.round(b.y)})`;
      if (b.flowOut) desc += ` → ${b.flowOut}`;
      if (b.subBlocks) desc += ` 子积木:[${Object.values(b.subBlocks).join(',')}]`;
      desc += '\n';
    });
    return desc;
  }

  /** 调用 AI API */
  async function _callAPI(messages) {
    if (!_config.apiKey && _config.provider !== 'ollama') {
      throw new Error('请先配置 AI API Key。点击 ⚙️ 设置按钮进行配置。');
    }

    const url = _config.baseUrl + '/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
    };
    if (_config.apiKey) {
      headers['Authorization'] = 'Bearer ' + _config.apiKey;
    }

    const body = {
      model: _config.model,
      messages: messages,
      max_tokens: _config.maxTokens,
      temperature: _config.temperature,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API 错误 (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  /** 从自然语言描述生成积木 */
  async function generateBlocks(description) {
    const systemPrompt = `你是一个积木编程助手。用户会用自然语言描述想要的功能，你需要生成对应的积木 JSON 数组。

${_getBlockCatalog()}

输出格式要求（仅输出 JSON，不要其他文字）：
[
  { "type": "积木类型", "params": { "参数名": 值 }, "x": 数字, "y": 数字 }
]

规则：
- x, y 是积木位置坐标，第一个积木从 (100, 100) 开始，后续积木 y 递增 60
- 只使用上面列出的积木类型
- 参数值要合理
- 如果是循环/条件，使用 c-block 类型并在 subBlocks 中包含子积木`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `请生成积木来实现：${description}` },
    ];

    const response = await _callAPI(messages);
    
    // 尝试解析 JSON
    try {
      // 提取 JSON 部分（可能被 markdown 代码块包裹）
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];
      
      const blocks = JSON.parse(jsonStr.trim());
      return { success: true, blocks, raw: response };
    } catch (e) {
      return { success: false, error: '无法解析 AI 响应: ' + e.message, raw: response };
    }
  }

  /** 解释当前积木代码 */
  async function explainCode() {
    const blocksDesc = _getCurrentBlocksDescription();
    const messages = [
      { role: 'system', content: '你是一个积木编程导师。用简洁的中文解释这段积木代码的功能、逻辑流程和可能的改进建议。' },
      { role: 'user', content: `请解释这段积木代码：\n\n${blocksDesc}` },
    ];
    return await _callAPI(messages);
  }

  /** 调试建议 */
  async function debugSuggest(output) {
    const blocksDesc = _getCurrentBlocksDescription();
    const messages = [
      { role: 'system', content: '你是一个积木编程调试专家。分析代码和运行输出，找出问题并给出修复建议。用简洁的中文回答。' },
      { role: 'user', content: `积木代码：\n${blocksDesc}\n\n运行输出：\n${output}\n\n请分析问题并给出修复建议。` },
    ];
    return await _callAPI(messages);
  }

  /** 优化建议 */
  async function optimizeSuggest() {
    const blocksDesc = _getCurrentBlocksDescription();
    const messages = [
      { role: 'system', content: '你是一个积木编程优化专家。分析代码，给出性能优化、代码简化和最佳实践建议。用简洁的中文回答。' },
      { role: 'user', content: `请优化这段积木代码：\n\n${blocksDesc}` },
    ];
    return await _callAPI(messages);
  }

  /** 将 AI 生成的积木添加到项目 */
  function applyGeneratedBlocks(generatedBlocks) {
    const blocks = window.EditorState?.blocks;
    if (!blocks || !Array.isArray(generatedBlocks)) return false;

    const idMap = {};
    const newBlocks = {};

    generatedBlocks.forEach((gb, idx) => {
      const def = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(gb.type) : null;
      if (!def) return;

      const newId = 'ai_' + Date.now().toString(36) + '_' + idx;
      idMap[idx] = newId;

      newBlocks[newId] = {
        id: newId,
        type: gb.type,
        x: gb.x || 100 + idx * 20,
        y: gb.y || 100 + idx * 60,
        params: gb.params || {},
        ports: {},
      };
      // 初始化默认参数
      (def.params || []).forEach(p => {
        if (newBlocks[newId].params[p.name] === undefined) {
          newBlocks[newId].params[p.name] = p.default;
        }
      });
    });

    // 连接 flowOut 链（按顺序连接）
    const ids = Object.keys(newBlocks);
    for (let i = 0; i < ids.length - 1; i++) {
      const curBlock = newBlocks[ids[i]];
      const nextBlock = newBlocks[ids[i + 1]];
      const curDef = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(curBlock.type) : null;
      const nextDef = typeof BlockRegistry !== 'undefined' ? BlockRegistry.getBlock(nextBlock.type) : null;
      if (curDef?.ports?.flowOut && nextDef?.ports?.flowIn) {
        curBlock.flowOut = nextBlock.id;
        nextBlock.flowIn = curBlock.id;
      }
    }

    Object.assign(blocks, newBlocks);
    
    // 记录撤销历史
    if (typeof HistoryManager !== 'undefined') HistoryManager.pushSnapshot();
    
    // 重新渲染
    if (typeof EditorCanvas !== 'undefined') EditorCanvas.render();
    
    // 更新计数
    const count = Object.keys(blocks).length;
    const countEl = document.getElementById('block-count');
    if (countEl) countEl.textContent = `积木: ${count}`;

    return Object.keys(newBlocks).length;
  }

  /** 获取/设置配置 */
  function getConfig() { return { ..._config }; }
  function setConfig(newConfig) {
    Object.assign(_config, newConfig);
    _saveConfig();
  }

  /** 预设提供商 */
  const PRESETS = {
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    deepseek: { baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    ollama: { baseUrl: 'http://localhost:11434/v1', model: 'qwen2.5-coder:7b', apiKey: '' },
    custom: { baseUrl: '', model: '' },
  };

  function setProvider(name) {
    if (PRESETS[name]) {
      _config.provider = name;
      _config.baseUrl = PRESETS[name].baseUrl;
      _config.model = PRESETS[name].model;
      if (PRESETS[name].apiKey !== undefined) _config.apiKey = PRESETS[name].apiKey;
      _saveConfig();
    }
  }

  /** 显示配置对话框 */
  function showConfigDialog() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'custom-prompt-overlay';
      overlay.innerHTML = `
        <div class="custom-prompt-box" style="max-width:480px;">
          <h2 style="margin-bottom:16px;">🤖 AI 助手配置</h2>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">AI 提供商</label>
            <select id="ai-provider-select" style="width:100%;padding:6px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:13px;">
              <option value="openai" ${_config.provider === 'openai' ? 'selected' : ''}>OpenAI (GPT-4o-mini)</option>
              <option value="deepseek" ${_config.provider === 'deepseek' ? 'selected' : ''}>DeepSeek</option>
              <option value="ollama" ${_config.provider === 'ollama' ? 'selected' : ''}>Ollama (本地)</option>
              <option value="custom" ${_config.provider === 'custom' ? 'selected' : ''}>自定义</option>
            </select>
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">API Base URL</label>
            <input id="ai-base-url" type="text" value="${_config.baseUrl}" style="width:100%;padding:6px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:13px;" placeholder="https://api.openai.com/v1" />
          </div>
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">API Key</label>
            <input id="ai-api-key" type="password" value="${_config.apiKey}" style="width:100%;padding:6px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:13px;" placeholder="sk-..." />
          </div>
          <div style="margin-bottom:16px;">
            <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">模型名称</label>
            <input id="ai-model" type="text" value="${_config.model}" style="width:100%;padding:6px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:13px;" placeholder="gpt-4o-mini" />
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;">
            <button id="ai-config-cancel" class="tb-btn">取消</button>
            <button id="ai-config-save" class="tb-btn tb-run">保存</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const providerSelect = overlay.querySelector('#ai-provider-select');
      const baseUrlInput = overlay.querySelector('#ai-base-url');
      const apiKeyInput = overlay.querySelector('#ai-api-key');
      const modelInput = overlay.querySelector('#ai-model');

      providerSelect.addEventListener('change', () => {
        const preset = PRESETS[providerSelect.value];
        if (preset) {
          baseUrlInput.value = preset.baseUrl;
          modelInput.value = preset.model;
          if (preset.apiKey !== undefined) apiKeyInput.value = preset.apiKey;
        }
      });

      overlay.querySelector('#ai-config-cancel').addEventListener('click', () => {
        document.body.removeChild(overlay);
        resolve(false);
      });

      overlay.querySelector('#ai-config-save').addEventListener('click', () => {
        _config.provider = providerSelect.value;
        _config.baseUrl = baseUrlInput.value.trim();
        _config.apiKey = apiKeyInput.value.trim();
        _config.model = modelInput.value.trim();
        _saveConfig();
        document.body.removeChild(overlay);
        resolve(true);
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          document.body.removeChild(overlay);
          resolve(false);
        }
      });
    });
  }

  /** 显示 AI 面板 */
  function showPanel() {
    let panel = document.getElementById('ai-assistant-panel');
    if (panel) {
      panel.classList.toggle('hidden');
      return;
    }
    // 创建面板
    panel = document.createElement('div');
    panel.id = 'ai-assistant-panel';
    panel.className = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <span>🤖 AI 助手</span>
        <div style="display:flex;gap:4px;">
          <button id="ai-config-btn" class="tb-btn" style="padding:2px 8px;font-size:11px;" title="配置 AI">⚙️</button>
          <button id="ai-close-btn" class="tb-btn" style="padding:2px 8px;font-size:11px;">✕</button>
        </div>
      </div>
      <div class="ai-panel-body">
        <div id="ai-chat-log" class="ai-chat-log"></div>
        <div class="ai-input-area">
          <div class="ai-quick-actions">
            <button class="ai-quick-btn" data-action="explain">📖 解释代码</button>
            <button class="ai-quick-btn" data-action="debug">🐛 调试建议</button>
            <button class="ai-quick-btn" data-action="optimize">⚡ 优化建议</button>
          </div>
          <div style="display:flex;gap:6px;">
            <input id="ai-input" type="text" placeholder="描述你想要的功能..." style="flex:1;padding:6px 10px;background:var(--bg-surface);border:1px solid var(--border);border-radius:4px;color:var(--text-primary);font-size:13px;" />
            <button id="ai-send-btn" class="tb-btn tb-run" style="padding:4px 12px;">发送</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);

    // 事件绑定
    panel.querySelector('#ai-close-btn').addEventListener('click', () => panel.classList.add('hidden'));
    panel.querySelector('#ai-config-btn').addEventListener('click', () => showConfigDialog());

    const chatLog = panel.querySelector('#ai-chat-log');
    const input = panel.querySelector('#ai-input');

    function addMessage(role, text) {
      const div = document.createElement('div');
      div.className = 'ai-msg ai-msg-' + role;
      div.innerHTML = `<strong>${role === 'user' ? '你' : '🤖 AI'}</strong><br>${text.replace(/\n/g, '<br>')}`;
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function addLoading() {
      const div = document.createElement('div');
      div.className = 'ai-msg ai-msg-loading';
      div.id = 'ai-loading-msg';
      div.innerHTML = '⏳ <em>AI 正在思考...</em>';
      chatLog.appendChild(div);
      chatLog.scrollTop = chatLog.scrollHeight;
    }

    function removeLoading() {
      const el = document.getElementById('ai-loading-msg');
      if (el) el.remove();
    }

    async function handleGenerate(text) {
      addMessage('user', text);
      addLoading();
      try {
        const result = await generateBlocks(text);
        removeLoading();
        if (result.success) {
          const count = applyGeneratedBlocks(result.blocks);
          addMessage('assistant', `✅ 已生成并添加 ${count} 个积木！\n\n${result.raw.slice(0, 300)}`);
        } else {
          addMessage('assistant', `❌ ${result.error}\n\n原始响应:\n${result.raw?.slice(0, 300) || '无'}`);
        }
      } catch (e) {
        removeLoading();
        addMessage('assistant', `❌ 错误: ${e.message}`);
      }
    }

    panel.querySelector('#ai-send-btn').addEventListener('click', () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      handleGenerate(text);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        handleGenerate(text);
      }
    });

    // 快捷按钮
    panel.querySelectorAll('.ai-quick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.dataset.action;
        addLoading();
        try {
          let result;
          if (action === 'explain') {
            result = await explainCode();
          } else if (action === 'debug') {
            const output = typeof Executor !== 'undefined' ? Executor.getOutput().join('\n') : '';
            result = await debugSuggest(output);
          } else if (action === 'optimize') {
            result = await optimizeSuggest();
          }
          removeLoading();
          addMessage('assistant', result);
        } catch (e) {
          removeLoading();
          addMessage('assistant', `❌ 错误: ${e.message}`);
        }
      });
    });
  }

  // 初始化
  _loadConfig();

  return {
    showPanel, showConfigDialog,
    generateBlocks, explainCode, debugSuggest, optimizeSuggest,
    applyGeneratedBlocks,
    getConfig, setConfig, setProvider,
    PRESETS,
  };
})();
