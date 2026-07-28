/* 猪猪鲨手 - AI 辅助模块
 * 基于 OpenAI 兼容的 Chat Completions API（DeepSeek / 混元 / 通义 / OpenAI 均可）。
 * API Key、BaseURL、Model 仅保存在本地 IndexedDB（settings.ai），不上传任何服务器。
 * 未配置 Key 时，call() 返回 { error: 'no_key' }，由调用方提示去设置页填写。
 */
(function (global) {
  'use strict';

  const DEFAULTS = {
    id: 'ai',
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
  };

  async function getConfig() {
    const r = await DB.get('settings', 'ai');
    return Object.assign({}, DEFAULTS, r || {});
  }

  async function saveConfig(cfg) {
    await DB.put('settings', Object.assign({ id: 'ai' }, cfg));
  }

  /**
   * 调用对话接口。
   * @param {string} system 系统提示
   * @param {string} user 用户提示
   * @param {{onDelta?:function}} [opts] onDelta 逐字回调（流式），不传则返回完整文本
   * @returns {Promise<{text?:string, error?:string}>}
   */
  async function call(system, user, opts) {
    opts = opts || {};
    const cfg = await getConfig();
    if (!cfg.apiKey) return { error: 'no_key' };
    const url = (cfg.baseURL || '').replace(/\/+$/, '') + '/chat/completions';
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages, temperature: 0.7, stream: !!opts.onDelta }),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch (e) {}
        return { error: 'http_' + res.status, detail };
      }
      if (opts.onDelta && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        let full = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t || !t.startsWith('data:')) continue;
            const json = t.slice(5).trim();
            if (json === '[DONE]') continue;
            try {
              const j = JSON.parse(json);
              const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (delta) { full += delta; opts.onDelta(delta, full); }
            } catch (e) {}
          }
        }
        return { text: full };
      }
      const j = await res.json();
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return { text: text || '' };
    } catch (e) {
      return { error: 'network', detail: String(e.message || e) };
    }
  }

  /**
   * 多模态视觉识别：发送图片（dataURL）给支持视觉的模型，返回文本。
   * 适用于「拍照识别食物热量」等场景。未配置 Key 返回 { error: 'no_key' }。
   * @param {string} prompt 用户/系统提示（描述要模型做什么）
   * @param {string} dataUrl 图片 dataURL（image/jpeg;base64,...）
   * @param {{onDelta?:function, system?:string}} [opts]
   */
  async function vision(prompt, dataUrl, opts) {
    opts = opts || {};
    const cfg = await getConfig();
    if (!cfg.apiKey) return { error: 'no_key' };
    const url = (cfg.baseURL || '').replace(/\/+$/, '') + '/chat/completions';
    const system = opts.system || '你是一个严谨的营养助手，只依据图片中可见的食物估算热量，给出结构化的中文结果。';
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: [
        { type: 'image_url', image_url: { url: dataUrl } },
        { type: 'text', text: prompt },
      ] },
    ];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
        body: JSON.stringify({ model: cfg.model || 'gpt-4o-mini', messages, temperature: 0.4, max_tokens: 800, stream: !!opts.onDelta }),
      });
      if (!res.ok) {
        let detail = '';
        try { detail = (await res.text()).slice(0, 200); } catch (e) {}
        return { error: 'http_' + res.status, detail };
      }
      if (opts.onDelta && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', full = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t || !t.startsWith('data:')) continue;
            const json = t.slice(5).trim();
            if (json === '[DONE]') continue;
            try {
              const j = JSON.parse(json);
              const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (delta) { full += delta; opts.onDelta(delta, full); }
            } catch (e) {}
          }
        }
        return { text: full };
      }
      const j = await res.json();
      const text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      return { text: text || '' };
    } catch (e) {
      return { error: 'network', detail: String(e.message || e) };
    }
  }

  global.AI = { getConfig, saveConfig, call, vision };
})(window);
