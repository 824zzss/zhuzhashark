/* 爆款灵感板块：AI 爆款雷达 + 灵感捕获 + 灵感库 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const STATUS = ['idea', 'collecting', 'doing', 'published'];
  const STATUS_LABEL = { idea: '💡 灵感', collecting: '🔍 采集中', doing: '🚧 进行中', published: '🚀 已发布' };
  const STATUS_COLOR = { idea: '#FFB6C7', collecting: '#BFD9FF', doing: '#FFD9A8', published: '#B8E6D2' };
  const MOODS = ['😀', '😌', '🥰', '😴', '😤', '😢', '🤔', '🎉'];
  const SCENES = ['通勤', '工作', '睡前', '灵感迸发', 'emo时刻', '日常', '旅行', '学习'];
  const RADAR_SCENES = ['全赛道', '美妆', '穿搭', '美食', '职场', '情感', '知识', '剧情', 'Vlog', '萌宠', '健身', '带货'];

  const state = {
    filterStatus: 'all', filterTag: '', search: '', filterMood: '', filterScene: '',
    pendingImage: '', pendingMood: '', pendingScene: '',
    radarMode: 'keyword', radarScene: '全赛道', radarQuery: '', radarResults: [], radarLoading: false, radarError: '',
  };

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function parseTags(str) { return str.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean); }

  const SYSTEM_ANALYST = '你是抖音爆款内容策略分析师，熟悉短视频平台算法、用户心理与爆款结构。请用中文给出结构化、可执行的爆款分析。';

  function looksLikeUrl(q) {
    return /^https?:\/\//i.test(q) || /douyin\.com|iesdouyin\.com|kuaishou\.com|xiaohongshu\.com/.test(q);
  }

  function parseRadarJson(text) {
    const raw = String(text || '').trim();
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j : [j];
    } catch (e) {
      const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) {
        try {
          const j = JSON.parse(m[1].trim());
          return Array.isArray(j) ? j : [j];
        } catch (e2) {}
      }
      const m2 = raw.match(/\[[\s\S]*\]/);
      if (m2) {
        try {
          const j = JSON.parse(m2[0]);
          return Array.isArray(j) ? j : [j];
        } catch (e3) {}
      }
      return null;
    }
  }

  function cleanResult(it) {
    return {
      title: String(it.title || it.标题 || '未命名选题').trim(),
      tags: Array.isArray(it.tags || it.标签) ? (it.tags || it.标签).map((t) => String(t).trim()) : [],
      audience: String(it.audience || it.受众 || '').trim(),
      copyHook: String(it.copyHook || it.文案爆点 || it.文案 || '').trim(),
      cover: String(it.cover || it.封面建议 || it.封面 || '').trim(),
      editing: String(it.editing || it.剪辑节奏 || it.剪辑 || '').trim(),
      content: String(it.content || it.内容结构 || it.内容 || it.爆点 || '').trim(),
      quote: String(it.quote || it.金句 || it.参考金句 || '').trim(),
    };
  }

  async function aiRadarKeyword(keyword, scene) {
    const user = `请基于关键词「${keyword}」${scene && scene !== '全赛道' ? '，聚焦「' + scene + '」赛道' : ''}，模拟一次抖音爆款调研，生成 5 个具有爆款潜力的短视频选题。

对每个选题，按以下维度给出可执行的拆解：
1. title：吸睛标题（15-25 字）
2. tags：3-5 个标签
3. audience：核心受众与痛点
4. copyHook：文案爆点（开头 3 秒钩子 + 3 条备选话术）
5. cover：封面构图、配色、字幕建议
6. editing：剪辑节奏、BGM 风格、时长、转场建议
7. content：内容结构与爆点设计（起承转合）
8. quote：一句可直接用的参考金句

请严格返回 JSON 数组，不要附加 Markdown 说明：
[
  {"title":"...","tags":["..."],"audience":"...","copyHook":"...","cover":"...","editing":"...","content":"...","quote":"..."},
  ...
]`;
    const r = await AI.call(SYSTEM_ANALYST, user);
    if (r.error) return r;
    const parsed = parseRadarJson(r.text);
    if (!parsed) return { error: 'parse', detail: 'AI 返回格式不对，请重试' };
    return { results: parsed.map(cleanResult) };
  }

  async function aiRadarUrl(url) {
    const user = `用户提供了一个短视频分享链接：${url}

请基于链接中的视频 ID / 标题信息，以及你对抖音爆款规律的掌握，对这个视频做爆点拆解。若无法访问具体画面，请根据 URL 信息和通用爆款方法论给出结构化分析。

返回单个 JSON 对象：
{
  "title": "视频标题/选题",
  "tags": ["标签1", "标签2"],
  "audience": "核心受众与痛点",
  "copyHook": "文案爆点（开头 3 秒钩子 + 话术）",
  "cover": "封面建议",
  "editing": "剪辑节奏与 BGM 建议",
  "content": "内容结构与爆点设计",
  "quote": "一句可参考的金句"
}
只返回 JSON，不要多余说明。`;
    const r = await AI.call(SYSTEM_ANALYST, user);
    if (r.error) return r;
    const parsed = parseRadarJson(r.text);
    if (!parsed) return { error: 'parse', detail: 'AI 返回格式不对，请重试' };
    return { results: parsed.map(cleanResult) };
  }

  async function render(view) {
    const all = await DB.getAll('ideas');
    state.pendingImage = '';
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
        <div class="card-title">🔥 AI 爆款雷达</div>
        <p class="muted" style="margin-top:-8px;margin-bottom:10px;">输入赛道关键词或粘贴抖音/快手/小红书链接，AI 帮你拆爆款、给灵感。</p>
        <div class="field" style="flex-direction:row;gap:8px;align-items:center;flex-wrap:wrap;">
          <button class="q-chip ${state.radarMode === 'keyword' ? 'on' : ''}" data-rmode="keyword">📝 关键词生成</button>
          <button class="q-chip ${state.radarMode === 'url' ? 'on' : ''}" data-rmode="url">🔗 链接拆解</button>
        </div>
        <div class="add-row" style="margin-top:10px;align-items:flex-end;">
          <div class="field grow" style="margin-bottom:0;">
            <label>${state.radarMode === 'url' ? '粘贴短视频链接' : '输入关键词/赛道'}</label>
            <input type="text" id="radarInput" placeholder="${state.radarMode === 'url' ? '如 https://v.douyin.com/xxxxx' : '如 职场干货、美食教程、情感共鸣'}" value="${escapeHtml(state.radarQuery)}" />
          </div>
          ${state.radarMode === 'keyword' ? `<div class="field" style="margin-bottom:0;min-width:100px;">
            <label>赛道</label>
            <select id="radarScene">${RADAR_SCENES.map((s) => `<option ${state.radarScene === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
          </div>` : ''}
          <button class="btn" id="radarRun">${state.radarMode === 'url' ? '🔗 拆解' : '🔍 搜索爆款'}</button>
        </div>
        <div id="radarStatus" style="margin-top:10px;"></div>
        <div id="radarResults" style="margin-top:12px;"></div>
      </div>

      <div class="card">
        <div class="card-title">💡 快速捕获</div>
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

    paintRadarStatus(view);
    paintRadarResults(view);
    paintList(view, filtered);
    bind(view, all);
  }

  function paintRadarStatus(view) {
    const box = view.querySelector('#radarStatus');
    if (!box) return;
    if (state.radarLoading) {
      box.innerHTML = '<p class="muted">🔍 AI 正在搜索并拆解爆款…</p>';
      return;
    }
    if (state.radarError) {
      box.innerHTML = `<p style="color:#E23A6E;font-size:13px;">⚠️ ${escapeHtml(state.radarError)}</p>`;
      return;
    }
    box.innerHTML = '';
  }

  function paintRadarResults(view) {
    const box = view.querySelector('#radarResults');
    if (!box) return;
    if (state.radarLoading) { box.innerHTML = ''; return; }
    if (!state.radarResults.length) {
      if (!state.radarError) box.innerHTML = '<p class="muted">输入关键词或链接，AI 会生成爆款选题与拆解。</p>';
      return;
    }
    box.innerHTML = state.radarResults.map((it, i) => {
      const tags = (it.tags || []).map((t) => `<span style="font-size:12px;padding:2px 8px;background:#fff;border-radius:999px;color:var(--ink-soft);">#${escapeHtml(t)}</span>`).join('');
      return `<div style="padding:14px;border-radius:14px;background:var(--cream);border:1px solid var(--line);margin-bottom:10px;">
        <div style="font-weight:800;font-size:15px;margin-bottom:4px;">${i + 1}. ${escapeHtml(it.title)}</div>
        ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px;">${tags}</div>` : ''}
        <div style="font-size:13px;line-height:1.7;">
          ${it.audience ? `<div><b>👥 受众：</b>${escapeHtml(it.audience)}</div>` : ''}
          ${it.copyHook ? `<div><b>📝 文案爆点：</b><span style="white-space:pre-wrap;">${escapeHtml(it.copyHook)}</span></div>` : ''}
          ${it.cover ? `<div><b>🖼 封面建议：</b>${escapeHtml(it.cover)}</div>` : ''}
          ${it.editing ? `<div><b>✂️ 剪辑节奏：</b>${escapeHtml(it.editing)}</div>` : ''}
          ${it.content ? `<div><b>🎬 内容结构：</b><span style="white-space:pre-wrap;">${escapeHtml(it.content)}</span></div>` : ''}
          ${it.quote ? `<div style="margin-top:8px;padding:8px 10px;background:#fff;border-radius:10px;color:var(--pink-deep);font-weight:700;white-space:pre-wrap;">💬 ${escapeHtml(it.quote)}</div>` : ''}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button class="btn" data-save="${i}" style="flex:1;font-size:13px;padding:8px;">💾 保存到灵感库</button>
          <button class="btn ghost" data-task="${i}" style="flex:1;font-size:13px;padding:8px;">➕ 转任务</button>
        </div>
      </div>`;
    }).join('');
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
      const analysis = x.analysis ? `<div style="font-size:12px;color:var(--ink-soft);margin-top:8px;padding:8px;background:#fff;border-radius:10px;line-height:1.6;">
        ${x.analysis.copyHook ? `<div>📝 ${escapeHtml(x.analysis.copyHook)}</div>` : ''}
        ${x.analysis.cover ? `<div>🖼 ${escapeHtml(x.analysis.cover)}</div>` : ''}
        ${x.analysis.editing ? `<div>✂️ ${escapeHtml(x.analysis.editing)}</div>` : ''}
        ${x.analysis.content ? `<div>🎬 ${escapeHtml(x.analysis.content)}</div>` : ''}
      </div>` : '';
      return `<div style="padding:12px;border-radius:14px;background:var(--cream);border-left:4px solid ${STATUS_COLOR[x.status] || '#FFB6C7'};">
        ${x.image ? `<img src="${x.image}" style="max-width:140px;max-height:140px;border-radius:10px;margin-bottom:8px;display:block;object-fit:cover;"/>` : ''}
        <div style="white-space:pre-wrap;line-height:1.5;">${escapeHtml(x.text)}</div>
        ${tags ? `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;">${tags}</div>` : ''}
        ${metaHtml}
        ${analysis}
        ${x.source ? `<div class="muted" style="font-size:12px;margin-top:6px;">🔗 ${escapeHtml(x.source)}</div>` : ''}
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;">
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
    // Radar mode switch
    const rmodeBox = view.querySelector('.card-title')?.nextElementSibling;
    if (rmodeBox && rmodeBox.querySelector('[data-rmode]')) {
      rmodeBox.addEventListener('click', (e) => {
        const b = e.target.closest('[data-rmode]'); if (!b) return;
        state.radarMode = b.dataset.rmode;
        state.radarQuery = '';
        state.radarResults = [];
        state.radarError = '';
        render(view);
      });
    }

    // Radar run
    const radarRun = view.querySelector('#radarRun');
    if (radarRun) radarRun.addEventListener('click', async () => {
      const input = view.querySelector('#radarInput');
      const q = input.value.trim();
      if (!q) { input.focus(); return; }
      state.radarQuery = q;
      state.radarLoading = true;
      state.radarError = '';
      state.radarResults = [];
      render(view);
      const sceneSel = view.querySelector('#radarScene');
      if (sceneSel) state.radarScene = sceneSel.value;
      const isUrl = looksLikeUrl(q);
      const res = isUrl ? await aiRadarUrl(q) : await aiRadarKeyword(q, state.radarScene);
      state.radarLoading = false;
      if (res.error) {
        if (res.error === 'no_key') state.radarError = '未配置 AI 接口。请在「设置 ⚙️」填写 API Key。';
        else state.radarError = res.detail || '分析失败，请重试';
      } else {
        state.radarResults = res.results || [];
        if (!state.radarResults.length) state.radarError = '没有分析出结果，换个关键词试试';
      }
      render(view);
    });

    // Radar save / task
    const radarBox = view.querySelector('#radarResults');
    if (radarBox) radarBox.addEventListener('click', async (e) => {
      const saveBtn = e.target.closest('[data-save]');
      const taskBtn = e.target.closest('[data-task]');
      if (!saveBtn && !taskBtn) return;
      const idx = Number(saveBtn ? saveBtn.dataset.save : taskBtn.dataset.task);
      const it = state.radarResults[idx];
      if (!it) return;
      if (saveBtn) {
        const rec = {
          id: DB.uid('idea'),
          text: `【AI爆款】${it.title}\n\n👥 受众：${it.audience || ''}\n📝 文案爆点：${it.copyHook || ''}\n🖼 封面建议：${it.cover || ''}\n✂️ 剪辑节奏：${it.editing || ''}\n🎬 内容结构：${it.content || ''}\n💬 参考金句：${it.quote || ''}`,
          tags: ['AI爆款', ...(it.tags || [])],
          source: state.radarQuery,
          image: '',
          mood: '',
          scene: it.audience ? '灵感迸发' : (state.radarScene || ''),
          status: 'idea',
          analysis: it,
          createdAt: Date.now(), updatedAt: Date.now(),
        };
        await DB.put('ideas', rec);
        window.toast('已保存到灵感库 ✨');
      } else {
        await DB.put('tasks', {
          id: DB.uid('task'), title: `【爆款】${it.title}`, section: 'daily', date: todayStr(),
          time: '', quadrant: 2, status: 'todo', pomodoro: 0, createdAt: Date.now(),
        });
        window.toast('已加入今日计划 ➕');
      }
    });

    // Quick capture
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
