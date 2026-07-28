/* 健康打卡板块 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const HABITS = [
    { key: 'exercise', emoji: '🏃', label: '运动' },
    { key: 'water', emoji: '💧', label: '喝水8杯' },
    { key: 'sleep', emoji: '🌙', label: '早睡' },
    { key: 'read', emoji: '📚', label: '阅读' },
  ];
  const MOODS = ['😀', '😌', '🥰', '😴', '😤', '😢', '🤔', '🎉'];

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dayOffset(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function sleepHours(bed, wake) {
    if (!bed || !wake) return null;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let h = wh - bh + (wm - bm) / 60; if (h <= 0) h += 24;
    return Math.round(h * 10) / 10;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // —— 饮食：常见食物热量表（每 100g 千卡），用于手动录入与 AI 兜底推荐 ——
  const DIET_FOODS = [
    { name: '米饭', kcal: 116 }, { name: '白粥', kcal: 46 }, { name: '馒头', kcal: 223 }, { name: '面条', kcal: 110 },
    { name: '全麦面包', kcal: 246 }, { name: '燕麦', kcal: 367 }, { name: '红薯', kcal: 90 }, { name: '玉米', kcal: 106 },
    { name: '鸡胸肉', kcal: 133 }, { name: '鸡蛋', kcal: 144 }, { name: '牛肉', kcal: 250 }, { name: '猪肉(瘦)', kcal: 143 },
    { name: '三文鱼', kcal: 208 }, { name: '虾', kcal: 99 }, { name: '豆腐', kcal: 76 }, { name: '牛奶', kcal: 54 },
    { name: '酸奶', kcal: 72 }, { name: '苹果', kcal: 52 }, { name: '香蕉', kcal: 93 }, { name: '橙子', kcal: 47 },
    { name: '西兰花', kcal: 34 }, { name: '番茄', kcal: 18 }, { name: '黄瓜', kcal: 16 }, { name: '菠菜', kcal: 23 },
    { name: '土豆', kcal: 77 }, { name: '胡萝卜', kcal: 41 }, { name: '沙拉(油醋)', kcal: 120 }, { name: '炸鸡', kcal: 297 },
    { name: '汉堡', kcal: 295 }, { name: '披萨', kcal: 266 }, { name: '奶茶(全糖)', kcal: 100 }, { name: '可乐', kcal: 43 },
    { name: '巧克力', kcal: 546 }, { name: '饼干', kcal: 435 }, { name: '坚果', kcal: 600 }, { name: '咖啡(黑)', kcal: 2 },
  ];
  // 运动 MET 值（每公斤体重每分钟消耗 ≈ MET*3.5/200 kcal）
  const EX_MET = [
    { name: '慢跑', met: 9.8, emoji: '🏃' }, { name: '跳绳', met: 11.0, emoji: '🤾' },
    { name: '游泳', met: 6.0, emoji: '🏊' }, { name: '骑行', met: 7.5, emoji: '🚴' },
    { name: '快走', met: 3.5, emoji: '🚶' }, { name: '瑜伽', met: 2.5, emoji: '🧘' },
  ];

  // 餐次与目标热量占比（默认每日总目标 1800 千卡）
  const DIET_MEALS = [
    { key: 'breakfast', label: '早餐', emoji: '🌅', pct: 0.25 },
    { key: 'lunch', label: '午餐', emoji: '☀️', pct: 0.40 },
    { key: 'dinner', label: '晚餐', emoji: '🌙', pct: 0.30 },
    { key: 'snack', label: '加餐', emoji: '🍎', pct: 0.05 },
  ];
  const DEFAULT_TARGET = 1800;

  // 三餐模板：快速规划每日饮食，降低决策成本
  const MEAL_TEMPLATES = [
    {
      key: 'balance', label: '🍱 均衡 1800', target: { breakfast: 450, lunch: 720, dinner: 540, snack: 90 },
      foods: {
        breakfast: [['燕麦', 50, 367], ['牛奶', 250, 54], ['苹果', 150, 52]],
        lunch: [['鸡胸肉', 150, 133], ['米饭', 200, 116], ['西兰花', 150, 34]],
        dinner: [['三文鱼', 120, 208], ['豆腐', 100, 76], ['番茄', 150, 18]],
        snack: [['坚果', 15, 600]],
      },
    },
    {
      key: 'cut', label: '🔥 减脂 1300', target: { breakfast: 325, lunch: 520, dinner: 390, snack: 65 },
      foods: {
        breakfast: [['全麦面包', 60, 246], ['鸡蛋', 50, 144], ['苹果', 150, 52]],
        lunch: [['鸡胸肉', 200, 133], ['红薯', 150, 90], ['西兰花', 200, 34]],
        dinner: [['虾', 150, 99], ['黄瓜', 200, 16], ['豆腐', 100, 76]],
        snack: [['酸奶', 100, 72]],
      },
    },
    {
      key: 'muscle', label: '💪 增肌 2200', target: { breakfast: 550, lunch: 880, dinner: 660, snack: 110 },
      foods: {
        breakfast: [['燕麦', 80, 367], ['鸡蛋', 100, 144], ['牛奶', 250, 54], ['香蕉', 120, 93]],
        lunch: [['牛肉', 200, 250], ['米饭', 300, 116], ['鸡蛋', 100, 144]],
        dinner: [['三文鱼', 200, 208], ['米饭', 200, 116], ['西兰花', 200, 34]],
        snack: [['坚果', 30, 600], ['牛奶', 250, 54]],
      },
    },
  ];

  function mealLabel(k) { const m = DIET_MEALS.find((x) => x.key === k); return m ? m.label : '午餐'; }
  function getMealTargets(rec, dayTarget) {
    const mt = (rec.diet && rec.diet.mealTargets) || {};
    const out = {};
    DIET_MEALS.forEach((m) => { out[m.key] = (mt[m.key] != null && mt[m.key] !== '') ? Number(mt[m.key]) : Math.round(dayTarget * m.pct); });
    return out;
  }

  function dietTotal(rec) {
    const entries = (rec.diet && rec.diet.entries) || [];
    return entries.reduce((s, e) => s + (e.total || 0), 0);
  }
  function dietByMeal(rec) {
    const m = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 };
    (rec.diet && rec.diet.entries || []).forEach((e) => { const k = e.meal || 'lunch'; m[k] = (m[k] || 0) + (e.total || 0); });
    return m;
  }
  function entryTotal(e) {
    return (e.items || []).reduce((s, it) => s + Math.round((Number(it.amount) || 0) / 100 * (Number(it.kcal) || 0)), 0);
  }
  function exMinutes(kcal, weight) {
    const w = (Number(weight) || 60);
    return EX_MET.map((x) => ({ ...x, min: Math.max(1, Math.round(kcal / (x.met * 3.5 * w / 200))) }));
  }

  async function visionKcal(dataUrl) {
    const r = await AI.vision('请识别图片中的食物，估算总热量(千卡)并逐项列出食物名称与大致分量。用中文简洁回答，格式：总热量约X千卡；1.食物名 约X千卡；2.…', dataUrl);
    return r;
  }

  async function loadDay(date) {
    let r = await DB.get('health', date);
    if (!r) r = { date, exercises: [], water: 0, sleep: { bed: '', wake: '', quality: 0 }, weight: '', mood: '', note: '', habits: {}, diet: { entries: [] } };
    if (!r.diet) r.diet = { entries: [] };
    return r;
  }

  async function saveDay(rec) { await DB.put('health', rec); }

  async function allRecords() { return DB.getAll('health'); }

  function drawLine(values, w, h, color) {
    const pts = values.map((v, i) => v == null ? null : [i, v]);
    const valid = pts.filter(Boolean);
    if (!valid.length) return `<svg width="${w}" height="${h}"></svg>`;
    const max = Math.max(...valid.map((p) => p[1]));
    const min = Math.min(...valid.map((p) => p[1]));
    const span = max - min || 1;
    const X = (i) => 8 + i * (w - 16) / (values.length - 1);
    const Y = (v) => h - 10 - ((v - min) / span) * (h - 24);
    const d = valid.map((p, k) => (k === 0 ? 'M' : 'L') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(' ');
    const dots = valid.map((p) => `<circle cx="${X(p[0]).toFixed(1)}" cy="${Y(p[1]).toFixed(1)}" r="3" fill="${color}"/>`).join('');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <path d="${d}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}</svg>`;
  }
  function drawBars(values, w, h, color) {
    const max = Math.max(1, ...values);
    const bw = (w - 16) / values.length;
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` + values.map((v, i) => {
      const bh = v ? (v / max) * (h - 18) : 2;
      return `<rect x="${8 + i * bw + 3}" y="${h - bh - 8}" width="${bw - 6}" height="${bh}" rx="4" fill="${color}" opacity="${v ? 1 : .25}"/>`;
    }).join('') + `</svg>`;
  }

  async function render(view) {
    const date = todayStr();
    const rec = await loadDay(date);
    const all = await allRecords();
    const map = {}; all.forEach((r) => map[r.date] = r);

    // 饮食目标与每餐拆分
    const settings = await DB.get('settings', 'main') || {};
    const dayTarget = (rec.diet && rec.diet.target) || settings.calorieTarget || DEFAULT_TARGET;
    const mealTargets = getMealTargets(rec, dayTarget);
    const effectiveTarget = DIET_MEALS.reduce((s, m) => s + (mealTargets[m.key] || 0), 0);
    const consumed = dietTotal(rec);
    const remaining = Math.max(0, effectiveTarget - consumed);
    const byMeal = dietByMeal(rec);

    // 统计
    let streak = 0;
    for (let i = 0; ; i++) {
      const d = dayOffset(i);
      if (map[d]) streak++; else if (i === 0) continue; else break;
    }
    const weekDays = []; for (let i = 6; i >= 0; i--) weekDays.push(dayOffset(i));
    const weekRecs = weekDays.map((d) => map[d]).filter(Boolean);
    const weekEx = weekRecs.reduce((s, r) => s + (r.exercises || []).reduce((a, e) => a + (Number(e.duration) || 0), 0), 0);
    const sleeps = weekRecs.map((r) => sleepHours(r.sleep && r.sleep.bed, r.sleep && r.sleep.wake)).filter(Boolean);
    const avgSleep = sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : '—';

    // 趋势数据
    const last14 = []; for (let i = 13; i >= 0; i--) last14.push(dayOffset(i));
    const weightVals = last14.map((d) => map[d] && map[d].weight ? Number(map[d].weight) : null);
    const sleepVals = last14.map((d) => { const r = map[d]; return r ? sleepHours(r.sleep && r.sleep.bed, r.sleep && r.sleep.wake) : null; });
    const exByDay = weekDays.map((d) => { const r = map[d]; return r ? r.exercises.reduce((a, e) => a + (Number(e.duration) || 0), 0) : 0; });

    const doneCats = [rec.exercises.length > 0, rec.water > 0, rec.sleep && rec.sleep.bed, rec.weight !== '' && rec.weight !== 0, rec.mood].filter(Boolean).length;

    view.innerHTML = `
      <div class="card">
        <div class="card-title">💪 健康打卡 · ${date.slice(5)}</div>
        <div class="plan-meta"><div class="row">
          <span class="pill">🔥 连续 <b>${streak}</b> 天</span>
          <span class="pill">本周运动 <b>${weekEx}</b> 分钟</span>
          <span class="pill">平均睡眠 <b>${avgSleep}</b> 小时</span>
          <span class="pill">今日完成 <b>${doneCats}/5</b></span>
        </div></div>
      </div>

      <div class="card">
        <div class="card-title">🏃 今日运动</div>
        <div class="add-row">
          <div class="field grow"><input type="text" id="exType" placeholder="类型，如 跑步/瑜伽" /></div>
          <div class="field"><input type="number" id="exDur" placeholder="分钟" style="width:90px;" /></div>
          <div class="field"><input type="number" id="exCal" placeholder="千卡" style="width:90px;" /></div>
          <button class="btn" id="exAdd">添加</button>
        </div>
        <div id="exList" style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
          ${rec.exercises.length ? rec.exercises.map((e, i) => `<div style="display:flex;gap:10px;padding:8px 12px;background:var(--cream);border-radius:12px;align-items:center;"><b>${escapeHtml(e.type || '运动')}</b><span class="muted">${e.duration}分 · ${e.calories || 0}千卡</span><button class="t-del" data-ex="${i}" style="margin-left:auto;">🗑</button></div>`).join('') : '<p class="muted">还没有运动记录</p>'}
        </div>
      </div>

      <div class="card">
        <div class="card-title">💧 喝水 & 😴 睡眠 & ⚖️ 体重</div>
        <div class="add-row" style="align-items:center;">
          <div class="field"><label>喝水（杯）</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="t-pomo"><button id="wMinus">−</button></span>
              <b style="font-size:20px;min-width:28px;text-align:center;" id="wVal">${rec.water}</b>
              <span class="t-pomo"><button id="wPlus">+</button></span>
            </div>
          </div>
          <div class="field"><label>体重 (kg)</label><input type="number" id="weight" value="${rec.weight}" step="0.1" style="width:110px;" /></div>
        </div>
        <div class="add-row" style="margin-top:8px;">
          <div class="field"><label>入睡时间</label><input type="time" id="bed" value="${rec.sleep.bed || ''}" /></div>
          <div class="field"><label>起床时间</label><input type="time" id="wake" value="${rec.sleep.wake || ''}" /></div>
          <div class="field" style="flex:1;"><label>睡眠质量</label>
            <div id="quality" style="display:flex;gap:4px;font-size:22px;">
              ${[1,2,3,4,5].map((q) => `<button data-q="${q}" style="font-size:22px;filter:${q <= (rec.sleep.quality||0) ? 'none':'grayscale(1)'};">⭐</button>`).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">😊 今日心情</div>
        <div class="mood-row" id="mood">
          ${MOODS.map((m) => `<button class="mood ${rec.mood === m ? 'on' : ''}" data-m="${m}">${m}</button>`).join('')}
        </div>
        <div class="field" style="margin-top:10px;"><textarea id="note" placeholder="今日健康小记…">${escapeHtml(rec.note || '')}</textarea></div>
      </div>

      <div class="card">
        <div class="card-title">✅ 习惯打卡（连续天数）</div>
        <div class="q-options" id="habits">
          ${HABITS.map((h) => {
            const hs = habitStreak(all, h.key);
            const on = rec.habits && rec.habits[h.key];
            return `<button class="q-chip ${on ? 'on' : ''}" data-h="${h.key}" style="${on ? '' : 'opacity:.7;'}">${h.emoji} ${h.label} · 🔥${hs}</button>`;
          }).join('')}
        </div>
      </div>

      <div class="card">
        <div class="card-title">🍱 今日饮食
          <div style="flex:1"></div>
          <button class="btn ghost" id="dietTpl" style="font-size:12px;padding:4px 10px;margin-right:8px;">🍽 推荐三餐</button>
          <span class="pill">总 <b>${consumed}</b> / 目标 <b>${effectiveTarget}</b></span>
          <span class="pill" style="${remaining === 0 ? 'background:#FFE0E0;color:#E23A6E;' : ''}">剩余 <b>${remaining}</b></span>
        </div>
        <div class="add-row" style="align-items:flex-end;margin-bottom:8px;">
          <div class="field"><label>每日目标热量·预设(千卡)</label><input type="number" id="dietTarget" value="${dayTarget}" style="width:130px;" /></div>
          <span class="muted" style="font-size:12px;">修改预设会按默认比例重置各餐目标</span>
        </div>
        <div id="mealTargets" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px;align-items:center;">
          ${DIET_MEALS.map((m) => {
            const got = byMeal[m.key] || 0; const tgt = mealTargets[m.key];
            const over = got > tgt * 1.15;
            return `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--cream);border-radius:999px;padding:4px 8px;font-size:13px;${over ? 'color:#E23A6E;' : ''}">
              ${m.emoji}<span class="muted" style="font-size:12px;${over ? 'color:#E23A6E;' : ''}">${m.label}</span>
              <b>${got}</b>/
              <input type="number" data-mealtarget="${m.key}" value="${tgt}" min="0" style="width:56px;font-size:13px;padding:2px 4px;border-radius:8px;border:1px solid var(--line);background:#fff;" />
            </span>`;
          }).join('')}
        </div>
        <div class="add-row" style="align-items:center;">
          <label class="btn ghost" for="dietPhoto" style="font-size:13px;padding:8px 14px;cursor:pointer;">📷 拍照/上传</label>
          <input type="file" id="dietPhoto" accept="image/*" capture="environment" style="display:none;" />
          <button class="btn ghost" id="dietAi" style="font-size:13px;padding:8px 14px;">🤖 AI 识别热量</button>
          <button class="btn ghost" id="dietVoice" style="font-size:13px;padding:8px 14px;">🎙 语音推荐</button>
        </div>
        <div id="dietPhotoBox" style="margin-top:8px;"></div>
        <div class="add-row" style="margin-top:8px;align-items:flex-end;">
          <div class="field"><label>餐次</label>
            <select id="dietMeal">${DIET_MEALS.map((m) => `<option value="${m.key}">${m.label}</option>`).join('')}</select>
          </div>
          <div class="field grow"><label>食物</label>
            <select id="dietFood">${DIET_FOODS.map((f) => `<option value="${f.name}" data-k="${f.kcal}">${f.name}（${f.kcal}/100g）</option>`).join('')}</select>
          </div>
          <div class="field"><label>分量(g)</label><input type="number" id="dietAmount" placeholder="如 150" style="width:100px;" /></div>
          <button class="btn" id="dietAddFood">添加</button>
        </div>
        <div id="dietEntries" style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
          ${(rec.diet.entries || []).map((e, i) => `
            <div style="display:flex;gap:10px;padding:8px 12px;background:var(--cream);border-radius:12px;align-items:center;">
              ${e.photo ? `<img src="${e.photo}" style="width:42px;height:42px;border-radius:8px;object-fit:cover;"/>` : ''}
              <div style="flex:1;min-width:0;">
                <div style="font-size:13px;font-weight:700;">${mealLabel(e.meal)} · ${e.items.map((it) => escapeHtml(it.name)).join('、') || '记录'}</div>
                <div class="muted" style="font-size:11px;">${e.items.map((it) => it.amount + 'g·' + Math.round(it.amount / 100 * it.kcal) + '千卡').join('；') || (e.note ? escapeHtml(e.note) : '')}</div>
              </div>
              <b style="color:var(--pink);">${e.total || 0}</b>
              <button class="t-del" data-diet="${i}" style="margin-left:6px;">🗑</button>
            </div>`).join('') || '<p class="muted">还没有饮食记录</p>'}
        </div>
        <div class="field" style="margin-top:10px;">
          <details id="exConv">
            <summary style="cursor:pointer;font-weight:700;color:var(--ink-soft);">🔥 换算成运动量（按今日体重 ${rec.weight ? rec.weight + 'kg' : '默认60kg'}）</summary>
            <div id="exConvBody" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
              ${exMinutes(dietTotal(rec), rec.weight).map((x) => `<span class="pill">${x.emoji} ${x.name} · <b>${x.min}</b> 分钟</span>`).join('')}
            </div>
          </details>
        </div>
        <div id="dietAiBox" style="margin-top:10px;"></div>
      </div>

      <div class="card">
        <div class="card-title">📈 趋势（近 14 天）</div>
        <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin-bottom:4px;">体重 (kg)</div>
        ${drawLine(weightVals, 600, 90, '#FF9EB5')}
        <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin:12px 0 4px;">睡眠时长 (小时)</div>
        ${drawLine(sleepVals, 600, 90, '#3B6FD4')}
        <div style="font-size:13px;font-weight:700;color:var(--ink-soft);margin:12px 0 4px;">本周每日运动 (分钟)</div>
        ${drawBars(exByDay, 600, 110, '#1F9D74')}
      </div>`;

    bind(view, rec);
  }

  function habitStreak(all, key) {
    let s = 0;
    for (let i = 0; ; i++) {
      const d = dayOffset(i);
      const r = all.find((x) => x.date === d);
      if (r && r.habits && r.habits[key]) s++; else if (i === 0) continue; else break;
    }
    return s;
  }

  function bind(view, rec) {
    const persist = () => saveDay(rec);
    view.querySelector('#exAdd').addEventListener('click', () => {
      const type = view.querySelector('#exType').value.trim() || '运动';
      const duration = Number(view.querySelector('#exDur').value) || 0;
      const calories = Number(view.querySelector('#exCal').value) || 0;
      if (!duration) { view.querySelector('#exDur').focus(); return; }
      rec.exercises.push({ type, duration, calories });
      persist().then(() => render(view));
    });
    view.querySelector('#exList').addEventListener('click', (e) => {
      const b = e.target.closest('[data-ex]'); if (!b) return;
      rec.exercises.splice(Number(b.dataset.ex), 1); persist().then(() => render(view));
    });
    view.querySelector('#wMinus').addEventListener('click', () => { rec.water = Math.max(0, rec.water - 1); persist().then(() => render(view)); });
    view.querySelector('#wPlus').addEventListener('click', () => { rec.water += 1; persist().then(() => render(view)); });
    view.querySelector('#weight').addEventListener('change', (e) => { rec.weight = e.target.value; persist(); });
    view.querySelector('#bed').addEventListener('change', (e) => { rec.sleep.bed = e.target.value; persist(); });
    view.querySelector('#wake').addEventListener('change', (e) => { rec.sleep.wake = e.target.value; persist(); });
    view.querySelector('#quality').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]'); if (!b) return; rec.sleep.quality = Number(b.dataset.q); persist().then(() => render(view));
    });
    view.querySelector('#mood').addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]'); if (!b) return; rec.mood = b.dataset.m; persist().then(() => render(view));
    });
    view.querySelector('#note').addEventListener('change', (e) => { rec.note = e.target.value; persist(); });
    view.querySelector('#habits').addEventListener('click', (e) => {
      const b = e.target.closest('[data-h]'); if (!b) return;
      const k = b.dataset.h; rec.habits = rec.habits || {}; rec.habits[k] = !rec.habits[k]; persist().then(() => render(view));
    });

    // —— 饮食 ——
    const showPending = () => {
      const box = view.querySelector('#dietPhotoBox');
      if (!box) return;
      if (rec.diet.pendingPhoto) {
        box.innerHTML = `<img src="${rec.diet.pendingPhoto}" style="max-width:120px;border-radius:12px;display:inline-block;vertical-align:middle;"/> <span class="muted" style="font-size:12px;">已选择照片，点「🤖 AI 识别热量」分析，或手动添加食物</span>`;
      } else box.innerHTML = '';
    };
    view.querySelector('#dietPhoto').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { rec.diet.pendingPhoto = rd.result; persist().then(() => { showPending(); window.toast('照片已就绪 📷'); }); };
      rd.readAsDataURL(f);
    });
    view.querySelector('#dietAddFood').addEventListener('click', () => {
      const name = view.querySelector('#dietFood').value;
      const kcal = Number(view.querySelector('#dietFood').selectedOptions[0].dataset.k) || 0;
      const amount = Number(view.querySelector('#dietAmount').value) || 0;
      const meal = view.querySelector('#dietMeal').value;
      if (!amount) { view.querySelector('#dietAmount').focus(); return; }
      const entry = { id: DB.uid('d'), meal, photo: rec.diet.pendingPhoto || '', items: [{ name, amount, kcal }], total: Math.round(amount / 100 * kcal), note: '' };
      rec.diet.entries.push(entry); rec.diet.pendingPhoto = '';
      persist().then(() => render(view));
    });
    const tInput = view.querySelector('#dietTarget');
    if (tInput) tInput.addEventListener('change', (e) => {
      const v = Math.max(0, Number(e.target.value) || DEFAULT_TARGET);
      rec.diet.target = v;
      rec.diet.mealTargets = {}; // 重置为按比例拆分（render 会重算）
      persist().then(() => render(view));
    });
    const mtBox = view.querySelector('#mealTargets');
    if (mtBox) mtBox.addEventListener('change', (e) => {
      const mt = e.target.closest('[data-mealtarget]'); if (!mt) return;
      rec.diet.mealTargets = rec.diet.mealTargets || {};
      rec.diet.mealTargets[mt.dataset.mealtarget] = Math.max(0, Number(mt.value) || 0);
      persist().then(() => render(view));
    });
    view.querySelector('#dietEntries').addEventListener('click', (e) => {
      const b = e.target.closest('[data-diet]'); if (!b) return;
      rec.diet.entries.splice(Number(b.dataset.diet), 1); persist().then(() => render(view));
    });
    view.querySelector('#dietAi').addEventListener('click', async () => {
      if (!rec.diet.pendingPhoto) { window.toast('请先上传食物照片 📷'); return; }
      const aiBox = view.querySelector('#dietAiBox');
      aiBox.innerHTML = '<p class="muted">🤖 正在识别…</p>';
      const r = await visionKcal(rec.diet.pendingPhoto);
      if (r.error === 'no_key') { aiBox.innerHTML = '<p style="color:#E23A6E;font-size:13px;">未配置 AI 视觉接口。请在「设置 ⚙️」填写支持视觉的 API Key（如 gpt-4o / 通义千问-VL）。也可手动添加食物并填写分量。</p>'; return; }
      if (r.error) { aiBox.innerHTML = '<p style="color:#E23A6E;font-size:13px;">识别失败：' + escapeHtml(r.error) + '</p>'; return; }
      aiBox.innerHTML = `
        <div style="background:var(--cream);border-radius:12px;padding:10px 12px;font-size:13px;">${escapeHtml(r.text)}</div>
        <div class="add-row" style="margin-top:8px;align-items:flex-end;">
          <div class="field"><label>本餐总热量(千卡)</label><input type="number" id="aiKcal" placeholder="按识别估算填" style="width:130px;"/></div>
          <button class="btn" id="aiSave">保存这条记录</button>
        </div>`;
      aiBox.querySelector('#aiSave').addEventListener('click', () => {
        const total = Number(aiBox.querySelector('#aiKcal').value) || 0;
        rec.diet.entries.push({ id: DB.uid('d'), meal: 'lunch', photo: rec.diet.pendingPhoto || '', items: [], total, note: r.text });
        rec.diet.pendingPhoto = ''; persist().then(() => render(view));
      });
    });
    view.querySelector('#dietVoice').addEventListener('click', () => startVoiceDiet(rec, view));

    // —— 三餐模板推荐 ——
    const tplBtn = view.querySelector('#dietTpl');
    if (tplBtn) tplBtn.addEventListener('click', () => {
      const cards = MEAL_TEMPLATES.map((t) => {
        const sum = DIET_MEALS.reduce((s, m) => s + (t.target[m.key] || 0), 0);
        return `<div class="tpl-card" data-tpl="${t.key}" style="padding:12px;border-radius:14px;background:var(--cream);border:1px solid var(--line);cursor:pointer;">
          <div style="font-weight:800;font-size:15px;">${t.label}</div>
          <div class="muted" style="font-size:12px;margin:4px 0 6px;">每日共约 ${sum} 千卡</div>
          ${DIET_MEALS.map((m) => {
            const fs = (t.foods[m.key] || []).map((f) => `${f[0]} ${f[1]}g`).join('、');
            return fs ? `<div style="font-size:12px;">${m.emoji} ${m.label}：${fs}</div>` : '';
          }).join('')}
        </div>`;
      }).join('');
      window.openModal(`<div class="modal-mask" id="tplMask"><div class="modal">
        <h3>🍽 推荐三餐</h3>
        <p class="muted" style="margin-top:0;">选一套模板，一键设置每餐目标并把建议食物加入今日饮食。目标可按需微调。</p>
        <div style="display:flex;flex-direction:column;gap:10px;">${cards}</div>
        <div class="modal-actions"><button class="btn" id="tplClose">取消</button></div>
      </div></div>`, (root) => {
        root.querySelector('#tplClose').addEventListener('click', window.closeModal);
        root.querySelector('#tplMask').addEventListener('click', (e) => { if (e.target.id === 'tplMask') window.closeModal(); });
        root.querySelectorAll('[data-tpl]').forEach((c) => c.addEventListener('click', () => {
          const t = MEAL_TEMPLATES.find((x) => x.key === c.dataset.tpl);
          rec.diet.target = DIET_MEALS.reduce((s, m) => s + (t.target[m.key] || 0), 0);
          rec.diet.mealTargets = Object.assign({}, t.target);
          DIET_MEALS.forEach((m) => {
            (t.foods[m.key] || []).forEach((f) => {
              const [name, amount, kcal] = f;
              rec.diet.entries.push({ id: DB.uid('d'), meal: m.key, photo: '', items: [{ name, amount, kcal }], total: Math.round(amount / 100 * kcal), note: '🍽 模板' });
            });
          });
          persist().then(() => { window.closeModal(); render(view); window.toast('已应用「' + t.label + '」✓'); });
        }));
      });
    });

    showPending();
  }

  async function startVoiceDiet(rec, view) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const box = view.querySelector('#dietAiBox');
    if (!SR) {
      box.innerHTML = '<p style="color:#E23A6E;font-size:13px;">当前浏览器不支持语音输入，请用 Chrome/Edge，或直接在「🍱 今日饮食」手动添加食物。</p>';
      return;
    }
    const consumed = dietTotal(rec);
    const target = (rec.diet && rec.diet.target) || 1800;
    const recog = new SR();
    recog.lang = 'zh-CN'; recog.interimResults = false; recog.maxAlternatives = 1;
    box.innerHTML = '<p class="muted">🎙 聆听中…（说完自动识别）</p>';
    recog.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      const prompt = `用户想吃什么：「${text}」。今日已摄入约 ${consumed} 千卡，每日目标约 ${target} 千卡。请推荐一顿低决策成本的餐食方案：具体到 2-3 种食物+分量(g)，并估算总热量，控制在剩余 ${Math.max(0, target - consumed)} 千卡以内。用中文、要点式、不超过120字。`;
      const r = await AI.call('你是贴心的饮食助手，帮用户快速决定吃什么，降低决策成本。', prompt);
      if (r.error === 'no_key') {
        const pick = DIET_FOODS.filter((f) => f.kcal < 120).slice(0, 3).map((f) => `${f.name}（约150g，${Math.round(150 / 100 * f.kcal)}千卡）`).join('、');
        box.innerHTML = `<p class="muted" style="font-size:13px;">你说：「${escapeHtml(text)}」<br/>未配置 AI，简单建议：${pick}。可在「设置 ⚙️」配置后获得个性化推荐。</p>`;
        return;
      }
      if (r.error) { box.innerHTML = '<p style="color:#E23A6E;font-size:13px;">推荐失败：' + escapeHtml(r.error) + '</p>'; return; }
      box.innerHTML = `<div style="background:var(--cream);border-radius:12px;padding:10px 12px;font-size:13px;"><b>你说：</b>${escapeHtml(text)}<br/><b>🤖 推荐：</b><br/>${escapeHtml(r.text).replace(/\n/g, '<br/>')}</div>`;
    };
    recog.onerror = () => { box.innerHTML = '<p style="color:#E23A6E;font-size:13px;">语音识别失败，请重试或手动输入。</p>'; };
    try { recog.start(); } catch (e) { box.innerHTML = '<p style="color:#E23A6e;font-size:13px;">无法启动麦克风，请检查浏览器权限。</p>'; }
  }

  window.Sections.health = { id: 'health', title: '健康打卡', emoji: '💪', render };
})();
