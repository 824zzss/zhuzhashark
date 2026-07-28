/* 首页仪表盘（九宫格今日概览）：聚合九大板块今日数据 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayOffset(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function isToday(ts) {
    const d = new Date(ts);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}` === todayStr();
  }
  function money(n) { return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 }); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function greeting() {
    const h = new Date().getHours();
    if (h < 6) return '夜深了';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }

  async function render(view) {
    const today = todayStr();
    const [tasks, healthAll, words, moneyTx, ideas, reviews, notes, pods, enRec] = await Promise.all([
      DB.getAll('tasks'), DB.getAll('health'), DB.getAll('words'), DB.getAll('money'),
      DB.getAll('ideas'), DB.getAll('review'), DB.getAll('notes'), DB.getAll('podcasts'),
      DB.get('english', 'main'),
    ]);
    const en = enRec || { tracks: { listen: [], speak: [], read: [], write: [] }, ticks: {} };

    // —— 每日计划 ——
    const dayTasks = tasks.filter((t) => t.section === 'daily' && t.date === today);
    const tTotal = dayTasks.length;
    const tDone = dayTasks.filter((t) => t.status === 'done').length;
    const tPct = tTotal ? Math.round((tDone / tTotal) * 100) : 0;

    // —— 健康打卡 ——
    const h = healthAll.find((x) => x.date === today);
    const doneCats = h ? [h.exercises && h.exercises.length, h.water > 0, h.sleep && h.sleep.bed, h.weight !== '' && h.weight !== 0, h.mood].filter(Boolean).length : 0;
    let hStreak = 0;
    for (let i = 0; ; i++) { const d = dayOffset(i); const r = healthAll.find((x) => x.date === d); if (r) hStreak++; else if (i === 0) continue; else break; }

    // —— 英语学习 ——
    const now = Date.now();
    const wLearned = words.filter((w) => w.seen).length;
    const wDue = words.filter((w) => w.due <= now).length;
    const enTicks = (en.ticks && en.ticks[today]) ? Object.keys(en.ticks[today]).filter((k) => en.ticks[today][k]).length : 0;
    const enTrackDone = ['listen', 'speak', 'read', 'write'].reduce((s, k) => s + (en.tracks[k] || []).filter((x) => x.date === today && x.done).length, 0);
    const enToday = enTicks + enTrackDone;

    // —— 副业赚米 ——
    const month = today.slice(0, 7);
    const mTx = moneyTx.filter((x) => x.date.slice(0, 7) === month);
    const net = mTx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0)
      - mTx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);

    // —— 爆款灵感 ——
    const todayIdeas = ideas.filter((x) => isToday(x.createdAt || 0)).length;

    // —— 每日复盘 ——
    const reviewedToday = !!reviews.find((r) => r.date === today);
    let rStreak = 0;
    for (let i = 0; ; i++) { const d = dayOffset(i); if (reviews.find((r) => r.date === d)) rStreak++; else if (i === 0) continue; else break; }

    // —— 点点记录 ——
    const todayNotes = notes.filter((n) => n.section === 'notes' && isToday(n.createdAt || 0)).length;

    // —— 我的播客 ——
    const listening = pods.filter((p) => p.progress && Object.values(p.progress).some((pr) => (pr.pos || 0) > 0)).length;

    const tiles = [
      { id: 'daily', emoji: '📅', title: '每日计划', big: tPct + '%', sub: `完成 ${tDone}/${tTotal}`, done: tTotal > 0 && tDone === tTotal, accent: '#FF9EB5' },
      { id: 'health', emoji: '💪', title: '健康打卡', big: doneCats + '/5', sub: `🔥 连续 ${hStreak} 天`, done: doneCats >= 5, accent: '#1F9D74' },
      { id: 'english', emoji: '📖', title: '英语学习', big: enToday + '', sub: `已学 ${wLearned} · 待复习 ${wDue}`, done: enToday > 0, accent: '#3B6FD4' },
      { id: 'sidehustle', emoji: '💰', title: '副业赚米', big: money(net), sub: `本月净收 · 共 ${moneyTx.length} 笔`, done: false, accent: net >= 0 ? '#E0A71B' : '#E23A6E' },
      { id: 'inspiration', emoji: '💡', title: '爆款灵感', big: todayIdeas + '', sub: `今日新增 / 共 ${ideas.length}`, done: false, accent: '#FFB6C7' },
      { id: 'review', emoji: '🌙', title: '每日复盘', big: reviewedToday ? '✓' : '—', sub: reviewedToday ? `🔥 连续 ${rStreak} 天` : '待复盘', done: reviewedToday, accent: '#9B7FE0' },
      { id: 'notes', emoji: '✏️', title: '点点记录', big: todayNotes + '', sub: `今日记录 / 共 ${notes.length}`, done: false, accent: '#5FB6C9' },
      { id: 'podcast', emoji: '🎧', title: '我的播客', big: pods.length + '', sub: `订阅 / ${listening} 收听中`, done: false, accent: '#FF7AA2' },
      { id: 'newtask', emoji: '➕', title: '新建任务', big: '➕', sub: '快速创建', done: false, accent: '#FF9EB5', action: true },
    ];

    const summary = `今日：计划完成 ${tPct}% · 健康打卡 ${doneCats}/5${reviewedToday ? ' · 已复盘 ✓' : ' · 待复盘'} · 副业本月净收 ${money(net)}`;

    view.innerHTML = `
      <div class="dash-hero">
        <div class="dash-hero-emoji">🐷🦈</div>
        <div>
          <div class="dash-hero-hi">${greeting()}！猪猪鲨手</div>
          <div class="dash-hero-sub">${summary}</div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🏠 今日概览 · 九宫格</div>
        <div class="dash-grid">
          ${tiles.map((t) => `
            <div class="dash-tile ${t.done ? 'done' : ''}" data-go="${t.id}" style="--tile:${t.accent};">
              <div class="dash-tile-emoji">${t.emoji}</div>
              <div class="dash-tile-big">${escapeHtml(t.big)}</div>
              <div class="dash-tile-title">${t.title}</div>
              <div class="dash-tile-sub">${escapeHtml(t.sub)}</div>
              ${t.done ? '<div class="dash-tile-check">✓</div>' : ''}
            </div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚡ 快速开始</div>
        <div class="add-row" style="flex-wrap:wrap;gap:8px;">
          <button class="q-chip" data-go="daily">📅 安排今日任务</button>
          <button class="q-chip" data-go="health">💪 打个卡</button>
          <button class="q-chip" data-go="english">📖 背单词</button>
          <button class="q-chip" data-go="review">🌙 写复盘</button>
          <button class="q-chip" data-go="newtask">➕ 新建任务</button>
        </div>
      </div>`;

    view.addEventListener('click', (e) => {
      const b = e.target.closest('[data-go]'); if (!b) return;
      const id = b.dataset.go;
      if (id === 'newtask') window.openNewTaskModal();
      else window.go(id);
    });
  }

  window.Sections.dashboard = { id: 'dashboard', title: '今日概览', emoji: '🏠', render };
})();
