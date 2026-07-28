/* 占位板块：Phase 1 暂未实现，先展示规划要点，后续迭代 */
(function () {
  'use strict';
  window.Sections = window.Sections || {};

  const PLACEHOLDERS = {
    health: {
      title: '健康打卡', emoji: '💪',
      desc: '运动、饮食、睡眠、体重与习惯的每日打卡，配合趋势曲线与连续打卡天数。',
      tags: ['运动记录', '饮食打卡', '睡眠监测', '体重曲线', '习惯连续天数'],
    },
    english: {
      title: '英语学习', emoji: '📖',
      desc: '内置四六级词库，艾宾浩斯遗忘曲线复习，听力 / 口语 / 阅读练习与成就徽章。',
      tags: ['CET-4/6 词库', '艾宾浩斯复习', '听力训练', '成就徽章'],
    },
    sidehustle: {
      title: '副业赚米', emoji: '💰',
      desc: '副业项目、收入支出、客户与合同附件管理，自动周 / 月 / 年度利润分析与待收款提醒。',
      tags: ['项目管理', '收支记账', '利润分析', '待收款提醒'],
    },
    inspiration: {
      title: '爆款灵感', emoji: '💡',
      desc: '快速捕获创意灵感，标签分类、素材库与状态流转，可一键转为任务。',
      tags: ['灵感捕获', '标签分类', '素材库', '转任务'],
    },
    review: {
      title: '每日复盘', emoji: '🌙',
      desc: 'KPT / 3R / 时间轴复盘模板，情绪能量记录与明日计划，AI 辅助生成复盘草稿。',
      tags: ['复盘模板', '情绪能量', '明日计划', 'AI 草稿'],
    },
    podcast: {
      title: '我的播客', emoji: '🎧',
      desc: '连接小宇宙，订阅节目、在线播放、断点续播与时间戳笔记，支持 RSS / OPML 导入。',
      tags: ['小宇宙连接', '在线播放', '时间戳笔记', 'OPML 导入'],
    },
  };

  Object.keys(PLACEHOLDERS).forEach((id) => {
    const p = PLACEHOLDERS[id];
    window.Sections[id] = {
      id, title: p.title, emoji: p.emoji,
      render(view) {
        view.innerHTML = `
          <div class="card placeholder">
            <div class="ph-emoji">${p.emoji}</div>
            <h2>${p.title}</h2>
            <p>${p.desc}</p>
            <div class="ph-tags">${p.tags.map((t) => `<span>${t}</span>`).join('')}</div>
            <p style="margin-top:18px;font-size:12px;">🚧 该板块将在后续开发阶段上线，敬请期待～</p>
          </div>`;
      },
    };
  });
})();
