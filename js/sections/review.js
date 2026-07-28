/* 每日复盘板块（KPT/3R 双模式 + 情绪曲线 + 模板预设 + AI 草稿 + 历史时间轴） */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const MOODS = ['😀', '😌', '🥰', '😴', '😤', '😢', '🤔', '🎉'];

  const TEMPLATES = [
    { key: 'kpt', label: '标准 KPT', mode: 'kpt', fill: { keep: '今天做得好的事：\n', problem: '遇到的阻碍：\n', try: '明天想尝试：\n' } },
    { key: '3r', label: '3R 学习法', mode: '3r', fill: { record: '今天发生的 / 学到的：\n', reflect: '为什么会这样，哪里能更好：\n', refine: '沉淀成自己的方法：\n' } },
    { key: 'energy', label: '精力管理', mode: 'kpt', fill: { keep: '精力好的时段与原因：\n', problem: '消耗我精力的事：\n', try: '明天如何保护精力：\n' } },
    { key: 'gratitude', label: '感恩三件事', mode: 'kpt', fill: { keep: '今天感恩的三件事：\n1. \n2. \n3. ' } },
  ];

  let curDate = null;

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayOffset(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function shiftDate(dateStr, delta) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function blank() {
    return { mood: '', energy: 0, mode: 'kpt', wins: ['', '', ''], keep: '', problem: '', try: '', record: '', reflect: '', refine: '', regret: '', tomorrow: [], summary: '', template: '' };
  }
  async function load(date) {
    let r = await DB.get('review', date);
    if (!r) r = Object.assign({ id: date, date }, blank());
    r = Object.assign(blank(), r);
    if (!Array.isArray(r.wins) || r.wins.length !== 3) r.wins = blank().wins;
    if (!Array.isArray(r.tomorrow)) r.tomorrow = [];
    return r;
  }
  async function save(r) { r.updatedAt = Date.now(); await DB.put('review', r); }

  async function overview(today) {
    const tasks = (await DB.getAll('tasks')).filter((t) => t.section === 'daily' && t.date === today);
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const h = await DB.get('health', today);
    let healthDone = 0;
    if (h) {
      if (h.exercises && h.exercises.length) healthDone++;
      if (h.water > 0) healthDone++;
      if (h.sleep && h.sleep.bed) healthDone++;
      if (h.weight !== '' && h.weight !== 0) healthDone++;
      if (h.mood) healthDone++;
    }
    return { taskRate: total ? Math.round((done / total) * 100) : 0, taskDone: done, taskTotal: total, healthDone, healthTotal: 5 };
  }

  function drawEnergyLine(items, w, h) {
    if (!items.length) return `<svg width="${w}" height="${h}"></svg>`;
    const max = 5, min = 1;
    const X = (i) => 8 + i * (w - 16) / (items.length - 1 || 1);
    const Y = (v) => h - 12 - ((v - min) / (max - min)) * (h - 26);
    const d = items.map((p, i) => (i === 0 ? 'M' : 'L') + X(i).toFixed(1) + ' ' + Y(p.energy).toFixed(1)).join(' ');
    const dots = items.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.energy).toFixed(1)}" r="3" fill="#FF7AA2"/>`).join('');
    const labels = items.length > 1 ? `<text x="8" y="${h - 2}" font-size="10" fill="#b9a89c">${items[0].date.slice(5)}</text><text x="${w - 8}" y="${h - 2}" font-size="10" fill="#b9a89c" text-anchor="end">${items[items.length - 1].date.slice(5)}</text>` : '';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <path d="${d}" fill="none" stroke="#FF7AA2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}${labels}</svg>`;
  }

  async function render(view) {
    if (!curDate) curDate = todayStr();
    const date = curDate;
    const rec = await load(date);
    const ov = await overview(date);
    const all = await DB.getAll('review');
    const map = {}; all.forEach((r) => map[r.date] = r);
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = dayOffset(i);
      if (map[d]) streak++; else if (i === 0) continue; else break;
    }
    const isToday = date === todayStr();

    const energyItems = all.filter((r) => r.energy > 0).slice().sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-30);
    const moodRecent = all.filter((r) => r.mood).slice().sort((a, b) => (b.date < a.date ? -1 : 1)).slice(0, 7);

    const methodBody = rec.mode === 'kpt' ? `
      <div class="field"><label>✅ Keep · 继续保持</label><textarea id="rvKeep" placeholder="今天哪些做得好，值得保持？">${escapeHtml(rec.keep)}</textarea></div>
      <div class="field"><label>⚠️ Problem · 遇到的问题</label><textarea id="rvProblem" placeholder="今天卡在哪里、有什么阻碍？">${escapeHtml(rec.problem)}</textarea></div>
      <div class="field"><label>🚀 Try · 下一步尝试</label><textarea id="rvTry" placeholder="明天想尝试什么新做法？">${escapeHtml(rec.try)}</textarea></div>
    ` : `
      <div class="field"><label>📝 Record · 记录</label><textarea id="rvRecord" placeholder="今天发生了什么、学到了什么？">${escapeHtml(rec.record)}</textarea></div>
      <div class="field"><label>🪞 Reflect · 反思</label><textarea id="rvReflect" placeholder="为什么会这样？哪里可以更好？">${escapeHtml(rec.reflect)}</textarea></div>
      <div class="field"><label>💎 Refine · 提炼</label><textarea id="rvRefine" placeholder="沉淀成自己的方法 / 原则？">${escapeHtml(rec.refine)}</textarea></div>
    `;

    view.innerHTML = `
      <div class="card">
        <div class="card-title">🌙 每日复盘 · ${date.slice(5)} ${isToday ? '<span class="pill" style="margin-left:8px;">今天</span>' : ''}</div>
        <div class="add-row" style="align-items:center;">
          <button class="t-pomo" id="rvPrev">◀</button>
          <input type="date" id="rvDate" value="${date}" style="width:auto;" />
          <button class="t-pomo" id="rvNext">▶</button>
          <span style="flex:1;"></span>
          <span class="pill">🔥 连续复盘 <b>${streak}</b> 天</span>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📋 今日概览（自动汇总）</div>
        <div class="plan-meta"><div class="row">
          <span class="pill">计划完成 <b>${ov.taskDone}/${ov.taskTotal}</b></span>
          <span class="pill">完成率 <b>${ov.taskRate}%</b></span>
          <span class="pill">健康打卡 <b>${ov.healthDone}/${ov.healthTotal}</b></span>
        </div></div>
      </div>

      <div class="card">
        <div class="card-title">😊 情绪 & ⚡ 能量</div>
        <div class="mood-row" id="rvMood">
          ${MOODS.map((m) => `<button class="mood ${rec.mood === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}
        </div>
        <div class="field" style="margin-top:12px;"><label>今日能量值</label>
          <div id="rvEnergy" style="display:flex;gap:6px;font-size:24px;">
            ${[1,2,3,4,5].map((n) => `<button data-e="${n}" style="font-size:24px;filter:${n <= (rec.energy||0) ? 'none' : 'grayscale(1) opacity(.4)'};">⚡</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">🔁 复盘方法</div>
        <div class="field" style="flex-direction:row;gap:8px;align-items:center;">
          <button class="q-chip ${rec.mode === 'kpt' ? 'on' : ''}" data-mode="kpt">KPT</button>
          <button class="q-chip ${rec.mode === '3r' ? 'on' : ''}" data-mode="3r">3R</button>
          <span style="flex:1;"></span>
          <button class="btn ghost" id="tplBtn">📑 模板</button>
        </div>
        <div id="tplBar" style="display:none;flex-wrap:wrap;gap:6px;margin-top:10px;">
          ${TEMPLATES.map((t) => `<button class="q-chip" data-tpl="${t.key}">${t.label}</button>`).join('')}
        </div>
        ${methodBody}
        <div class="field"><label>🌧 遗憾 / 想改进</label><textarea id="rvRegret" placeholder="有什么遗憾，或想对过去的自己说？">${escapeHtml(rec.regret)}</textarea></div>
      </div>

      <div class="card">
        <div class="card-title">🌟 今日三件成就 / 好事</div>
        <div id="rvWins" style="display:flex;flex-direction:column;gap:8px;">
          ${rec.wins.map((w, i) => `<div class="field" style="flex-direction:row;gap:8px;align-items:center;"><span style="font-size:18px;">${['①','②','③'][i]}</span><input type="text" data-win="${i}" value="${escapeHtml(w)}" placeholder="今天值得记录的一件事…" /></div>`).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">📅 明日计划</div>
        <div class="add-row">
          <input type="text" id="tmrInput" placeholder="添加一件明天要做的事…" style="flex:1;" />
          <button class="btn" id="tmrAdd">添加</button>
        </div>
        <div id="tmrList" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      <div class="card">
        <div class="card-title">🤖 AI 复盘助手</div>
        <p class="muted" style="margin-top:0;">基于你的今日概览与填写内容，生成一段结构化复盘草稿（需先在「设置」填写 AI 接口）。</p>
        <button class="btn ghost" id="aiGen" style="width:100%;">✨ 生成复盘草稿</button>
        <div class="field" style="margin-top:12px;"><textarea id="rvSummary" placeholder="AI 生成的复盘总结会出现在这里，也可手动补充…">${escapeHtml(rec.summary)}</textarea></div>
      </div>

      <div class="card">
        <div class="card-title">📈 能量 & 心情趋势（近 30 天）</div>
        <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin-bottom:4px;">能量值 (⚡/5)</div>
        ${drawEnergyLine(energyItems, 600, 90)}
        <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin:12px 0 6px;">最近心情</div>
        <div class="mood-row">
          ${moodRecent.length ? moodRecent.map((r) => `<span style="font-size:22px;" title="${r.date}">${r.mood}</span>`).join('') : '<span class="muted">暂无记录</span>'}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🕰 历史复盘</div>
        <div id="rvHistory" style="display:flex;flex-direction:column;gap:8px;"></div>
      </div>`;

    renderTomorrow(view, rec);
    renderHistory(view, all, date);
    bind(view, rec, ov, date);
  }

  function renderTomorrow(view, rec) {
    const list = view.querySelector('#tmrList');
    list.innerHTML = (rec.tomorrow.length ? rec.tomorrow : [{ text: '', done: false, _placeholder: true }]).map((t, i) => {
      if (t._placeholder) return '<p class="muted">还没有安排，先加一件吧～</p>';
      return `<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:var(--cream);border-radius:12px;">
        <input type="checkbox" data-ti="${i}" ${t.done ? 'checked' : ''} style="width:18px;height:18px;accent-color:#FF7AA2;"/>
        <span style="${t.done ? 'text-decoration:line-through;opacity:.55;' : ''};flex:1;">${escapeHtml(t.text)}</span>
        <button class="t-del" data-td="${i}">🗑</button>
      </div>`;
    }).join('');
  }

  function renderHistory(view, all, cur) {
    const el = view.querySelector('#rvHistory');
    const sorted = all.slice().sort((a, b) => (b.date < a.date ? -1 : 1));
    if (!sorted.length) { el.innerHTML = '<p class="muted">还没有历史复盘，从今天开始吧～</p>'; return; }
    el.innerHTML = sorted.map((r) => {
      const energy = r.energy ? '⚡'.repeat(r.energy) : '—';
      const snippet = (r.summary || r.keep || r.record || '（未填写）').slice(0, 24);
      return `<div data-hdate="${r.date}" style="display:flex;gap:10px;align-items:center;padding:10px 12px;border-radius:12px;background:${r.date === cur ? 'var(--mint)' : 'var(--cream)'};cursor:pointer;">
        <span style="font-size:18px;">${r.mood || '🌙'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;">${r.date.slice(5)}</div>
          <div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${energy} · ${escapeHtml(snippet)}</div>
        </div>
        <span style="font-size:12px;color:var(--pink);">查看 ›</span>
      </div>`;
    }).join('');
  }

  function bind(view, rec, ov, date) {
    const persist = () => save(rec);
    const findTpl = (k) => TEMPLATES.find((t) => t.key === k);

    view.querySelector('#rvPrev').addEventListener('click', () => { curDate = shiftDate(date, -1); render(view); });
    view.querySelector('#rvNext').addEventListener('click', () => { curDate = shiftDate(date, 1); render(view); });
    view.querySelector('#rvDate').addEventListener('change', (e) => { curDate = e.target.value || todayStr(); render(view); });

    view.querySelector('#rvMood').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      rec.mood = b.dataset.m; persist().then(() => {
        view.querySelectorAll('#rvMood .mood').forEach((x) => x.classList.toggle('on', x.dataset.m === rec.mood));
      });
    });
    view.querySelector('#rvEnergy').addEventListener('click', (e) => {
      const b = e.target.closest('[data-e]'); if (!b) return;
      const n = Number(b.dataset.e);
      rec.energy = (rec.energy === n) ? 0 : n; persist().then(() => {
        view.querySelectorAll('#rvEnergy button').forEach((x) => {
          x.style.filter = Number(x.dataset.e) <= rec.energy ? 'none' : 'grayscale(1) opacity(.4)';
        });
      });
    });

    view.querySelectorAll('#rvWins input').forEach((inp) => {
      inp.addEventListener('change', () => { rec.wins[Number(inp.dataset.win)] = inp.value; persist(); });
    });

    view.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      rec.mode = b.dataset.mode; persist().then(() => render(view));
    }));
    view.querySelector('#tplBtn').addEventListener('click', () => {
      const bar = view.querySelector('#tplBar');
      bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
    });
    view.querySelector('#tplBar').addEventListener('click', (e) => {
      const b = e.target.closest('[data-tpl]'); if (!b) return;
      const t = findTpl(b.dataset.tpl);
      let changed = 0;
      if (t.mode) { rec.mode = t.mode; changed++; }
      Object.keys(t.fill).forEach((k) => { if (!rec[k] || rec[k].trim() === '') { rec[k] = t.fill[k]; changed++; } });
      persist().then(() => { window.toast('已套用模板：' + t.label); render(view); });
    });

    ['rvKeep', 'rvProblem', 'rvTry', 'rvRecord', 'rvReflect', 'rvRefine', 'rvRegret'].forEach((id) => {
      const el = view.querySelector('#' + id);
      if (el) el.addEventListener('change', (e) => { rec[id.replace('rv', '').toLowerCase()] = e.target.value; persist(); });
    });
    view.querySelector('#rvSummary').addEventListener('change', (e) => { rec.summary = e.target.value; persist(); });

    const addTmr = () => {
      const inp = view.querySelector('#tmrInput');
      const v = inp.value.trim(); if (!v) { inp.focus(); return; }
      rec.tomorrow.push({ text: v, done: false }); inp.value = '';
      persist().then(() => renderTomorrow(view, rec));
    };
    view.querySelector('#tmrAdd').addEventListener('click', addTmr);
    view.querySelector('#tmrInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addTmr(); });
    view.querySelector('#tmrList').addEventListener('change', (e) => {
      const b = e.target.closest('[data-ti]'); if (!b) return;
      rec.tomorrow[Number(b.dataset.ti)].done = b.checked; persist().then(() => renderTomorrow(view, rec));
    });
    view.querySelector('#tmrList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-td]'); if (!b) return;
      rec.tomorrow.splice(Number(b.dataset.td), 1); persist().then(() => renderTomorrow(view, rec));
    });

    view.querySelector('#rvHistory').addEventListener('click', (e) => {
      const b = e.target.closest('[data-hdate]'); if (!b) return;
      curDate = b.dataset.hdate; render(view);
    });

    view.querySelector('#aiGen').addEventListener('click', async () => {
      const btn = view.querySelector('#aiGen');
      btn.disabled = true; btn.textContent = '✨ 生成中…';
      const prompt = buildPrompt(rec, ov, date);
      const r = await AI.call(
        '你是「猪猪鲨手」的温柔复盘助手。请用温暖、鼓励、不过度说教的语气，基于用户提供的今日数据与已填内容，输出一段结构化复盘草稿（中文，≤200字）。结构：①今日小结 ②亮点 ③可优化 ④给明日的一句鼓励。不要使用 markdown 代码块，用自然分段。',
        prompt
      );
      btn.disabled = false; btn.textContent = '✨ 生成复盘草稿';
      if (r.error === 'no_key') { window.toast('请先在「设置」填写 AI 接口 🔑'); return; }
      if (r.error) { window.toast('AI 调用失败：' + r.error + (r.detail ? ' ' + r.detail.slice(0, 60) : '')); return; }
      const ta = view.querySelector('#rvSummary');
      ta.value = r.text; rec.summary = r.text; persist();
      window.toast('✨ 复盘草稿已生成');
    });
  }

  function buildPrompt(rec, ov, date) {
    const lines = [];
    lines.push('日期：' + date);
    lines.push(`今日计划：完成 ${ov.taskDone}/${ov.taskTotal}（完成率 ${ov.taskRate}%）`);
    lines.push(`健康打卡：${ov.healthDone}/5 项`);
    lines.push('情绪：' + (rec.mood || '未记录') + '，能量：' + (rec.energy ? rec.energy + '/5' : '未记录'));
    lines.push('今日三件成就：' + (rec.wins.filter(Boolean).join('；') || '未填写'));
    if (rec.mode === 'kpt') {
      lines.push('Keep 继续保持：' + (rec.keep || '未填写'));
      lines.push('Problem 问题：' + (rec.problem || '未填写'));
      lines.push('Try 尝试：' + (rec.try || '未填写'));
    } else {
      lines.push('Record 记录：' + (rec.record || '未填写'));
      lines.push('Reflect 反思：' + (rec.reflect || '未填写'));
      lines.push('Refine 提炼：' + (rec.refine || '未填写'));
    }
    lines.push('遗憾：' + (rec.regret || '未填写'));
    lines.push('明日计划：' + (rec.tomorrow.length ? rec.tomorrow.map((t) => t.text).join('；') : '未填写'));
    return lines.join('\n');
  }

  window.Sections.review = {
    id: 'review', title: '每日复盘', emoji: '🌙',
    render(view) { curDate = null; render(view); },
  };
})();
