/* 每日计划板块 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const Q_LABEL = { 1: '紧急重要', 2: '重要不急', 3: '紧急不重要', 4: '不急不要' };

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function prettyDate(s) {
    const [y, m, d] = s.split('-').map(Number);
    const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date(y, m - 1, d).getDay()];
    return `${m}月${d}日 · 周${wd}`;
  }

  let state = { date: todayStr(), q: 2, tasks: [] };

  async function load() {
    const all = await DB.getAll('tasks');
    state.tasks = all
      .filter((t) => t.section === 'daily' && t.date === state.date)
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  }

  function ringSVG(pct) {
    const r = 46, c = 2 * Math.PI * r;
    const off = c * (1 - pct / 100);
    return `<svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r="${r}" stroke="#F2E4DA" stroke-width="11" fill="none"/>
      <circle cx="55" cy="55" r="${r}" stroke="#FF9EB5" stroke-width="11" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" style="transition:stroke-dashoffset .5s"/>
    </svg>`;
  }

  function renderStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter((t) => t.status === 'done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return `<div class="plan-head">
      <div class="stat-ring">
        ${ringSVG(pct)}
        <div class="ring-center"><div class="ring-pct">${pct}%</div><div class="ring-label">今日完成</div></div>
      </div>
      <div class="plan-meta">
        <div class="row">
          <span class="pill">共 <b>${total}</b> 项</span>
          <span class="pill">已完成 <b>${done}</b></span>
          <span class="pill">待办 <b>${total - done}</b></span>
        </div>
        <div class="row">
          <span class="pill">🍅 番茄 <b>${state.tasks.reduce((s, t) => s + (t.pomodoro || 0), 0)}</b></span>
        </div>
      </div>
    </div>`;
  }

  function taskHTML(t) {
    return `<div class="task ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
      <button class="t-check" data-act="toggle" title="完成">${t.status === 'done' ? '✓' : ''}</button>
      ${t.time ? `<span class="t-time">${t.time}</span>` : ''}
      <span class="t-title">${escapeHtml(t.title)}</span>
      <span class="t-qtag" data-q="${t.quadrant}">${t.quadrant}·${Q_LABEL[t.quadrant]}</span>
      <span class="t-pomo">🍅${t.pomodoro || 0}<button data-act="pomo" title="+1 番茄">+</button></span>
      <button class="t-del" data-act="del" title="删除">🗑</button>
    </div>`;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function render(view) {
    view.innerHTML = `
      <div class="card">
        <div class="card-title">📅 今日计划 · ${prettyDate(state.date)}</div>
        <div class="field" style="flex-direction:row;align-items:center;gap:10px;">
          <input type="date" id="dpDate" value="${state.date}" style="max-width:180px;" />
          <button class="btn ghost" id="dpToday">回到今天</button>
        </div>
        ${renderStats()}
      </div>

      <div class="card">
        <div class="card-title">➕ 添加任务</div>
        <div class="add-row">
          <div class="field grow">
            <input type="text" id="dpTitle" placeholder="要做什么？例如：写完周报" />
          </div>
          <div class="field">
            <input type="time" id="dpTime" />
          </div>
        </div>
        <div class="field">
          <label>优先级（四象限）</label>
          <div class="q-options" id="dpQ">
            ${[1, 2, 3, 4].map((q) => `<button class="q-chip ${q === state.q ? 'on' : ''}" data-q="${q}">${q}·${Q_LABEL[q]}</button>`).join('')}
          </div>
        </div>
        <button class="btn" id="dpAdd" style="width:100%;">添加今日任务</button>
      </div>

      <div class="card">
        <div class="card-title">📋 任务清单</div>
        <div class="task-list" id="dpList">
          ${state.tasks.length ? state.tasks.map(taskHTML).join('') : '<p class="muted">今天还没有任务，添加一个开始吧 🌟</p>'}
        </div>
      </div>`;

    bind(view);
  }

  function bind(view) {
    view.querySelector('#dpDate').addEventListener('change', async (e) => {
      state.date = e.target.value; await load(); render(view);
    });
    view.querySelector('#dpToday').addEventListener('click', async () => {
      state.date = todayStr(); await load(); render(view);
    });
    view.querySelectorAll('#dpQ .q-chip').forEach((b) => {
      b.addEventListener('click', () => {
        state.q = Number(b.dataset.q);
        view.querySelectorAll('#dpQ .q-chip').forEach((x) => x.classList.toggle('on', x === b));
      });
    });
    view.querySelector('#dpAdd').addEventListener('click', addTask);
    view.querySelector('#dpTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });

    view.querySelector('#dpList').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const id = e.target.closest('.task').dataset.id;
      const act = btn.dataset.act;
      if (act === 'toggle') await toggleTask(id);
      else if (act === 'del') await delTask(id);
      else if (act === 'pomo') await addPomo(id);
      await load(); render(view);
    });
  }

  async function addTask() {
    const view = document.getElementById('view');
    const title = view.querySelector('#dpTitle').value.trim();
    if (!title) { view.querySelector('#dpTitle').focus(); return; }
    const time = view.querySelector('#dpTime').value;
    const task = {
      id: DB.uid('task'), section: 'daily', date: state.date, title,
      time, quadrant: state.q, status: 'todo', pomodoro: 0,
      createdAt: Date.now(), completedAt: null,
    };
    await DB.put('tasks', task);
    await load(); render(view);
  }

  async function toggleTask(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    t.status = t.status === 'done' ? 'todo' : 'done';
    t.completedAt = t.status === 'done' ? Date.now() : null;
    await DB.put('tasks', t);
    if (t.status === 'done') window.fireConfetti && window.fireConfetti();
  }
  async function delTask(id) { await DB.del('tasks', id); }
  async function addPomo(id) {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return; t.pomodoro = (t.pomodoro || 0) + 1; await DB.put('tasks', t);
  }

  window.Sections.daily = {
    id: 'daily', title: '每日计划', emoji: '📅',
    async render(view) { await load(); render(view); },
  };
})();
