/* 英语学习板块：听说读写四主线 + 备考计划 + 内置四六级词库 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const INTERVAL_DAYS = [0, 1, 2, 4, 7];
  const DAY = 86400000;
  const TRACKS = [
    { key: 'listen', emoji: '👂', label: '听力', hint: '九步法真题精听 / 跟读录音' },
    { key: 'speak', emoji: '🗣', label: '口语', hint: '发音课闭环 / 录音回听' },
    { key: 'read', emoji: '📚', label: '阅读', hint: '长难句拆解 / 错因复盘' },
    { key: 'write', emoji: '✍️', label: '写作', hint: '仿写 / 翻译 / 作文' },
  ];

  // —— 逸晨专属四级备考规划（来自用户提供的 kdocs 计划），考试 2026-12-12 ——
  const PLAN_DEFAULT = {
    goal: 'cet4',
    examDate: '2026-12-12',
    stages: [
      { name: '第一阶段 · 基础发音', range: '现在 → 8月', axis: '基础发音课',
        daily: [
          { k: 'pron', label: '看发音课 1 节（30-40 分钟）' },
          { k: '闭环', label: '当堂闭环：跟读+录音回听 5-10 分钟' },
          { k: '九步', label: '辅音(01)后：真题九步法精听（每周2-3次）' },
        ] },
      { name: '第二阶段 · 考试词汇', range: '8月 → 10月', axis: '考试进阶词汇',
        daily: [
          { k: 'vocab', label: '词汇课 1 节（30-40 分钟）' },
          { k: '自测', label: '课后遮屏自测 10-15 个核心词' },
          { k: '精听', label: '周末：真题短句跟读/盲听' },
        ] },
      { name: '第三阶段 · 语法精听', range: '10月 → 11月', axis: '核心语法词法 + 精讲细听',
        daily: [
          { k: 'grammar', label: '核心语法词法 1 节（30-40 分钟）' },
          { k: '长句', label: '拆解 2 个真题长难句' },
          { k: '精读', label: '精听/精读卡 1 张' },
        ] },
      { name: '第四阶段 · 专项模考', range: '11月 → 12月', axis: '四级题型专项 + 模考',
        daily: [
          { k: '听力', label: '听力技巧课 + 35 天精听' },
          { k: '阅读', label: '阅读单题型训练 + 错因复盘' },
          { k: '写译', label: '翻译 1-2 段 / 作文 1 篇' },
        ] },
    ],
  };

  let st = { tab: 'overview', level: 'cet4', mode: 'card', session: [], idx: 0, revealed: false, quizOpts: [] };
  let rec = null; // english 主记录

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function speak(word) {
    if (!('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US'; u.rate = 0.9;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }

  async function loadRec() {
    let r = await DB.get('english', 'main');
    if (!r) r = { id: 'main', tracks: { listen: [], speak: [], read: [], write: [] }, plan: JSON.parse(JSON.stringify(PLAN_DEFAULT)), ticks: {} };
    if (!r.tracks) r.tracks = { listen: [], speak: [], read: [], write: [] };
    if (!r.plan) r.plan = JSON.parse(JSON.stringify(PLAN_DEFAULT));
    if (!r.ticks) r.ticks = {};
    return r;
  }
  async function saveRec() { await DB.put('english', rec); }

  function daysLeft(dateStr) {
    const t = new Date(dateStr + 'T00:00:00');
    return Math.round((t - new Date()) / DAY);
  }
  function currentStage() {
    return rec.plan.stages[0];
  }

  // ===== 词库 =====
  function allWords(level) {
    if (level === 'all') return (window.CET.cet4 || []).concat(window.CET.cet6 || []);
    return window.CET[level] || [];
  }
  function keyOf(level, w) { return level + ':' + w; }
  async function getStats(level) {
    const recs = await DB.getAll('words');
    const list = allWords(level).map((x) => x[0]);
    const set = new Set(list);
    const now = Date.now();
    let learned = 0, due = 0, mastered = 0;
    recs.forEach((r) => {
      if (!set.has(r.word)) return;
      learned++; if (r.due <= now) due++; if (r.box >= 5) mastered++;
    });
    return { total: list.length, learned, due, mastered };
  }
  async function buildSession(level) {
    const now = Date.now();
    const words = allWords(level);
    const recs = await DB.getAll('words');
    const recMap = {}; recs.forEach((r) => { if (r.level === level || level === 'all') recMap[r.word] = r; });
    const due = [];
    words.forEach(([w]) => { const r = recMap[w]; if (r && r.due <= now) due.push(w); });
    due.sort((a, b) => recMap[a].due - recMap[b].due);
    let session = due.slice(0, 20);
    if (session.length < 20) {
      for (const [w] of words) { if (session.length >= 20) break; if (!recMap[w]) session.push(w); }
    }
    return session;
  }
  async function upsert(word, level, correct) {
    const k = keyOf(level, word);
    let r = await DB.get('words', k);
    if (!r) r = { key: k, word, level, box: 1, due: Date.now(), seen: false, wrong: 0 };
    r.seen = true;
    if (correct) r.box = Math.min(5, r.box + 1); else { r.box = 1; r.wrong = (r.wrong || 0) + 1; }
    r.due = Date.now() + INTERVAL_DAYS[Math.min(r.box, 5) - 1] * DAY;
    await DB.put('words', r);
  }
  function makeQuiz(word, meaning) {
    const pool = allWords(st.level).map((x) => x[1]).filter((m) => m && m !== meaning);
    const distract = []; const used = new Set();
    while (distract.length < 3 && used.size < pool.length) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!used.has(pick)) { used.add(pick); distract.push(pick); }
    }
    const opts = [meaning].concat(distract);
    for (let i = opts.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opts[i], opts[j]] = [opts[j], opts[i]]; }
    return opts;
  }

  async function render(view) {
    rec = await loadRec();
    const t = todayStr();
    view.innerHTML = `
      <div class="tabs" id="enTabs">
        ${[['overview', '🏠 概览'], ['tracks', '👂 听说读写'], ['plan', '🗺 备考计划'], ['vocab', '📖 词库'], ['mistakes', '📕 错题本']].map(([k, lbl]) => `<button class="q-chip ${st.tab === k ? 'on' : ''}" data-tab="${k}">${lbl}</button>`).join('')}
      </div>
      <div id="enBody"></div>`;
    view.querySelectorAll('#enTabs [data-tab]').forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; render(view); }));
    if (st.tab === 'overview') renderOverview(view, t);
    else if (st.tab === 'tracks') renderTracks(view, t);
    else if (st.tab === 'plan') renderPlan(view, t);
    else if (st.tab === 'mistakes') renderMistakes(view);
    else renderVocab(view);
  }

  // ===== 概览 =====
  async function renderOverview(view, t) {
    const s = await getStats(st.level);
    const counts = {};
    TRACKS.forEach((tr) => { counts[tr.key] = (rec.tracks[tr.key] || []).filter((x) => x.date === t).length; });
    const left = daysLeft(rec.plan.examDate);
    const body = view.querySelector('#enBody');
    body.innerHTML = `
      <div class="card">
        <div class="card-title">📖 英语学习 · ${rec.plan.goal === 'cet4' ? '四级' : '六级'}备考</div>
        <div style="text-align:center;padding:10px 0;">
          <div style="font-size:40px;font-weight:800;color:var(--pink);">${left >= 0 ? left : 0}</div>
          <div class="muted">距离 ${rec.plan.examDate} 考试还有（天）</div>
        </div>
        <div class="plan-meta"><div class="row">
          <span class="pill">词库已学 <b>${s.learned}</b></span>
          <span class="pill">待复习 <b>${s.due}</b></span>
          <span class="pill">已掌握 <b>${s.mastered}</b></span>
        </div></div>
      </div>
      <div class="card">
        <div class="card-title">👂 今日四条主线</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          ${TRACKS.map((tr) => `
            <div style="background:var(--cream);border-radius:14px;padding:12px;text-align:center;">
              <div style="font-size:24px;">${tr.emoji}</div>
              <div style="font-weight:700;">${tr.label}</div>
              <div class="muted" style="font-size:11px;">今日 ${counts[tr.key]} 条</div>
            </div>`).join('')}
        </div>
        <button class="btn" id="goTracks" style="margin-top:12px;width:100%;">进入今日听说读写 →</button>
      </div>`;
    body.querySelector('#goTracks').addEventListener('click', () => { st.tab = 'tracks'; render(view); });
  }

  // ===== 听说读写 =====
  function renderTracks(view, t) {
    const body = view.querySelector('#enBody');
    const todayItems = (k) => (rec.tracks[k] || []).filter((x) => x.date === t);
    body.innerHTML = TRACKS.map((tr) => {
      const items = todayItems(tr.key);
      return `
      <div class="card">
        <div class="card-title">${tr.emoji} ${tr.label}
          <div style="flex:1"></div><span class="pill">今日 <b>${items.length}</b></span>
        </div>
        <p class="muted" style="font-size:12px;">${tr.hint}</p>
        ${tr.key === 'speak' ? `<button class="btn ghost" id="rec-${tr.key}" style="font-size:13px;margin-bottom:8px;">🎙 开始录音</button>` : ''}
        <div class="add-row" style="align-items:flex-end;">
          <div class="field grow"><input type="text" id="inp-${tr.key}" placeholder="${tr.key === 'read' ? '拆一句长难句…' : tr.key === 'write' ? '仿写/翻译/作文…' : '材料 / 内容…'}" /></div>
          <button class="btn" id="add-${tr.key}">记一笔</button>
        </div>
        <div id="list-${tr.key}" style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
          ${items.map((it) => `
            <div style="display:flex;gap:8px;align-items:center;background:var(--cream);border-radius:12px;padding:8px 12px;">
              ${it.audio ? `<audio controls src="${it.audio}" style="height:32px;max-width:160px;"></audio>` : ''}
              <span style="flex:1;font-size:13px;${it.done ? 'text-decoration:line-through;opacity:.6;' : ''}">${escapeHtml(it.text)}</span>
              <button class="t-del" data-toggle="${tr.key}:${it.id}" style="margin-left:6px;">${it.done ? '↺' : '✓'}</button>
              <button class="t-del" data-del="${tr.key}:${it.id}">🗑</button>
            </div>`).join('') || '<p class="muted">今天还没记录</p>'}
        </div>
      </div>`;
    }).join('');
    TRACKS.forEach((tr) => {
      body.querySelector('#add-' + tr.key).addEventListener('click', async () => {
        const inp = body.querySelector('#inp-' + tr.key);
        const text = inp.value.trim(); if (!text) return;
        rec.tracks[tr.key].push({ id: DB.uid('en'), text, done: false, date: t, audio: '' });
        await saveRec(); render(view);
      });
      if (tr.key === 'speak') body.querySelector('#rec-' + tr.key).addEventListener('click', (e) => recordSpeak(tr.key, body, e.target));
    });
    body.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', async () => {
      const [k, id] = b.dataset.toggle.split(':');
      const it = rec.tracks[k].find((x) => x.id === id); if (it) it.done = !it.done;
      await saveRec(); render(view);
    }));
    body.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
      const [k, id] = b.dataset.del.split(':');
      rec.tracks[k] = rec.tracks[k].filter((x) => x.id !== id);
      await saveRec(); render(view);
    }));
  }

  let recorder = null;
  async function recordSpeak(key, body, btn) {
    if (!navigator.mediaDevices || !window.MediaRecorder) { window.toast('当前浏览器不支持录音 🎙'); return; }
    if (recorder) { recorder.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks = [];
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = await new Promise((res) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.readAsDataURL(blob); });
        const t = todayStr();
        rec.tracks[key].push({ id: DB.uid('en'), text: '🎙 口语录音 ' + new Date().toLocaleTimeString('zh-CN'), done: false, date: t, audio: url });
        await saveRec(); recorder = null; render(body.closest('#view') || document.getElementById('view'));
      };
      mr.start(); recorder = mr; btn.textContent = '⏹ 停止录音';
      window.toast('录音中…说完点停止');
    } catch (e) { window.toast('无法访问麦克风 🎙'); }
  }

  // ===== 备考计划 =====
  function renderPlan(view, t) {
    const body = view.querySelector('#enBody');
    const ticks = rec.ticks[t] || {};
    const stage = currentStage();
    body.innerHTML = `
      <div class="card">
        <div class="card-title">🗺 备考计划 · ${rec.plan.goal === 'cet4' ? '四级' : '六级'}</div>
        <div class="add-row" style="align-items:flex-end;">
          <div class="field grow"><label>考试目标</label>
            <select id="planGoal">
              <option value="cet4" ${rec.plan.goal === 'cet4' ? 'selected' : ''}>四级 CET-4</option>
              <option value="cet6" ${rec.plan.goal === 'cet6' ? 'selected' : ''}>六级 CET-6</option>
            </select>
          </div>
          <div class="field"><label>考试日期</label><input type="date" id="planDate" value="${rec.plan.examDate}" /></div>
          <button class="btn" id="planSave">保存</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">✅ 今日闭环（${stage.name} · ${stage.range}）</div>
        <p class="muted">主轴：<b>${stage.axis}</b></p>
        <div id="dailyTicks" style="display:flex;flex-direction:column;gap:8px;">
          ${stage.daily.map((d) => `
            <label style="display:flex;gap:10px;align-items:center;background:var(--cream);border-radius:12px;padding:10px 12px;cursor:pointer;">
              <input type="checkbox" data-tick="${d.k}" ${ticks[d.k] ? 'checked' : ''} style="width:18px;height:18px;"/>
              <span style="font-size:13px;">${escapeHtml(d.label)}</span>
            </label>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">📅 全周期 4 阶段</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${rec.plan.stages.map((s, i) => `
            <div style="border-left:4px solid var(--pink);padding:8px 12px;background:var(--cream);border-radius:0 12px 12px 0;">
              <div style="font-weight:800;">${i + 1}. ${escapeHtml(s.name)}</div>
              <div class="muted" style="font-size:12px;">${escapeHtml(s.range)} · 主轴：${escapeHtml(s.axis)}</div>
            </div>`).join('')}
        </div>
        <details style="margin-top:10px;"><summary style="cursor:pointer;font-weight:700;color:var(--ink-soft);">📋 查看完整备考规划原文</summary>
          <div style="font-size:12px;line-height:1.6;margin-top:8px;color:var(--ink-soft);white-space:pre-wrap;">${escapeHtml(PLAN_TEXT)}</div>
        </details>
      </div>`;
    body.querySelector('#planSave').addEventListener('click', async () => {
      rec.plan.goal = body.querySelector('#planGoal').value;
      rec.plan.examDate = body.querySelector('#planDate').value;
      await saveRec(); window.toast('已保存 ✓'); render(view);
    });
    body.querySelectorAll('#dailyTicks input').forEach((c) => c.addEventListener('change', async () => {
      rec.ticks[t] = rec.ticks[t] || {}; rec.ticks[t][c.dataset.tick] = c.checked;
      await saveRec();
    }));
  }
  const PLAN_TEXT = `逸晨专属四级备考规划（摘要）
考试时间：四级 2026-12-12（预计 12 月中旬）。每天约投入 2 小时。
主线：基础发音课 → 考试进阶词汇 → 核心语法词法 → 四级题型专项。

第一阶段（现在→8月）主轴 基础发音课
- 第1周：基础发音课程介绍 → 元音(01-06) → 辅音(01)，每天1节(30-40分)
- 课后闭环：跟读音标/例词/例句、对照口型、慢读回听30-60秒
- 辅音(01)后每周2-3次真题九步法精听

第二阶段（8月→10月）主轴 考试进阶词汇
- 通假词汇→进阶词汇→拓展词汇，每次1节(30-40分)，每周约3节
- 课后遮屏自测 10-15 个核心词；周末精听复盘

第三阶段（10月→11月）主轴 核心语法词法 + 精讲细听
- 一/三/五 语法词法+长难句拆解；二/四 精讲细听/精读
- 每天输入转产出：真题听力/阅读段落精听精读卡

第四阶段（11月→12月）主轴 四级专项 + 模考
- 听力周：技巧课 + 35天精听；阅读周：单题型训练；写译周：翻译+作文
- 混合巩固周：单项限时 + 错题二刷

听力九步法：选材→标连读→自读录音→对比原音→圈漏听→重读→说大意→盲听确认→写错因。`;

  // ===== 词库（保留原有艾宾浩斯复习） =====
  function renderVocab(view) {
    getStats(st.level).then((s) => {
      view.querySelector('#enBody').innerHTML = `
        <div class="card">
          <div class="card-title">📖 四六级词库 · 艾宾浩斯复习</div>
          <div class="field" style="flex-direction:row;gap:8px;">
            ${['cet4', 'cet6', 'all'].map((l) => `<button class="q-chip ${st.level === l ? 'on' : ''}" data-lvl="${l}">${l === 'cet4' ? '四级' : l === 'cet6' ? '六级' : '全部'}</button>`).join('')}
            <span style="flex:1;"></span>
            <button class="q-chip ${st.mode === 'card' ? 'on' : ''}" data-mode="card">卡片</button>
            <button class="q-chip ${st.mode === 'quiz' ? 'on' : ''}" data-mode="quiz">测验</button>
          </div>
          <div class="plan-meta"><div class="row">
            <span class="pill">总词 <b>${s.total}</b></span><span class="pill">已学 <b>${s.learned}</b></span>
            <span class="pill">待复习 <b>${s.due}</b></span><span class="pill">已掌握 <b>${s.mastered}</b></span>
          </div></div>
          <div style="display:flex;gap:10px;margin-top:14px;">
            <button class="btn" id="enStart" style="flex:1;">▶ 开始复习（${s.due > 0 ? s.due : 20} 词）</button>
            <button class="btn ghost" id="enBrowse">🔍 词库浏览</button>
          </div>
        </div>
        <div id="enBody2"></div>`;
      const b = view.querySelector('#enBody');
      b.querySelectorAll('[data-lvl]').forEach((x) => x.addEventListener('click', () => { st.level = x.dataset.lvl; renderVocab(view); }));
      b.querySelectorAll('[data-mode]').forEach((x) => x.addEventListener('click', () => { st.mode = x.dataset.mode; renderVocab(view); }));
      b.querySelector('#enStart').addEventListener('click', startSession);
      b.querySelector('#enBrowse').addEventListener('click', () => showBrowse(view));
    });
  }
  async function startSession() {
    const words = await buildSession(st.level);
    if (!words.length) { window.toast('暂无待复习词 🎉'); return; }
    st.session = words; st.idx = 0; st.revealed = false;
    renderSession(document.getElementById('view'));
  }
  function renderSession(view) {
    const body = view.querySelector('#enBody2') || view.querySelector('#enBody');
    if (st.idx >= st.session.length) {
      body.innerHTML = `<div class="card placeholder"><div class="ph-emoji">🎉</div><h2>本轮复习完成！</h2><p>辛苦啦，继续保持～</p><button class="btn" onclick="go('english')">返回</button></div>`;
      return;
    }
    const word = st.session[st.idx];
    const entry = allWords(st.level).find((x) => x[0] === word) || ['', ''];
    const meaning = entry[1] || '';
    const prog = Math.round((st.idx / st.session.length) * 100);
    if (st.mode === 'quiz') {
      const opts = makeQuiz(word, meaning);
      body.innerHTML = `
        <div class="card">
          <div class="card-title">测验中 ${st.idx + 1}/${st.session.length}<div style="flex:1"></div><div class="t-qtag">${prog}%</div></div>
          <div style="text-align:center;padding:18px 0;">
            <div style="font-size:34px;font-weight:800;">${word}</div>
            <button class="btn ghost" style="margin-top:10px;padding:6px 14px;font-size:13px;" id="qSpeak">🔊 朗读</button>
          </div>
          <div id="qOpts" style="display:flex;flex-direction:column;gap:8px;">
            ${opts.map((o, i) => `<button class="btn ghost" data-i="${i}" style="text-align:left;justify-content:flex-start;">${o}</button>`).join('')}
          </div>
        </div>`;
      body.querySelector('#qSpeak').addEventListener('click', () => speak(word));
      body.querySelectorAll('#qOpts button').forEach((b) => b.addEventListener('click', () => {
        const correct = b.dataset.i === '0';
        body.querySelectorAll('#qOpts button').forEach((x, i) => { x.style.background = (i === 0) ? 'var(--mint)' : (x === b ? 'var(--pink-soft)' : ''); });
        setTimeout(() => { upsert(word, st.level, correct); st.idx++; renderSession(view); }, correct ? 350 : 700);
      }));
      return;
    }
    body.innerHTML = `
      <div class="card">
        <div class="card-title">复习中 ${st.idx + 1}/${st.session.length}<div style="flex:1"></div><div class="t-qtag">${prog}%</div></div>
        <div style="text-align:center;padding:18px 0;">
          <div style="font-size:34px;font-weight:800;">${word}</div>
          <button class="btn ghost" style="margin-top:10px;padding:6px 14px;font-size:13px;" id="cSpeak">🔊 朗读</button>
          <div id="cMean" style="margin-top:16px;font-size:18px;min-height:28px;${st.revealed ? '' : 'opacity:.3;'}">${st.revealed ? meaning : '点击「显示释义」'}</div>
        </div>
        <div style="display:flex;gap:10px;"><button class="btn ghost" id="cReveal" style="flex:1;">${st.revealed ? '隐藏' : '显示释义'}</button></div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <button class="btn ghost" id="cNo" style="flex:1;color:#E23A6E;">✗ 不认识</button>
          <button class="btn" id="cYes" style="flex:1;">✓ 认识</button>
        </div>
      </div>`;
    body.querySelector('#cSpeak').addEventListener('click', () => speak(word));
    body.querySelector('#cReveal').addEventListener('click', () => { st.revealed = !st.revealed; renderSession(view); });
    body.querySelector('#cYes').addEventListener('click', () => { upsert(word, st.level, true); st.idx++; st.revealed = false; renderSession(view); });
    body.querySelector('#cNo').addEventListener('click', () => { upsert(word, st.level, false); st.idx++; st.revealed = false; renderSession(view); });
  }
  function showBrowse(view) {
    const body = view.querySelector('#enBody2');
    body.innerHTML = `
      <div class="card">
        <div class="card-title">🔍 词库浏览</div>
        <input type="text" id="brSearch" placeholder="搜索单词或释义…" />
        <div id="brList" style="margin-top:12px;display:flex;flex-direction:column;gap:6px;max-height:55vh;overflow:auto;"></div>
      </div>`;
    const list = body.querySelector('#brList');
    function paint(q) {
      let res = allWords(st.level);
      if (q) res = res.filter(([w, m]) => w.toLowerCase().includes(q.toLowerCase()) || m.includes(q));
      res = res.slice(0, 300);
      list.innerHTML = res.map(([w, m]) => `<div style="display:flex;gap:10px;padding:8px 10px;background:var(--cream);border-radius:12px;"><b style="min-width:110px;">${w}</b><span class="muted">${m}</span><button class="t-del" data-spk="${w}" style="margin-left:auto;">🔊</button></div>`).join('') || '<p class="muted">无匹配</p>';
      list.querySelectorAll('[data-spk]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.spk)));
    }
    paint('');
    body.querySelector('#brSearch').addEventListener('input', (e) => paint(e.target.value.trim()));
  }

  // ===== 真题错因本 =====
  const MK_REASONS = ['词汇', '语法', '逻辑', '粗心', '时间不够'];
  const MK_TYPES = ['听力', '阅读', '写作', '翻译', '词汇'];
  let mkSel = { exam: '', reason: '', q: '' };
  let mkReasons = new Set();

  async function renderMistakes(view) {
    const all = await DB.getAll('english_mistakes');
    const body = view.querySelector('#enBody');
    body.innerHTML = `
      <div class="card">
        <div class="card-title">📕 真题错因本</div>
        <p class="muted" style="font-size:12px;">记录真题/练习中的错题，标注错因，复盘时针对性改进。</p>
        <div class="add-row" style="align-items:flex-end;">
          <div class="field"><label>考试</label>
            <select id="mkExam">
              <option value="cet4">四级</option><option value="cet6">六级</option><option value="other">其他</option>
            </select>
          </div>
          <div class="field"><label>题型/来源</label>
            <select id="mkType"><option value="">不限</option>${MK_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}</select>
          </div>
        </div>
        <div class="field grow" style="margin-top:8px;"><label>我的答案 / 错误项</label><input id="mkMy" placeholder="如：选了 B" /></div>
        <div class="field grow" style="margin-top:8px;"><label>正确答案</label><input id="mkCorrect" placeholder="如：答案 C · 关键句…" /></div>
        <div class="field" style="margin-top:8px;"><label>错因标签（可多选）</label>
          <div id="mkReasonRow" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
            ${MK_REASONS.map((r) => `<button class="q-chip ${mkReasons.has(r) ? 'on' : ''}" data-r="${r}">${r}</button>`).join('')}
          </div>
        </div>
        <div class="field" style="margin-top:8px;"><label>错因反思</label><textarea id="mkNote" placeholder="为什么错？下次怎么避免？"></textarea></div>
        <button class="btn" id="mkAdd" style="margin-top:10px;width:100%;">＋ 保存这条错题</button>
      </div>
      <div class="card">
        <div class="card-title">🔎 筛选 & 统计</div>
        <div class="add-row" style="align-items:flex-end;">
          <div class="field"><label>考试</label>
            <select id="flExam"><option value="">全部</option><option value="cet4">四级</option><option value="cet6">六级</option><option value="other">其他</option></select>
          </div>
          <div class="field grow"><label>关键词</label><input id="flQ" placeholder="搜我的答案/正确项/反思…" /></div>
        </div>
        <div id="flReasons" style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${MK_REASONS.map((r) => `<button class="q-chip" data-fr="${r}">${r} <b id="rc-${r}">0</b></button>`).join('')}
        </div>
        <div id="mkStats" class="plan-meta" style="margin-top:10px;"></div>
        <div id="mkList" style="display:flex;flex-direction:column;gap:8px;margin-top:10px;"></div>
      </div>`;

    body.querySelector('#mkReasonRow').querySelectorAll('[data-r]').forEach((b) => b.addEventListener('click', () => {
      const r = b.dataset.r; if (mkReasons.has(r)) mkReasons.delete(r); else mkReasons.add(r);
      b.classList.toggle('on');
    }));
    body.querySelector('#mkAdd').addEventListener('click', async () => {
      const my = body.querySelector('#mkMy').value.trim();
      const correct = body.querySelector('#mkCorrect').value.trim();
      const note = body.querySelector('#mkNote').value.trim();
      if (!my && !correct) { body.querySelector('#mkMy').focus(); return; }
      if (!mkReasons.size) { window.toast('至少选一个错因标签'); return; }
      const rec = {
        id: DB.uid('mk'), exam: body.querySelector('#mkExam').value, type: body.querySelector('#mkType').value,
        my, correct, reasons: Array.from(mkReasons), note, date: todayStr(),
      };
      await DB.put('english_mistakes', rec);
      body.querySelector('#mkMy').value = ''; body.querySelector('#mkCorrect').value = ''; body.querySelector('#mkNote').value = '';
      mkReasons.clear(); window.toast('已记录 ✓'); renderMistakes(view);
    });

    const flExam = body.querySelector('#flExam');
    const flQ = body.querySelector('#flQ');
    flExam.addEventListener('change', () => { mkSel.exam = flExam.value; paint(); });
    flQ.addEventListener('input', () => { mkSel.q = flQ.value.trim().toLowerCase(); paint(); });
    body.querySelectorAll('#flReasons [data-fr]').forEach((b) => b.addEventListener('click', () => {
      mkSel.reason = mkSel.reason === b.dataset.fr ? '' : b.dataset.fr;
      body.querySelectorAll('#flReasons [data-fr]').forEach((x) => x.classList.toggle('on', x.dataset.fr === mkSel.reason));
      paint();
    }));

    function paint() {
      const filtered = all.filter((m) => {
        if (mkSel.exam && m.exam !== mkSel.exam) return false;
        if (mkSel.reason && !(m.reasons || []).includes(mkSel.reason)) return false;
        if (mkSel.q) {
          const hay = (m.my + ' ' + m.correct + ' ' + m.note + ' ' + (m.type || '')).toLowerCase();
          if (!hay.includes(mkSel.q)) return false;
        }
        return true;
      });
      const rc = {}; MK_REASONS.forEach((r) => rc[r] = all.filter((m) => (m.reasons || []).includes(r)).length);
      MK_REASONS.forEach((r) => { const el = body.querySelector('#rc-' + r); if (el) el.textContent = rc[r]; });
      body.querySelector('#mkStats').innerHTML = `<div class="row"><span class="pill">错题总数 <b>${all.length}</b></span><span class="pill">当前筛选 <b>${filtered.length}</b></span></div>`;
      body.querySelector('#mkList').innerHTML = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((m) => `
        <div style="background:var(--cream);border-radius:12px;padding:10px 12px;border-left:4px solid var(--pink);">
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="pill" style="font-size:11px;">${m.exam === 'cet4' ? '四级' : m.exam === 'cet6' ? '六级' : '其他'}</span>
            ${m.type ? `<span class="pill" style="font-size:11px;">${m.type}</span>` : ''}
            <span class="muted" style="font-size:11px;">${m.date}</span>
            <button class="t-del" data-mk="${m.id}" style="margin-left:auto;">🗑</button>
          </div>
          <div style="font-size:13px;margin-top:6px;"><span style="color:#E23A6E;">✗ 我的：</span>${escapeHtml(m.my)}</div>
          <div style="font-size:13px;"><span style="color:#1F9D74;">✓ 正确：</span>${escapeHtml(m.correct)}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${(m.reasons || []).map((r) => `<span class="pill" style="font-size:11px;background:var(--pink-soft);color:var(--pink);">${r}</span>`).join('')}</div>
          ${m.note ? `<div class="muted" style="font-size:12px;margin-top:6px;">💡 ${escapeHtml(m.note)}</div>` : ''}
        </div>`).join('') || '<p class="muted">暂无错题</p>';
      body.querySelectorAll('#mkList [data-mk]').forEach((b) => b.addEventListener('click', async () => {
        await DB.del('english_mistakes', b.dataset.mk); renderMistakes(view);
      }));
    }
    paint();
  }

  window.Sections.english = {
    id: 'english', title: '英语学习', emoji: '📖',
    render(view) { st.idx = 0; render(view); },
  };
})();
