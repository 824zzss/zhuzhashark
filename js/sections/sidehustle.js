/* 副业赚米板块：收支记账 + 客户 + 自动周/月/年报（SVG 可视化） */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const INCOME_CATS = ['工资/兼职', '项目外包', '稿费/撰稿', '知识付费', '平台分成', '投资理财', '其他收入'];
  const EXPENSE_CATS = ['税费', '平台抽成', '工具订阅', '素材/设备', '餐饮', '交通', '推广', '其他支出'];
  const ACCOUNTS = ['微信', '支付宝', '银行卡', '现金', '小宇宙', '其他'];

  let reportRange = 'month'; // week | month | year

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function money(n) { return '¥' + (Number(n) || 0).toLocaleString('zh-CN', { maximumFractionDigits: 2 }); }

  // 周一起点的本周区间
  function weekRange() {
    const now = new Date(); const day = (now.getDay() + 6) % 7; // 周一=0
    const mon = new Date(now); mon.setDate(now.getDate() - day);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return [ymd(mon), ymd(sun)];
  }
  function monthRange() {
    const now = new Date();
    return [ymd(new Date(now.getFullYear(), now.getMonth(), 1)), ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0))];
  }
  function yearRange() {
    const y = new Date().getFullYear();
    return [y + '-01-01', y + '-12-31'];
  }
  function inRange(d, a, b) { return d >= a && d <= b; }

  function drawBars(values, w, h, color) {
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));
    const bw = (w - 16) / values.length;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` + values.map((v, i) => {
      const bh = v ? (Math.abs(v) / max) * (h - 18) : 2;
      const col = v < 0 ? '#E23A6E' : color;
      return `<rect x="${8 + i * bw + 3}" y="${h - bh - 8}" width="${bw - 6}" height="${bh}" rx="4" fill="${col}" opacity="${v ? 1 : .25}"/>`;
    }).join('') + `</svg>`;
  }

  async function render(view) {
    const txs = await DB.getAll('money');
    const clients = await DB.getAll('clients');
    const t = todayStr();
    const monthTxs = txs.filter((x) => x.date.slice(0, 7) === t.slice(0, 7));
    const mIncome = monthTxs.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const mExpense = monthTxs.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const totalIncome = txs.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const pending = txs.filter((x) => x.type === 'income' && x.status === 'pending');

    view.innerHTML = `
      <div class="card">
        <div class="card-title">💰 副业赚米 · 本月概览</div>
        <div class="stat-grid">
          <div class="stat"><div class="stat-num" style="color:#1F9D74;">${money(mIncome)}</div><div class="stat-lbl">本月收入</div></div>
          <div class="stat"><div class="stat-num" style="color:#E23A6E;">${money(mExpense)}</div><div class="stat-lbl">本月支出</div></div>
          <div class="stat"><div class="stat-num">${money(mIncome - mExpense)}</div><div class="stat-lbl">本月净收</div></div>
          <div class="stat"><div class="stat-num">${money(totalIncome)}</div><div class="stat-lbl">累计收入</div></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">➕ 记一笔</div>
        <div class="field" style="flex-direction:row;gap:8px;">
          <button class="q-chip on" data-type="income" id="tIncome">收入</button>
          <button class="q-chip" data-type="expense" id="tExpense">支出</button>
          <span style="flex:1;"></span>
          <label style="display:flex;align-items:center;gap:4px;font-size:13px;"><input type="checkbox" id="tPending" style="width:16px;"/> 待收款</label>
        </div>
        <div class="add-row" style="margin-top:8px;">
          <div class="field"><input type="number" id="tAmount" placeholder="金额" step="0.01" style="width:130px;" /></div>
          <div class="field"><input type="date" id="tDate" value="${t}" style="width:auto;" /></div>
          <div class="field"><select id="tCat" style="width:auto;"></select></div>
          <div class="field"><select id="tAccount" style="width:auto;">${ACCOUNTS.map((a) => `<option>${a}</option>`).join('')}</select></div>
        </div>
        <div class="add-row" style="margin-top:8px;">
          <div class="field"><input type="text" id="tProject" placeholder="项目/来源（可选）" /></div>
          <div class="field"><input type="text" id="tClient" list="clientList" placeholder="客户（可选）" /></div>
          <datalist id="clientList">${clients.map((c) => `<option value="${escapeHtml(c.name)}">`).join('')}</datalist>
        </div>
        <div class="field" style="margin-top:8px;"><input type="text" id="tNote" placeholder="备注（可选）" /></div>
        <button class="btn" id="tSave" style="width:100%;margin-top:10px;">💾 保存</button>
      </div>

      <div class="card">
        <div class="card-title">📊 自动报表</div>
        <div class="field" style="flex-direction:row;gap:8px;">
          <button class="q-chip ${reportRange === 'week' ? 'on' : ''}" data-rng="week">周报</button>
          <button class="q-chip ${reportRange === 'month' ? 'on' : ''}" data-rng="month">月报</button>
          <button class="q-chip ${reportRange === 'year' ? 'on' : ''}" data-rng="year">年报</button>
        </div>
        <div id="reportBody" style="margin-top:12px;"></div>
      </div>

      ${pending.length ? `<div class="card">
        <div class="card-title">🔔 待收款提醒（${pending.length}）</div>
        ${pending.map((p) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:var(--cream);border-radius:12px;margin-bottom:6px;">
          <b style="color:#E23A6E;">${money(p.amount)}</b><span class="muted">${escapeHtml(p.category)}</span>
          <span style="flex:1;"></span><span class="muted" style="font-size:12px;">${p.date}</span>
          <button class="t-del" data-paid="${p.id}">✓已收</button>
        </div>`).join('')}
      </div>` : ''}

      <div class="card">
        <div class="card-title">🏦 账户概览（净收 = 收入 − 支出）</div>
        <div class="q-options" id="acctBox" style="flex-wrap:wrap;gap:8px;">
          ${ACCOUNTS.map((a) => {
            const net = txs.filter((x) => (x.account || '其他') === a).reduce((s, x) => s + (x.type === 'income' ? x.amount : -x.amount), 0);
            return `<span class="pill" style="font-size:13px;">${a} · <b style="color:${net >= 0 ? '#1F9D74' : '#E23A6E'}">${money(net)}</b></span>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">📤 数据导出（Excel / CSV）</div>
        <p class="muted" style="margin-top:0;">导出为 CSV（已含 UTF-8 BOM，可直接用 Excel 打开，中文不乱码）。</p>
        <div class="add-row" style="flex-wrap:wrap;gap:8px;">
          <button class="btn ghost" id="expAll">📑 导出全部</button>
          <button class="btn ghost" id="expMonth">📅 导出本月</button>
        </div>
      </div>

      <div class="card">
        <div class="card-title">📒 交易记录</div>
        <div id="txList" style="display:flex;flex-direction:column;gap:6px;"></div>
      </div>

      <div class="card">
        <div class="card-title">👥 客户管理</div>
        <div class="add-row">
          <input type="text" id="cName" placeholder="客户名称…" style="flex:1;" />
          <button class="btn" id="cAdd">添加</button>
        </div>
        <div id="clientListBox" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;"></div>
      </div>`;

    paintReport(view, txs);
    paintTx(view, txs);
    paintClients(view, clients);
    bind(view, txs, clients);
  }

  function rangeInfo() {
    if (reportRange === 'week') { const [a, b] = weekRange(); return { a, b, label: a.slice(5) + ' ~ ' + b.slice(5) }; }
    if (reportRange === 'month') { const [a, b] = monthRange(); return { a, b, label: a.slice(0, 7) }; }
    const y = new Date().getFullYear(); return { a: y + '-01-01', b: y + '-12-31', label: y + ' 年' };
  }

  function paintReport(view, txs) {
    const box = view.querySelector('#reportBody');
    const { a, b, label } = rangeInfo();
    const inR = txs.filter((x) => inRange(x.date, a, b));
    const income = inR.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
    const expense = inR.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
    const net = income - expense;

    // 分类占比
    const byCat = {};
    inR.forEach((x) => { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
    const catEntries = Object.entries(byCat).sort((p, q) => q[1] - p[1]).slice(0, 6);
    const catMax = catEntries.length ? Math.max(...catEntries.map((e) => e[1])) : 1;

    // 环比/同比
    let compareTxt = '';
    if (reportRange === 'month') {
      const y = new Date().getFullYear(), m = new Date().getMonth();
      const pa = ymd(new Date(y, m - 1, 1)), pb = ymd(new Date(y, m, 0));
      const prev = txs.filter((x) => inRange(x.date, pa, pb) && x.type === 'income').reduce((s, x) => s + x.amount, 0);
      const rate = prev ? Math.round(((income - prev) / prev) * 100) : null;
      compareTxt = prev ? `上月收入 ${money(prev)} · <b style="color:${rate >= 0 ? '#1F9D74' : '#E23A6E'}">${rate >= 0 ? '↑' : '↓'}${Math.abs(rate)}%</b>` : '上月无数据';
    } else if (reportRange === 'year') {
      const y = new Date().getFullYear() - 1;
      const prev = txs.filter((x) => x.date.slice(0, 4) === String(y) && x.type === 'income').reduce((s, x) => s + x.amount, 0);
      compareTxt = prev ? `去年收入 ${money(prev)}` : '去年无数据';
    }

    // 趋势：周=每日净收(7天)，月=每日净收(当月)，年=每月收入(12月)
    let trendVals = [], trendLabel = '';
    if (reportRange === 'week') {
      const [wa] = weekRange(); const base = new Date(wa + 'T00:00:00');
      trendVals = [];
      for (let i = 0; i < 7; i++) {
        const d = ymd(new Date(base)); base.setDate(base.getDate() + 1);
        const dayTx = inR.filter((x) => x.date === d);
        const inc = dayTx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
        const exp = dayTx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
        trendVals.push(Math.round((inc - exp) * 100) / 100);
      }
      trendLabel = '本周每日净收';
    } else if (reportRange === 'month') {
      const y = new Date().getFullYear(), m = new Date().getMonth();
      const days = new Date(y, m + 1, 0).getDate();
      trendVals = [];
      for (let i = 1; i <= days; i++) {
        const d = ymd(new Date(y, m, i));
        const dayTx = inR.filter((x) => x.date === d);
        const inc = dayTx.filter((x) => x.type === 'income').reduce((s, x) => s + x.amount, 0);
        const exp = dayTx.filter((x) => x.type === 'expense').reduce((s, x) => s + x.amount, 0);
        trendVals.push(Math.round((inc - exp) * 100) / 100);
      }
      trendLabel = '本月每日净收';
    } else {
      const y = new Date().getFullYear();
      trendVals = [];
      for (let i = 1; i <= 12; i++) {
        const inc = inR.filter((x) => x.date.slice(0, 7) === y + '-' + String(i).padStart(2, '0') && x.type === 'income').reduce((s, x) => s + x.amount, 0);
        trendVals.push(Math.round(inc * 100) / 100);
      }
      trendLabel = '今年每月收入';
    }

    box.innerHTML = `
      <div class="plan-meta"><div class="row">
        <span class="pill">收入 <b style="color:#1F9D74;">${money(income)}</b></span>
        <span class="pill">支出 <b style="color:#E23A6E;">${money(expense)}</b></span>
        <span class="pill">净收 <b>${money(net)}</b></span>
      </div></div>
      <p class="muted" style="margin:8px 0 4px;">📅 ${label}${compareTxt ? ' · ' + compareTxt : ''}</p>
      <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin:10px 0 4px;">${trendLabel}</div>
      ${drawBars(trendVals, 600, reportRange === 'year' ? 130 : 100, '#FF9EB5')}
      <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin:12px 0 6px;">分类占比（Top）</div>
      ${catEntries.length ? catEntries.map(([c, v]) => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px;">
        <span style="min-width:84px;">${escapeHtml(c)}</span>
        <div style="flex:1;height:12px;background:var(--cream);border-radius:6px;overflow:hidden;"><div style="height:100%;width:${Math.round(v / catMax * 100)}%;background:linear-gradient(90deg,#FFB6C7,#FF7AA2);"></div></div>
        <b style="min-width:64px;text-align:right;">${money(v)}</b>
      </div>`).join('') : '<p class="muted">本期暂无数据</p>'}
    `;
  }

  function paintTx(view, txs) {
    const list = view.querySelector('#txList');
    const sorted = txs.slice().sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : (b.createdAt || 0) - (a.createdAt || 0)));
    list.innerHTML = sorted.length ? sorted.slice(0, 100).map((x) => `<div style="display:flex;gap:10px;align-items:center;padding:8px 12px;background:var(--cream);border-radius:12px;">
      <span style="font-size:18px;">${x.type === 'income' ? '💚' : '💸'}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:700;color:${x.type === 'income' ? '#1F9D74' : '#E23A6E'};">${money(x.amount)} ${x.status === 'pending' ? '<span style="font-size:11px;color:#E23A6E;">· 待收</span>' : ''}</div>
        <div class="muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(x.category)}${x.account ? ' · ' + escapeHtml(x.account) : ''}${x.project ? ' · ' + escapeHtml(x.project) : ''}${x.client ? ' · ' + escapeHtml(x.client) : ''}</div>
      </div>
      <span class="muted" style="font-size:12px;">${x.date.slice(5)}</span>
      <button class="t-del" data-del="${x.id}">🗑</button>
    </div>`).join('') : '<p class="muted">还没有记账，先记一笔吧～</p>';
  }

  function exportCSV(rows, filename) {
    const header = ['日期', '类型', '账户', '分类', '项目', '客户', '金额', '状态', '备注'];
    const esc = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [header.join(',')].concat(rows.map((r) => [
      r.date, r.type === 'income' ? '收入' : '支出', r.account || '', r.category || '',
      r.project || '', r.client || '', r.amount, r.status === 'pending' ? '待收款' : '已完成', r.note || '',
    ].map(esc).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click(); URL.revokeObjectURL(a.href);
  }

  function paintClients(view, clients) {
    const box = view.querySelector('#clientListBox');
    box.innerHTML = clients.length ? clients.map((c) => `<span style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:var(--cream);border-radius:999px;font-size:13px;">👤 ${escapeHtml(c.name)} <button class="t-del" data-cdel="${c.id}" style="font-size:12px;">✕</button></span>`).join('') : '<p class="muted">还没有客户</p>';
  }

  function bind(view, txs, clients) {
    let curType = 'income';
    const catSel = view.querySelector('#tCat');
    const fillCat = () => { catSel.innerHTML = (curType === 'income' ? INCOME_CATS : EXPENSE_CATS).map((c) => `<option>${c}</option>`).join(''); };
    fillCat();
    const setType = (tp) => { curType = tp; fillCat(); view.querySelector('#tIncome').classList.toggle('on', tp === 'income'); view.querySelector('#tExpense').classList.toggle('on', tp === 'expense'); };
    view.querySelector('#tIncome').addEventListener('click', () => setType('income'));
    view.querySelector('#tExpense').addEventListener('click', () => setType('expense'));

    view.querySelector('#tSave').addEventListener('click', async () => {
      const amount = Number(view.querySelector('#tAmount').value);
      if (!amount) { view.querySelector('#tAmount').focus(); return; }
      const rec = {
        id: DB.uid('m'), type: curType, amount: Math.abs(amount),
        date: view.querySelector('#tDate').value || todayStr(),
        category: catSel.value, account: view.querySelector('#tAccount').value,
        project: view.querySelector('#tProject').value.trim(),
        client: view.querySelector('#tClient').value.trim(), note: view.querySelector('#tNote').value.trim(),
        status: view.querySelector('#tPending').checked && curType === 'income' ? 'pending' : 'done',
        createdAt: Date.now(),
      };
      await DB.put('money', rec);
      if (rec.client && !clients.find((c) => c.name === rec.client)) { await DB.put('clients', { id: DB.uid('c'), name: rec.client }); }
      window.toast('已保存 ✓'); render(view);
    });

    view.querySelectorAll('[data-rng]').forEach((b) => b.addEventListener('click', () => {
      reportRange = b.dataset.rng; render(view);
    }));

    // 导出 CSV
    const expAll = view.querySelector('#expAll');
    const expMonth = view.querySelector('#expMonth');
    if (expAll) expAll.addEventListener('click', () => {
      if (!txs.length) { window.toast('还没有记账数据'); return; }
      exportCSV(txs.slice().sort((a, b) => (a.date < b.date ? -1 : 1)), '猪猪鲨手_副业记账_全部_' + todayStr() + '.csv');
      window.toast('已导出全部 ✓');
    });
    if (expMonth) expMonth.addEventListener('click', () => {
      const m = txs.filter((x) => x.date.slice(0, 7) === todayStr().slice(0, 7));
      if (!m.length) { window.toast('本月还没有记账'); return; }
      exportCSV(m, '猪猪鲨手_副业记账_' + todayStr().slice(0, 7) + '.csv');
      window.toast('已导出本月 ✓');
    });

    view.querySelector('#txList').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-del]'); if (!b) return;
      await DB.del('money', b.dataset.del); render(view);
    });

    view.querySelector('#clientListBox').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cdel]'); if (!b) return;
      await DB.del('clients', b.dataset.cdel); render(view);
    });
    view.querySelector('#cAdd').addEventListener('click', async () => {
      const n = view.querySelector('#cName').value.trim(); if (!n) return;
      if (!clients.find((c) => c.name === n)) { await DB.put('clients', { id: DB.uid('c'), name: n }); }
      window.toast('客户已添加 ✓'); render(view);
    });

    // 待收款 ✓已收
    const pendBox = view.querySelectorAll('[data-paid]');
    pendBox.forEach((b) => b.addEventListener('click', async () => {
      const id = b.dataset.paid; const r = await DB.get('money', id);
      if (r) { r.status = 'done'; await DB.put('money', r); }
      window.toast('已标记收款 ✓'); render(view);
    }));
  }

  window.Sections.sidehustle = { id: 'sidehustle', title: '副业赚米', emoji: '💰', render };
})();
