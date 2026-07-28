/* 猪猪鲨手 - 应用框架：导航 / 路由 / 弹窗 / 撒花 / 设置 */
(function () {
  'use strict';

  const ORDER = ['dashboard', 'daily', 'health', 'english', 'sidehustle', 'inspiration', 'review', 'notes', 'podcast', 'newtask'];
  const navEl = document.getElementById('nav');
  const bottomEl = document.getElementById('bottomTabs');
  const viewEl = document.getElementById('view');
  const titleEl = document.getElementById('pageTitle');
  const emojiEl = document.getElementById('pageEmoji');
  let current = 'dashboard';

  /* ---------- 导航渲染 ---------- */
  function renderNav() {
    navEl.innerHTML = ORDER.map((id) => {
      const s = window.Sections[id];
      return `<button class="nav-item ${id === current ? 'active' : ''}" data-id="${id}">
        <span class="emoji">${s.emoji}</span><span>${s.title}</span>
        <span class="badge" data-badge="${id}" style="display:none;"></span>
      </button>`;
    }).join('');
    navEl.querySelectorAll('.nav-item').forEach((b) =>
      b.addEventListener('click', () => go(b.dataset.id)));

    // 底部 Tab：移动端只放高频项 + 新建（含首页）
    const mobileIds = ['dashboard', 'daily', 'health', 'podcast', 'newtask'];
    bottomEl.innerHTML = mobileIds.map((id) => {
      const s = window.Sections[id];
      return `<button class="bt-item ${id === current ? 'active' : ''}" data-id="${id}">
        <span class="bt-emoji">${s.emoji}</span><span>${s.title}</span></button>`;
    }).join('');
    bottomEl.querySelectorAll('.bt-item').forEach((b) =>
      b.addEventListener('click', () => go(b.dataset.id)));
  }

  async function refreshNavBadges() {
    const all = await DB.getAll('tasks');
    const today = todayStr();
    const pending = all.filter((t) => t.section === 'daily' && t.date === today && t.status !== 'done').length;
    const badge = navEl.querySelector('[data-badge="daily"]');
    if (badge) {
      badge.style.display = pending ? 'inline-flex' : 'none';
      badge.textContent = pending;
    }
  }
  window.refreshNavBadges = refreshNavBadges;

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* ---------- 路由 ---------- */
  async function go(id) {
    if (!window.Sections[id]) id = 'daily';
    current = id;
    const s = window.Sections[id];
    titleEl.textContent = s.title;
    emojiEl.textContent = s.emoji;
    renderNav();
    viewEl.scrollTop = 0;
    window.scrollTo(0, 0);
    const chip = document.getElementById('todayChip');
    if (chip) {
      const wd = ['日', '一', '二', '三', '四', '五', '六'][new Date().getDay()];
      chip.textContent = `${new Date().getMonth() + 1}月${new Date().getDate()}日 周${wd}`;
    }
    await s.render(viewEl);
    refreshNavBadges();
    if (document.getElementById('sidebar').style.display !== 'none') document.getElementById('sidebar').classList.remove('open');
  }
  window.go = go;

  /* ---------- 弹窗 ---------- */
  window.openModal = function (html, bind) {
    const root = document.getElementById('modalRoot');
    root.innerHTML = html;
    if (bind) bind(root);
  };
  window.closeModal = function () {
    document.getElementById('modalRoot').innerHTML = '';
  };

  /* ---------- Toast ---------- */
  window.toast = function (msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#5A4A42;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:600;z-index:80;box-shadow:0 8px 24px rgba(0,0,0,.2);animation:slideUp .25s;';
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, 1400);
  };

  /* ---------- 撒花 ---------- */
  window.fireConfetti = function () {
    const c = document.getElementById('confetti');
    c.style.display = 'block';
    const ctx = c.getContext('2d');
    c.width = window.innerWidth; c.height = window.innerHeight;
    const colors = ['#FF9EB5', '#FFD9A8', '#B8E6D2', '#BFD9FF', '#FFE9A8'];
    const emojis = ['🎉', '✨', '🌟', '💖', '🐷', '🦈'];
    const parts = [];
    for (let i = 0; i < 90; i++) {
      parts.push({
        x: Math.random() * c.width, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
        size: 10 + Math.random() * 14, rot: Math.random() * 6,
        color: colors[i % colors.length], emoji: Math.random() > 0.5 ? emojis[i % emojis.length] : null,
      });
    }
    let frame = 0;
    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rot += 0.05;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.emoji) { ctx.font = p.size + 'px serif'; ctx.fillText(p.emoji, 0, 0); }
        else { ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6); }
        ctx.restore();
      });
      frame++;
      if (frame < 140) requestAnimationFrame(draw);
      else { c.style.display = 'none'; ctx.clearRect(0, 0, c.width, c.height); }
    }
    draw();
  };

  /* ---------- 设置 ---------- */
  function openSettings() {
    const html = `
      <div class="modal-mask" id="setMask">
        <div class="modal">
          <h3>⚙️ 设置</h3>
          <div class="set-row">
            <div><div class="label">📲 安装为桌面应用</div><div class="desc">浏览器右上角菜单 →「安装此应用 / 添加到主屏幕」，即可获得独立窗口与桌面图标（PWA）。</div></div>
          </div>
          <div class="set-row">
            <div><div class="label">🤖 AI 辅助</div><div class="desc">填写兼容 OpenAI 的接口（DeepSeek / 混元 / 通义 / OpenAI 等均可用）。Key 仅存本地，不联网上传。不填也能正常使用核心功能。</div></div>
          </div>
          <div class="set-row" style="flex-direction:column;align-items:stretch;gap:8px;">
            <div class="field"><label>接口地址 BaseURL</label><input type="text" id="aiBase" placeholder="https://api.openai.com/v1" /></div>
            <div class="field"><label>模型 Model</label><input type="text" id="aiModel" placeholder="gpt-4o-mini" /></div>
            <div class="field"><label>API Key</label><input type="password" id="aiKey" placeholder="sk-..." /></div>
            <button class="btn ghost" id="aiSave" style="align-self:flex-start;">💾 保存 AI 配置</button>
          </div>
          <div class="set-row">
            <div><div class="label">💾 数据备份</div><div class="desc">导出全部数据为 JSON 文件，或导入恢复。</div></div>
            <div style="display:flex;gap:8px;">
              <button class="btn ghost" id="setExport">导出</button>
              <button class="btn ghost" id="setImport">导入</button>
            </div>
          </div>
          <div class="set-row">
            <div><div class="label">🗑 清空数据</div><div class="desc">删除本地全部记录，不可恢复。</div></div>
            <button class="btn ghost" id="setClear" style="color:#E23A6E;">清空</button>
          </div>
          <div class="modal-actions">
            <button class="btn" id="setClose">关闭</button>
          </div>
        </div>
      </div>`;
    window.openModal(html, (root) => {
      AI.getConfig().then((cfg) => {
        root.querySelector('#aiBase').value = cfg.baseURL || '';
        root.querySelector('#aiModel').value = cfg.model || '';
        root.querySelector('#aiKey').value = cfg.apiKey || '';
      });
      root.querySelector('#aiSave').addEventListener('click', async () => {
        const cfg = {
          baseURL: root.querySelector('#aiBase').value.trim() || 'https://api.openai.com/v1',
          model: root.querySelector('#aiModel').value.trim() || 'gpt-4o-mini',
          apiKey: root.querySelector('#aiKey').value.trim(),
        };
        await AI.saveConfig(cfg);
        window.toast('AI 配置已保存 ✓');
      });
      root.querySelector('#setClose').addEventListener('click', window.closeModal);
      root.querySelector('#setMask').addEventListener('click', (e) => { if (e.target.id === 'setMask') window.closeModal(); });
      root.querySelector('#setExport').addEventListener('click', exportData);
      root.querySelector('#setImport').addEventListener('click', importData);
      root.querySelector('#setClear').addEventListener('click', async () => {
        if (confirm('确定清空所有本地数据？此操作不可恢复！')) {
          await DB.clear('tasks'); await DB.clear('notes');
          window.closeModal(); window.toast('已清空'); go(current);
        }
      });
    });
  }

  async function exportData() {
    const stores = ['tasks', 'notes', 'settings', 'health', 'words', 'review', 'money', 'clients', 'ideas', 'podcasts', 'english', 'english_mistakes'];
    const data = {};
    for (const s of stores) data[s] = await DB.getAll(s);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '猪猪鲨手_备份_' + todayStr() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    window.toast('已导出 ✓');
  }
  function importData() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const stores = ['tasks', 'notes', 'settings', 'health', 'words', 'review', 'money', 'clients', 'ideas', 'podcasts', 'english', 'english_mistakes'];
        for (const s of stores) if (data[s]) await DB.bulkPut(s, data[s]);
        window.toast('导入成功 ✓'); window.closeModal(); go(current);
      } catch (e) { alert('文件格式不正确'); }
    };
    inp.click();
  }

  /* ---------- 全局事件 ---------- */
  document.getElementById('fab').addEventListener('click', () => window.openNewTaskModal());
  document.getElementById('openSettings').addEventListener('click', openSettings);
  document.getElementById('menuBtn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  /* ---------- 启动 ---------- */
  renderNav();
  go('dashboard');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    try { navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) {}
  }
})();
