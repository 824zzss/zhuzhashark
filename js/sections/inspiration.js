/* 爆款灵感板块：快速捕获 + 标签筛选 + 状态流转 + 转任务 + 随机回顾 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const STATUS = ['idea', 'collecting', 'doing', 'published'];
  const STATUS_LABEL = { idea: '💡 灵感', collecting: '🔍 采集中', doing: '🚧 进行中', published: '🚀 已发布' };
  const STATUS_COLOR = { idea: '#FFB6C7', collecting: '#BFD9FF', doing: '#FFD9A8', published: '#B8E6D2' };
  const MOODS = ['😀', '😌', '🥰', '😴', '😤', '😢', '🤔', '🎉'];
  const SCENES = ['通勤', '工作', '睡前', '灵感迸发', 'emo时刻', '日常', '旅行', '学习'];

  const state = { filterStatus: 'all', filterTag: '', search: '', filterMood: '', filterScene: '', pendingImage: '' };

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function parseTags(str) { return str.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean); }

  async function render(view) {
    const all = await DB.getAll('ideas');
    state.pendingImage = '';
    state.pendingMood = '';
    state.pendingScene = '';
    const allTags = Array.from(new Set(all.flatMap((x) => x.tags || [])));
    const filtered = all.filter((x) => {
      if (state.filterStatus !== 'all' && x.status !== state.filterStatus) return false;
      if (state.filterTag && !(x.tags || []).includes(state.filterTag)) return false;
      if (state.filterMood && x.mood !== state.filterMood) return false;
      if (state.filterScene && x.scene !== state.filterScene) return false;
      if (state.search) {
        const q = state.search.toLowerCase();
        const hay = (x.text + ' ' + (x.tags || []).join(' ') + ' ' + (x.source || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));

    const moodCounts = {}; const sceneCounts = {};
    all.forEach((x) => { if (x.mood) moodCounts[x.mood] = (moodCounts[x.mood] || 0) + 1; if (x.scene) sceneCounts[x.scene] = (sceneCounts[x.scene] || 0) + 1; });

    view.innerHTML = `
      <div class="card">
        <div class="card-title">💡 爆款灵感 · 快速捕获</div>
        <div class="field"><textarea id="inText" placeholder="突然冒出的好点子、标题、选题、金句…"></textarea></div>
        <div class="add-row" style="margin-top:8px;">
          <input type="text" id="inTags" placeholder="标签（逗号分隔，如 短视频,标题,选题）" style="flex:1;" />
          <input type="text" id="inSource" placeholder="来源/链接（可选）" style="flex:1;" />
        </div>
        <div class="field" style="margin-top:8px;"><label>😊 心情</label>
          <div class="mood-row" id="inMood" style="font-size:20px;">
            ${MOODS.map((m) => `<button class="mood ${state.pendingMood === m ? 'on' : ''}" data-mood="${m}">${m}</button>`).join('')}
          </div>
        </div>
        <div class="field" style="margin-top:8px;"><label>🎬 场景</label>
          <div class="q-options" id="inScene">
            ${SCENES.map((s) => `<button class="q-chip ${state.pendingScene === s ? 'on' : ''}" data-scene="${s}">${s}</button>`).join('')}
          </div>
        </div>
        <div class="add-row" style="margin-top:8px;align-items:center;">
          <label class="btn ghost" for="inImage" style="font-size:13px;padding:8px 14px;cursor:pointer;">🖼 配图（可选）</label>
          <input type="file" id="inImage" accept="image/*" style="display:none;" />
          <span id="inImageName" class="muted" style="font-size:12px;"></span>
        </div>
        <div id="inImageBox" style="margin-top:8px;"></div>
        <button class="btn" id="inAdd" style="width:100%;margin-top:10px;">✨ 捕获灵感</button>
      </div>

      <div class="card">
        <div class="card-title">🔎 筛选 & 回顾</div>
        <input type="text" id="inSearch" placeholder="搜索灵感、标签、来源…" style="margin-bottom:8px;" value="${escapeHtml(state.search)}" />
        <div class="q-options" id="inStatus">
          <button class="q-chip ${state.filterStatus === 'all' ? 'on' : ''}" data-st="all">全部</button>
          ${STATUS.map((s) => `<button class="q-chip ${state.filterStatus === s ? 'on' : ''}" data-st="${s}">${STATUS_LABEL[s]}</button>`).join('')}
        </div>
        <div class="q-options" id="inMoodFilter" style="margin-top:8px;">
          <button class="q-chip ${state.filterMood === '' ? 'on' : ''}" data-fmood="">全部心情</button>
          ${MOODS.map((m) => `<button class="q-chip ${state.filterMood === m ? 'on' : ''}" data-fmood="${m}">${m}${moodCounts[m] ? ' ' + moodCounts[m] : ''}</button>`).join('')}
        </div>
        <div class="q-options" id="inSceneFilter" style="margin-top:8px;">
          <button class="q-chip ${state.filterScene === '' ? 'on' : ''}" data-fscene="">全部场景</button>
          ${SCENES.map((s) => `<button class="q-chip ${state.filterScene === s ? 'on' : ''}" data-fscene="${s}">${s}${sceneCounts[s] ? ' ' + sceneCounts[s] : ''}</button>`).join('')}
        </div>
        ${allTags.length ? `<div class="q-options" id="inTags" style="margin-top:8px;">
          <button class="q-chip ${state.filterTag === '' ? 'on' : ''}" data-tag="">#全部标签</button>
          ${allTags.map((t) => `<button class="q-chip ${state.filterTag === t ? 'on' : ''}" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</button>`).join('')}
        </div>` : ''}
        <button class="btn ghost" id="inRandom" style="width:100%;margin-top:10px;">🎲 随机回顾一条</button>
      </div>

      <div class="card">
        <div class="card-title">📚 灵感库（${filtered.length}）</div>
        <div id="inList" style="display:flex;flex-direction:column;gap:10px;"></div>
      </div>`;

    paintList(view, filtered);
    bind(view, all);
  }

  function paintList(view, list) {
    const box = view.querySelector('#inList');
    if (!list.length) { box.innerHTML = '<p class="muted">没有匹配的灵感，换个筛选或先捕获一条吧～</p>'; return; }
    box.innerHTML = list.map((x) => {
      const tags = (x.tags || []).map((t) => `<span style="font-size:12px;padding:2px 8px;background:var(--cream);border-radius:999px;color:var(--ink-soft);">#${escapeHtml(t)}</span>`).join(' ');
      const meta = [];
      if (x.mood) meta.push(`<span class="muted" style="font-size:12px;">${x.mood}</span>`);
      if (x.scene) meta.push(`<span style="font-size:12px;padding:2px 8px;background:#fff;border-radius:999px;">🎬 ${escapeHtml(x.scene)}</span>`);
      const metaHtml = meta.length ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${meta.join('')}</div>` : '';
      return `<div style="padding:12px;border-radius:14px;background:var(--cream);border-left:4px solid ${STATUS_COLOR[x.status] || '#FFB6C7'};">
        ${x.image ? `<img src="${x.image}" style="max-width:140px;max-height:140px;border-radius:10px;margin-bottom:8px;display:block;object-fit:cover;"/>` : ''}
        <div style="white-space:pre-wrap;line-height:1.5;">${escapeHtml(x.text)}</div>
        ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${tags}</div>` : ''}
        ${metaHtml}
        ${x.source ? `<div class="muted" style="font-size:12px;margin-top:6px;">🔗 ${escapeHtml(x.source)}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <button class="q-chip" data-stoggle="${x.id}" style="background:${STATUS_COLOR[x.status] || '#FFB6C7'};">${STATUS_LABEL[x.status] || '💡 灵感'}</button>
          <button class="btn ghost" data-totask="${x.id}" style="font-size:12px;padding:4px 10px;">➕ 转任务</button>
          <span style="flex:1;"></span>
          <span class="muted" style="font-size:11px;">${(x.updatedAt || x.createdAt) ? new Date(x.updatedAt || x.createdAt).toLocaleDateString('zh-CN') : ''}</span>
          <button class="t-del" data-del="${x.id}">🗑</button>
        </div>
      </div>`;
    }).join('');
  }

  function bind(view, all) {
    view.querySelector('#inAdd').addEventListener('click', async () => {
      const text = view.querySelector('#inText').value.trim();
      if (!text) { view.querySelector('#inText').focus(); return; }
      const rec = {
        id: DB.uid('idea'), text,
        tags: parseTags(view.querySelector('#inTags').value),
        source: view.querySelector('#inSource').value.trim(),
        image: state.pendingImage || '',
        mood: state.pendingMood || '',
        scene: state.pendingScene || '',
        status: 'idea', createdAt: Date.now(), updatedAt: Date.now(),
      };
      await DB.put('ideas', rec);
      window.toast('灵感已捕获 ✨'); render(view);
    });

    const imgInput = view.querySelector('#inImage');
    if (imgInput) imgInput.addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { state.pendingImage = rd.result; view.querySelector('#inImageName').textContent = f.name; view.querySelector('#inImageBox').innerHTML = `<img src="${rd.result}" style="max-width:120px;border-radius:10px;display:inline-block;vertical-align:middle;"/>`; };
      rd.readAsDataURL(f);
    });

    view.querySelector('#inSearch').addEventListener('input', (e) => { state.search = e.target.value.trim(); render(view); });
    view.querySelector('#inStatus').addEventListener('click', (e) => {
      const b = e.target.closest('[data-st]'); if (!b) return;
      state.filterStatus = b.dataset.st; render(view);
    });
    const moodPick = view.querySelector('#inMood');
    if (moodPick) moodPick.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mood]'); if (!b) return;
      const m = b.dataset.mood;
      state.pendingMood = state.pendingMood === m ? '' : m; render(view);
    });
    const scenePick = view.querySelector('#inScene');
    if (scenePick) scenePick.addEventListener('click', (e) => {
      const b = e.target.closest('[data-scene]'); if (!b) return;
      const s = b.dataset.scene;
      state.pendingScene = state.pendingScene === s ? '' : s; render(view);
    });
    const moodFilter = view.querySelector('#inMoodFilter');
    if (moodFilter) moodFilter.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fmood]'); if (!b) return;
      state.filterMood = b.dataset.fmood; render(view);
    });
    const sceneFilter = view.querySelector('#inSceneFilter');
    if (sceneFilter) sceneFilter.addEventListener('click', (e) => {
      const b = e.target.closest('[data-fscene]'); if (!b) return;
      state.filterScene = b.dataset.fscene; render(view);
    });
    const tagBox = view.querySelector('#inTags');
    if (tagBox) tagBox.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tag]'); if (!b) return;
      state.filterTag = b.dataset.tag; render(view);
    });

    view.querySelector('#inRandom').addEventListener('click', () => {
      if (!all.length) { window.toast('还没有灵感可回顾'); return; }
      const pick = all[Math.floor(Math.random() * all.length)];
      window.openModal(`<div class="modal-mask" id="rMask"><div class="modal">
        <h3>🎲 随机灵感</h3>
        ${pick.image ? `<img src="${pick.image}" style="max-width:200px;max-height:200px;border-radius:10px;margin-bottom:8px;object-fit:cover;"/>` : ''}
        <div style="white-space:pre-wrap;line-height:1.6;padding:10px 0;">${escapeHtml(pick.text)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
          ${pick.mood ? `<span style="font-size:18px;">${pick.mood}</span>` : ''}
          ${pick.scene ? `<span style="font-size:13px;padding:2px 8px;background:var(--cream);border-radius:999px;">🎬 ${escapeHtml(pick.scene)}</span>` : ''}
          ${(pick.tags || []).map((t) => `<span style="font-size:12px;padding:2px 8px;background:var(--cream);border-radius:999px;">#${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="modal-actions"><button class="btn" id="rClose">收下灵感</button></div>
      </div></div>`, (root) => {
        root.querySelector('#rClose').addEventListener('click', window.closeModal);
        root.querySelector('#rMask').addEventListener('click', (e) => { if (e.target.id === 'rMask') window.closeModal(); });
      });
    });

    view.querySelector('#inList').addEventListener('click', async (e) => {
      const st = e.target.closest('[data-stoggle]');
      const tk = e.target.closest('[data-totask]');
      const dl = e.target.closest('[data-del]');
      if (st) {
        const rec = all.find((x) => x.id === st.dataset.stoggle);
        const idx = STATUS.indexOf(rec.status);
        rec.status = STATUS[(idx + 1) % STATUS.length];
        rec.updatedAt = Date.now();
        await DB.put('ideas', rec); render(view); return;
      }
      if (tk) {
        const rec = all.find((x) => x.id === tk.dataset.totask);
        await DB.put('tasks', {
          id: DB.uid('task'), title: rec.text, section: 'daily', date: todayStr(),
          time: '', quadrant: 2, status: 'todo', pomodoro: 0, createdAt: Date.now(),
        });
        window.toast('已加入今日计划 ➕'); return;
      }
      if (dl) { await DB.del('ideas', dl.dataset.del); render(view); }
    });
  }

  window.Sections.inspiration = { id: 'inspiration', title: '爆款灵感', emoji: '💡', render };
})();
