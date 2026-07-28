/* 我的播客板块（小宇宙 / RSS / itunes） */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const PROXIES = ['https://api.allorigins.win/raw?url=', 'https://r.jina.ai/direct/'];

  async function fetchText(url) {
    let lastErr;
    for (const p of PROXIES) {
      try {
        const r = await fetch(p + encodeURIComponent(url));
        if (r.ok) { const t = await r.text(); if (t && t.length > 40) return t; }
      } catch (e) { lastErr = e; }
    }
    throw new Error('网络抓取失败：' + (lastErr ? lastErr.message : '无可用代理'));
  }

  async function itunesSearch(term) {
    const url = 'https://itunes.apple.com/search?media=podcast&entity=podcast&limit=10&term=' + encodeURIComponent(term);
    const r = await fetch(url);
    if (!r.ok) throw new Error('itunes 搜索失败');
    const j = await r.json();
    return (j.results || []).map((x) => ({
      title: x.collectionName, feedUrl: x.feedUrl, image: x.artworkUrl600 || x.artworkUrl100,
    })).filter((x) => x.feedUrl);
  }

  async function resolveFeed(input) {
    input = (input || '').trim();
    if (!input) throw new Error('请输入链接或节目名');
    // 节目名搜索
    if (!/^https?:\/\//i.test(input)) {
      const res = await itunesSearch(input);
      if (!res.length) throw new Error('未找到节目，请直接粘贴 RSS 链接');
      return { type: 'choose', list: res };
    }
    let feedUrl = input;
    // 小宇宙节目页 → 提取 RSS
    if (/xiaoyuzhoufm\.com\/podcast/i.test(input)) {
      try {
        const html = await fetchText(input);
        const m = html.match(/feed\.xiaoyuzhoufm\.com[^"'<\s]+?\.xml/)
              || html.match(/application\/rss\+xml[^>]*href="([^"]+)"/i)
              || html.match(/<link[^>]+type="application\/rss\+xml"[^>]+href="([^"]+)"/i);
        if (m) feedUrl = (m[1] ? m[1] : 'https://' + m[0]).replace(/&amp;/g, '&');
      } catch (e) { /* 忽略，用原链接兜底 */ }
    }
    return { type: 'feed', feedUrl };
  }

  function parseRSS(xml) {
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const ch = doc.querySelector('channel') || doc.querySelector('feed');
    function txt(el, tag) {
      const n = el.getElementsByTagName(tag)[0] || el.querySelector(tag);
      return n ? (n.textContent || '').trim() : '';
    }
    function attr(el, tag, a) {
      const n = el.getElementsByTagName(tag)[0] || el.querySelector(tag);
      return n ? (n.getAttribute(a) || '') : '';
    }
    const title = txt(ch, 'title');
    let image = attr(ch, 'image', 'href') || txt(ch.querySelector('image') || ch, 'url') || attr(ch, 'itunes\\:image', 'href');
    if (!image && ch.querySelector('image')) image = ch.querySelector('image').textContent;
    const description = (txt(ch, 'description') || txt(ch, 'summary') || '').replace(/<[^>]+>/g, '').slice(0, 200);
    const items = Array.from(doc.querySelectorAll('item, entry')).map((it) => {
      const enc = it.getElementsByTagName('enclosure')[0];
      const audio = enc ? (enc.getAttribute('url') || '') : '';
      const guid = txt(it, 'guid') || txt(it, 'id') || audio || title + Math.random();
      let dur = txt(it, 'itunes:duration') || txt(it, 'duration') || '';
      dur = parseDur(dur);
      return {
        guid,
        title: txt(it, 'title'),
        pubDate: (txt(it, 'pubDate') || txt(it, 'published') || '').slice(0, 16),
        audio,
        duration: dur,
        desc: (txt(it, 'description') || txt(it, 'summary') || '').replace(/<[^>]+>/g, '').slice(0, 300),
      };
    }).filter((e) => e.title);
    return { title, image, description, episodes: items };
  }

  function parseDur(s) {
    if (!s) return '';
    if (/^\d+$/.test(s)) { const sec = +s; return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
    const p = s.split(':').map(Number);
    if (p.length === 3) return p[0] + ':' + String(p[1]).padStart(2, '0') + ':' + String(p[2]).padStart(2, '0');
    if (p.length === 2) return p[0] + ':' + String(p[1]).padStart(2, '0');
    return s;
  }

  let audio = null; // 持久播放器
  let st = { sel: null, playing: null };

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.preload = 'metadata';
    audio.addEventListener('timeupdate', () => {
      if (st.sel && st.playing) savePos(st.playing, audio.currentTime);
    });
    audio.addEventListener('ended', () => { window.toast('播放结束 🎧'); });
    return audio;
  }

  async function savePos(guid, pos) {
    const p = await getPod(st.sel); if (!p) return;
    p.progress = p.progress || {};
    p.progress[guid] = p.progress[guid] || { pos: 0, notes: [] };
    p.progress[guid].pos = Math.floor(pos);
    await DB.put('podcasts', p);
  }

  async function getPod(id) { return DB.get('podcasts', id); }

  async function render(view) {
    const pods = await DB.getAll('podcasts');
    pods.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    view.innerHTML = `
      <div class="card">
        <div class="card-title">🎧 我的播客
          <div style="flex:1"></div>
          <button class="btn ghost" id="pdAdd" style="font-size:13px;padding:6px 12px;">➕ 添加节目</button>
          <button class="btn ghost" id="pdOpml" style="font-size:13px;padding:6px 12px;">⬇️ 导入OPML</button>
        </div>
        <p class="muted">支持 RSS 链接、小宇宙节目页链接，或直接搜节目名（itunes）。在线播放、断点续播、时间戳笔记。</p>
        <div id="podGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:12px;">
          ${pods.length ? pods.map((p) => `
            <div class="pod-card" data-id="${p.id}" style="cursor:pointer;background:var(--cream);border-radius:16px;padding:10px;text-align:center;">
              <img src="${p.image || 'icon.svg'}" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px;background:#fff;" onerror="this.src='icon.svg'"/>
              <div style="font-weight:700;margin-top:6px;font-size:13px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;height:34px;">${escapeHtml(p.title)}</div>
              <div class="muted" style="font-size:11px;">${p.episodes ? p.episodes.length : 0} 集</div>
            </div>`).join('') : '<p class="muted">还没有订阅的节目，点「➕ 添加节目」开始 🎵</p>'}
        </div>
      </div>
      <div id="podDetail"></div>`;

    view.querySelector('#pdAdd').addEventListener('click', () => showAdd(view));
    view.querySelector('#pdOpml').addEventListener('click', () => importOpml(view));
    view.querySelectorAll('.pod-card').forEach((c) => c.addEventListener('click', () => {
      st.sel = c.dataset.id; renderDetail(view);
    }));
  }

  async function showAdd(view) {
    const html = `
      <div class="modal-mask" id="pdMask">
        <div class="modal" style="max-width:520px;">
          <h3>➕ 添加节目</h3>
          <p class="muted">粘贴 RSS 链接 / 小宇宙节目页链接，或输入节目名搜索。</p>
          <div class="field"><textarea id="pdInput" placeholder="例如：https://feed.xiaoyuzhoufm.com/xxx.xml&#10;或：https://www.xiaoyuzhoufm.com/podcast/xxxx&#10;或：得意忘形"></textarea></div>
          <div id="pdResult" style="margin-top:10px;max-height:40vh;overflow:auto;"></div>
          <div style="display:flex;gap:10px;margin-top:14px;">
            <button class="btn" id="pdConfirm" style="flex:1;">解析并订阅</button>
            <button class="btn ghost" id="pdCancel">取消</button>
          </div>
        </div>
      </div>`;
    window.openModal(html, (root) => {
      const input = root.querySelector('#pdInput');
      const result = root.querySelector('#pdResult');
      root.querySelector('#pdCancel').addEventListener('click', window.closeModal);
      root.querySelector('#pdConfirm').addEventListener('click', async () => {
        const v = input.value.trim();
        if (!v) return;
        result.innerHTML = '<p class="muted">解析中…</p>';
        try {
          const r = await resolveFeed(v);
          if (r.type === 'choose') {
            result.innerHTML = r.list.map((x, i) => `
              <div class="add-row" style="align-items:center;background:var(--cream);padding:8px;border-radius:12px;margin-bottom:6px;">
                <img src="${x.image || 'icon.svg'}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;" onerror="this.src='icon.svg'"/>
                <div style="flex:1;margin-left:8px;"><b style="font-size:13px;">${escapeHtml(x.title)}</b></div>
                <button class="btn" data-i="${i}" style="font-size:12px;padding:6px 12px;">订阅</button>
              </div>`).join('');
            result.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => subscribe(b.dataset.i, r.list, view)));
          } else {
            await subscribeFeed(r.feedUrl, view);
            window.closeModal();
          }
        } catch (e) { result.innerHTML = '<p style="color:#E23A6E;">' + escapeHtml(e.message) + '</p>'; }
      });
    });
  }

  async function subscribe(i, list, view) {
    const x = list[i];
    await subscribeFeed(x.feedUrl, view);
    window.closeModal();
  }

  async function subscribeFeed(feedUrl, view) {
    window.toast('正在订阅…');
    const xml = await fetchText(feedUrl);
    const data = parseRSS(xml);
    if (!data.episodes.length) { window.toast('未解析到集数 ⚠️'); return; }
    const id = 'pod_' + Date.now().toString(36);
    const rec = {
      id, title: data.title || '未命名节目', image: data.image, description: data.description,
      feedUrl, episodes: data.episodes, progress: {}, addedAt: Date.now(),
    };
    await DB.put('podcasts', rec);
    st.sel = id; renderDetail(view); render(view);
    window.toast('订阅成功 ✓ ' + data.episodes.length + ' 集');
  }

  async function renderDetail(view) {
    const detail = view.querySelector('#podDetail');
    if (!st.sel) { detail.innerHTML = ''; return; }
    const p = await getPod(st.sel); if (!p) { detail.innerHTML = ''; return; }
    const prog = p.progress || {};
    detail.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:14px;align-items:center;">
          <img src="${p.image || 'icon.svg'}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;" onerror="this.src='icon.svg'"/>
          <div style="flex:1;">
            <div class="card-title" style="margin-bottom:2px;">${escapeHtml(p.title)}</div>
            <p class="muted" style="font-size:12px;">${escapeHtml(p.description) || '共 ' + p.episodes.length + ' 集'}</p>
          </div>
          <button class="t-del" data-delpod="${p.id}" title="取消订阅">🗑</button>
        </div>
        <div id="epList" style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          ${p.episodes.map((e) => {
            const pr = prog[e.guid] || {};
            const cont = pr.pos ? ` · ⏯续播 ${fmtSec(pr.pos)}` : '';
            return `<div class="ep-row" data-guid="${e.guid}" style="display:flex;gap:10px;align-items:center;background:var(--cream);border-radius:12px;padding:10px 12px;cursor:pointer;${st.playing === e.guid ? 'outline:2px solid var(--pink);' : ''}">
              <button class="btn" data-play="${e.guid}" style="font-size:12px;padding:6px 12px;">${st.playing === e.guid ? '⏸' : '▶'}</button>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(e.title)}</div>
                <div class="muted" style="font-size:11px;">${e.pubDate || ''}${e.duration ? ' · ' + e.duration : ''}${cont}</div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
      <div id="pdPlayer"></div>`;
    detail.querySelector('[data-delpod]').addEventListener('click', async (ev) => {
      if (!confirm('确定取消订阅「' + p.title + '」？')) return;
      await DB.del('podcasts', p.id); st.sel = null; render(view);
    });
    detail.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); playEpisode(p, b.dataset.play);
    }));
    detail.querySelectorAll('.ep-row').forEach((row) => row.addEventListener('click', () => playEpisode(p, row.dataset.guid)));
    if (st.playing) renderPlayer(view, p);
  }

  function playEpisode(p, guid) {
    const ep = p.episodes.find((x) => x.guid === guid);
    if (!ep || !ep.audio) { window.toast('该集无音频链接 ⚠️'); return; }
    const a = ensureAudio();
    st.sel = p.id;
    if (st.playing === guid && !a.paused) { a.pause(); }
    else {
      if (st.playing !== guid) {
        a.src = ep.audio;
        const pr = (p.progress && p.progress[guid]) || {};
        a.addEventListener('loadedmetadata', () => { if (pr.pos && pr.pos < a.duration - 2) a.currentTime = pr.pos; }, { once: true });
        st.playing = guid;
      }
      a.play().catch(() => window.toast('播放被浏览器拦截，请点一下页面'));
    }
    renderDetail(document.getElementById('view'));
  }

  async function renderPlayer(view, p) {
    const ep = p.episodes.find((x) => x.guid === st.playing);
    const box = view.querySelector('#pdPlayer');
    if (!box || !ep) return;
    const pr = (p.progress && p.progress[st.playing]) || { notes: [] };
    const notes = pr.notes || [];
    box.innerHTML = `
      <div class="card" style="position:sticky;bottom:8px;background:var(--card);box-shadow:0 6px 20px rgba(0,0,0,.08);">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">🎵 ${escapeHtml(ep.title)}</div>
        <div style="display:flex;align-items:center;gap:10px;">
          <button class="btn" id="plToggle" style="font-size:13px;padding:6px 14px;">${audio.paused ? '▶' : '⏸'}</button>
          <input type="range" id="plSeek" min="0" max="100" value="0" style="flex:1;"/>
          <span id="plTime" class="muted" style="font-size:12px;min-width:90px;text-align:right;">0:00 / ${ep.duration || '0:00'}</span>
          <select id="plSpeed" style="padding:4px;border-radius:8px;border:1px solid var(--line);">
            ${[0.75,1,1.25,1.5,2].map((s) => `<option value="${s}" ${s===1?'selected':''}>${s}×</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <input type="text" id="tsNote" placeholder="在当前播放位置添加时间戳笔记…" style="flex:1;"/>
          <button class="btn ghost" id="tsAdd" style="font-size:12px;">📝 记一笔</button>
        </div>
        <div id="tsList" style="margin-top:8px;display:flex;flex-direction:column;gap:4px;">
          ${notes.length ? notes.slice().reverse().map((n) => `<div style="font-size:12px;background:var(--cream);border-radius:8px;padding:6px 10px;"><b style="color:var(--pink);">${fmtSec(n.t)}</b> ${escapeHtml(n.text)}</div>`).join('') : '<p class="muted" style="font-size:12px;">还没有时间戳笔记</p>'}
        </div>
      </div>`;
    const seek = box.querySelector('#plSeek');
    const timeEl = box.querySelector('#plTime');
    audio.ontimeupdate = () => {
      if (audio.duration) { seek.value = (audio.currentTime / audio.duration) * 100; timeEl.textContent = fmtSec(audio.currentTime) + ' / ' + fmtSec(audio.duration); }
    };
    box.querySelector('#plToggle').addEventListener('click', () => { audio.paused ? audio.play() : audio.pause(); renderPlayer(view, p); });
    seek.addEventListener('input', () => { if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration; });
    box.querySelector('#plSpeed').addEventListener('change', (e) => { audio.playbackRate = Number(e.target.value); });
    box.querySelector('#tsAdd').addEventListener('click', async () => {
      const t = box.querySelector('#tsNote').value.trim(); if (!t) return;
      const rec = await getPod(p.id); rec.progress = rec.progress || {};
      rec.progress[st.playing] = rec.progress[st.playing] || { pos: 0, notes: [] };
      rec.progress[st.playing].notes = rec.progress[st.playing].notes || [];
      rec.progress[st.playing].notes.push({ t: Math.floor(audio.currentTime), text: t });
      await DB.put('podcasts', rec); renderPlayer(view, p); window.toast('已记录 ✓');
    });
  }

  function fmtSec(s) {
    s = Math.floor(s || 0); const m = Math.floor(s / 60); const ss = String(s % 60).padStart(2, '0');
    if (m >= 60) { const h = Math.floor(m / 60); return h + ':' + String(m % 60).padStart(2, '0') + ':' + ss; }
    return m + ':' + ss;
  }

  async function importOpml(view) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.opml,.xml';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const text = await f.text();
      const doc = new DOMParser().parseFromString(text, 'text/xml');
      const nodes = Array.from(doc.querySelectorAll('outline')).filter((o) => o.getAttribute('xmlUrl') || o.getAttribute('url'));
      if (!nodes.length) { window.toast('OPML 中未找到订阅源 ⚠️'); return; }
      let ok = 0;
      for (const n of nodes) {
        try { await subscribeFeed(n.getAttribute('xmlUrl') || n.getAttribute('url'), view); ok++; }
        catch (e) {}
      }
      window.toast('已导入 ' + ok + ' 个节目 ✓');
    };
    inp.click();
  }

  function exportOpml(view) {
    DB.getAll('podcasts').then((pods) => {
      const body = pods.map((p) => `    <outline text="${escapeHtml(p.title)}" title="${escapeHtml(p.title)}" type="rss" xmlUrl="${escapeHtml(p.feedUrl || '')}" htmlUrl=""/>`).join('\n');
      const opml = `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0">\n  <body>\n${body}\n  </body>\n</opml>`;
      const blob = new Blob([opml], { type: 'text/xml' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '猪猪鲨手_播客订阅.opml'; a.click();
      URL.revokeObjectURL(a.href); window.toast('已导出 OPML ✓');
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 把导出挂到详情区（通过长按标题不可用，改为在添加面板里放导出按钮更稳妥）
  window.Sections.podcast = {
    id: 'podcast', title: '我的播客', emoji: '🎧',
    render(view) {
      st.sel = null; st.playing = null;
      render(view).then(() => {
        // 在标题区补一个导出按钮
        const addBtn = view.querySelector('#pdOpml');
        if (addBtn && !view.querySelector('#pdExport')) {
          const ex = document.createElement('button');
          ex.id = 'pdExport'; ex.className = 'btn ghost'; ex.style.cssText = 'font-size:13px;padding:6px 12px;';
          ex.textContent = '⬆️ 导出OPML';
          ex.addEventListener('click', () => exportOpml(view));
          addBtn.parentNode.insertBefore(ex, addBtn.nextSibling);
        }
      });
    },
  };
})();
