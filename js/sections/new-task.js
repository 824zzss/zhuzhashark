/* 新建任务板块 + 全局快捷入口 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const SECTION_LIST = [
    { id: 'daily', emoji: '📅', name: '每日计划' },
    { id: 'health', emoji: '💪', name: '健康打卡' },
    { id: 'english', emoji: '📖', name: '英语学习' },
    { id: 'sidehustle', emoji: '💰', name: '副业赚米' },
    { id: 'inspiration', emoji: '💡', name: '爆款灵感' },
    { id: 'review', emoji: '🌙', name: '每日复盘' },
    { id: 'notes', emoji: '✏️', name: '点点记录' },
  ];
  const KW = {
    health: ['健康', '运动', '跑步', '健身', '瑜伽', '锻炼', '睡眠', '饮食'],
    english: ['英语', '单词', '听力', '口语', '阅读', '背'],
    sidehustle: ['副业', '赚钱', '项目', '客户', '接单', '收款'],
    inspiration: ['灵感', '创意', '想法', '选题'],
    review: ['复盘', '总结', '反思'],
    notes: ['记录', '笔记', '记下', '随手'],
  };

  function todayStr(offset) {
    const d = new Date(); d.setDate(d.getDate() + (offset || 0));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  const WEEK = { '日': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };

  /** 自然语言解析：返回 {title, date, time, section} */
  function parse(text) {
    let title = text, date = todayStr(0), time = '', section = 'daily';
    // 时间
    let m = text.match(/(\d{1,2})[:：](\d{2})/);
    if (m) { time = String(m[1]).padStart(2, '0') + ':' + m[2]; title = title.replace(m[0], ' '); }
    else { m = text.match(/(\d{1,2})\s*点(半)?/); if (m) { let h = String(m[1]).padStart(2, '0'); let min = m[2] ? '30' : '00'; time = h + ':' + min; title = title.replace(m[0], ' '); } }
    // 日期关键词
    if (/明天/.test(text)) date = todayStr(1);
    else if (/后天/.test(text)) date = todayStr(2);
    else if (/大后天/.test(text)) date = todayStr(3);
    else { m = text.match(/(?:周|星期)([一二三四五六日天])/); if (m) {
      const target = WEEK[m[1]] === undefined ? 0 : WEEK[m[1]];
      const cur = new Date().getDay();
      let diff = (target - cur + 7) % 7; if (diff === 0) diff = 7;
      date = todayStr(diff); title = title.replace(m[0], ' ');
    }}
    m = text.match(/(\d{1,2})月(\d{1,2})[日号]?/);
    if (m) { const y = new Date().getFullYear(); const mm = String(m[1]).padStart(2,'0'); const dd = String(m[2]).padStart(2,'0'); date = `${y}-${mm}-${dd}`; title = title.replace(m[0],' '); }
    // 板块
    for (const k of Object.keys(KW)) { if (KW[k].some((w) => text.includes(w))) { section = k; break; } }
    title = title.replace(/\s+/g, ' ').trim();
    return { title: title || text, date, time, section };
  }

  function recentHTML() {
    return DB.getAll('tasks').then((all) => {
      const recent = all.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
      if (!recent.length) return '<p class="muted">还没有创建过任务。</p>';
      return recent.map((t) => {
        const sec = SECTION_LIST.find((s) => s.id === t.section) || { emoji: '📌', name: t.section };
        const d = new Date(t.createdAt);
        return `<div class="recent-item"><span class="ri-emoji">${sec.emoji}</span>
          <span class="ri-title">${escapeHtml(t.title)}</span>
          <span class="ri-time">${sec.name} · ${d.getMonth()+1}/${d.getDate()}</span></div>`;
      }).join('');
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(view) {
    view.innerHTML = `
      <div class="card">
        <div class="card-title">➕ 快速创建任务</div>
        <div class="field">
          <input type="text" id="ntaskInput" class="big-input" placeholder="例如：明天 09:30 团队周会" />
          <div class="parse-hint">支持自然语言：日期（今天/明天/周X/3月5日）、时间（09:30 或 9点）、板块关键词自动识别</div>
        </div>
        <div class="field">
          <label>分配到板块</label>
          <select id="ntaskSection">
            ${SECTION_LIST.map((s) => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('')}
          </select>
        </div>
        <div class="parse-preview" id="ntaskPreview">输入内容后将自动解析…</div>
        <button class="btn" id="ntaskSubmit" style="width:100%;margin-top:14px;">创建任务</button>
      </div>
      <div class="card">
        <div class="card-title">🕘 最近创建</div>
        <div class="recent-list" id="ntaskRecent"></div>
      </div>`;
    bindSection(view);
    recentHTML().then((h) => { const el = view.querySelector('#ntaskRecent'); if (el) el.innerHTML = h; });
  }

  function bindSection(view) {
    const input = view.querySelector('#ntaskInput');
    const sel = view.querySelector('#ntaskSection');
    const prev = view.querySelector('#ntaskPreview');
    function update() {
      const p = parse(input.value);
      sel.value = p.section;
      prev.innerHTML = `解析结果 → 板块：<b>${SECTION_LIST.find(s=>s.id===p.section).name}</b> ｜ 日期：<b>${p.date}</b> ｜ 时间：<b>${p.time || '未指定'}</b> ｜ 标题：<b>${escapeHtml(p.title)}</b>`;
    }
    input.addEventListener('input', update);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitSection(view); });
    view.querySelector('#ntaskSubmit').addEventListener('click', () => submitSection(view));
    update();
  }
  async function submitSection(view) {
    const input = view.querySelector('#ntaskInput');
    const sel = view.querySelector('#ntaskSection');
    const p = parse(input.value);
    p.section = sel.value;
    if (!p.title) { input.focus(); return; }
    await DB.put('tasks', {
      id: DB.uid('task'), section: p.section, date: p.date, title: p.title,
      time: p.time, quadrant: 2, status: 'todo', pomodoro: 0,
      createdAt: Date.now(), completedAt: null,
    });
    input.value = ''; render(view);
    window.toast && window.toast('已创建 ✓');
  }

  /* ===== 全局弹窗 ===== */
  window.openNewTaskModal = function () {
    const opts = SECTION_LIST.map((s) => `<option value="${s.id}">${s.emoji} ${s.name}</option>`).join('');
    const html = `
        <div class="modal-mask" id="mMask">
          <div class="modal">
            <h3>➕ 新建任务</h3>
          <div class="field">
            <input type="text" id="mInput" class="big-input" placeholder="例如：明天 09:30 团队周会" autofocus />
            <div class="parse-hint">支持自然语言解析日期 / 时间 / 板块</div>
          </div>
          <div class="field">
            <label>分配到板块</label>
            <select id="mSection">${opts}</select>
          </div>
          <div class="parse-preview" id="mPreview">输入内容后将自动解析…</div>
          <div class="modal-actions">
            <button class="btn ghost" id="mCancel">取消</button>
            <button class="btn" id="mOk">创建</button>
          </div>
        </div>
      </div>`;
    window.openModal(html, (root) => {
      const input = root.querySelector('#mInput');
      const sel = root.querySelector('#mSection');
      const prev = root.querySelector('#mPreview');
      function update() {
        const p = parse(input.value); sel.value = p.section;
        prev.innerHTML = `→ <b>${SECTION_LIST.find(s=>s.id===p.section).name}</b> ｜ <b>${p.date}</b> ｜ <b>${p.time||'未指定'}</b> ｜ ${escapeHtml(p.title)}`;
      }
      input.addEventListener('input', update);
      root.querySelector('#mCancel').addEventListener('click', () => window.closeModal());
      root.querySelector('#mMask').addEventListener('click', (e) => { if (e.target.id === 'mMask') window.closeModal(); });
      root.querySelector('#mOk').addEventListener('click', async () => {
        const p = parse(input.value); p.section = sel.value;
        if (!p.title) { input.focus(); return; }
        await DB.put('tasks', {
          id: DB.uid('task'), section: p.section, date: p.date, title: p.title,
          time: p.time, quadrant: 2, status: 'todo', pomodoro: 0,
          createdAt: Date.now(), completedAt: null,
        });
        window.closeModal(); window.toast && window.toast('已创建 ✓');
        if (window.refreshNavBadges) window.refreshNavBadges();
      });
      update(); input.focus();
    });
  };

  window.Sections.newtask = { id: 'newtask', title: '新建任务', emoji: '➕', render };
})();
