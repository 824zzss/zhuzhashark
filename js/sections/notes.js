/* 点点记录板块 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const MOODS = ['😀', '😌', '🥰', '😴', '😤', '😢', '🤔', '🎉'];
  let mood = '';

  function fmt(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}月${d.getDate()}日 ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function load() {
    const all = await DB.getAll('notes');
    return all.filter((n) => n.section === 'notes').sort((a, b) => b.createdAt - a.createdAt);
  }

  function render(view) {
    load().then((notes) => {
      view.innerHTML = `
        <div class="card">
          <div class="card-title">✏️ 记一笔</div>
          <div class="field">
            <textarea id="ntContent" placeholder="此刻的想法、灵感、随手记…"></textarea>
          </div>
          <div class="field">
            <label>心情</label>
            <div class="mood-row" id="ntMood">
              ${MOODS.map((m) => `<button class="mood" data-m="${m}">${m}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <input type="text" id="ntTags" placeholder="标签，用空格分隔，如：工作 灵感" />
          </div>
          <button class="btn" id="ntAdd" style="width:100%;">保存记录</button>
        </div>

        <div class="card">
          <div class="card-title">🕰 时间轴 <button class="btn ghost" id="ntRandom" style="margin-left:auto;padding:6px 12px;font-size:12px;">🎲 随机回顾</button></div>
          <div class="note-timeline" id="ntList">
            ${notes.length ? notes.map(noteHTML).join('') : '<p class="muted">还没有记录，写下第一笔吧 ✨</p>'}
          </div>
        </div>`;
      bind(view);
    });
  }

  function noteHTML(n) {
    return `<div class="note-item" data-id="${n.id}">
      <div class="note-dot">${n.mood || '✏️'}</div>
      <div class="note-body">
        <div class="note-text">${escapeHtml(n.content)}</div>
        <div class="note-foot">
          <span class="note-time">${fmt(n.createdAt)}</span>
          ${(n.tags || []).map((t) => `<span class="note-tag">#${escapeHtml(t)}</span>`).join('')}
          <button class="note-del" data-act="del" title="删除">🗑</button>
        </div>
      </div>
    </div>`;
  }

  function bind(view) {
    view.querySelectorAll('#ntMood .mood').forEach((b) => {
      b.addEventListener('click', () => {
        mood = b.dataset.m;
        view.querySelectorAll('#ntMood .mood').forEach((x) => x.classList.toggle('on', x === b));
      });
    });
    view.querySelector('#ntAdd').addEventListener('click', async () => {
      const content = view.querySelector('#ntContent').value.trim();
      if (!content) { view.querySelector('#ntContent').focus(); return; }
      const tags = view.querySelector('#ntTags').value.trim().split(/\s+/).filter(Boolean);
      await DB.put('notes', { id: DB.uid('note'), section: 'notes', content, mood, tags, createdAt: Date.now() });
      mood = ''; render(view);
    });
    view.querySelector('#ntList').addEventListener('click', async (e) => {
      if (e.target.closest('[data-act="del"]')) {
        const id = e.target.closest('.note-item').dataset.id;
        await DB.del('notes', id); render(view);
      }
    });
    view.querySelector('#ntRandom').addEventListener('click', async () => {
      const notes = await load();
      if (!notes.length) { alert('还没有记录可以回顾哦～'); return; }
      const pick = notes[Math.floor(Math.random() * notes.length)];
      view.querySelector('#ntList').scrollIntoView({ behavior: 'smooth' });
      const el = document.createElement('div');
      el.className = 'card';
      el.style.cssText = 'background:var(--pink-soft);border-color:var(--pink);';
      el.innerHTML = `<div class="card-title">🎲 随机回顾 ${pick.mood || ''}</div>
        <div class="note-text">${escapeHtml(pick.content)}</div>
        <div class="note-foot" style="margin-top:10px;"><span class="note-time">${fmt(pick.createdAt)}</span></div>`;
      view.insertBefore(el, view.firstChild);
    });
  }

  window.Sections.notes = { id: 'notes', title: '点点记录', emoji: '✏️', render };
})();
