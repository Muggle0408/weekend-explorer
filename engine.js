/* ============================================================
 * 周末漫游指南 · WanderWeekend
 * 推荐引擎与纯函数逻辑（可脱离 DOM 在 Node 环境独立测试）
 * 浏览器：挂载 window.WW_ENGINE；Node：module.exports
 * ============================================================ */
(function(root, factory){
  const DATA = typeof window !== 'undefined' ? window.WW_DATA : require('./data.js');
  const api = factory(DATA);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.WW_ENGINE = api;
})(typeof window !== 'undefined' ? window : null, function(DATA){

  /* ---------- 推荐打分（四维独立打分，透明可解释） ---------- */
  /* cond: { weather, budget, group, cats[] } */
  function scoreActivity(a, cond){
    /* 天气维度：适配=100，雨天不适配户外=20，其余=55 */
    const wOk = a.weather.includes(cond.weather);
    const wDim = wOk ? 1 : (cond.weather === 'rainy' ? .2 : .55);
    /* 预算维度：同档=100，相邻档=50，跨两档=15 */
    const bOrder = ['low','mid','high'];
    const bDist = Math.abs(bOrder.indexOf(a.budget) - bOrder.indexOf(cond.budget));
    const bDim = bDist === 0 ? 1 : (bDist === 1 ? .5 : .15);
    /* 同行维度：包含=100，不包含=30 */
    const gDim = a.group.includes(cond.group) ? 1 : .3;
    /* 兴趣维度：未选兴趣=80（中性），命中=100，未命中=25 */
    const iDim = cond.cats.length === 0 ? .8 : (cond.cats.includes(a.cat) ? 1 : .25);

    const dims = { weather: wDim, budget: bDim, group: gDim, interest: iDim };
    const reason = [];
    if(wDim === 1) reason.push('天气适配');
    if(bDim === 1) reason.push('预算匹配');
    if(gDim === 1) reason.push('适合' + (DATA.GROUP_TYPES.find(g=>g.id===cond.group)?.name || '同行'));
    if(iDim === 1 && cond.cats.length) reason.push('兴趣命中');
    if(a.city === cond.city) reason.push('同城');

    const base = (wDim*.28 + bDim*.20 + gDim*.18 + iDim*.14 + .30);  /* 同城占 30 */
    const hotBonus = Math.min(4, (a.hot - 60) * 0.1);
    const score = Math.max(42, Math.min(99, Math.round(48 + base*47 + hotBonus)));
    return { score, reason, dims };
  }

  /* ---------- 周期性活动：计算下一次举办日期（借鉴 eventschedule 的 recurring events） ---------- */
  const WEEK_NAMES = ['日','一','二','三','四','五','六'];

  /* recur.day: 0=周日 … 6=周六；返回下一次举办的日期（含当天），时间为 00:00 */
  function nextRecurDate(day, from){
    const d = from ? new Date(from.getTime()) : new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + (day - d.getDay() + 7) % 7);
    return d;
  }

  /* 生成「本周日 6/8 有场」式徽标文案 */
  function recurLabel(recur, from){
    const base = from ? new Date(from.getTime()) : new Date();
    base.setHours(0,0,0,0);
    const d = nextRecurDate(recur.day, base);
    const diff = Math.round((d - base) / 86400000);
    const md = `${d.getMonth()+1}/${d.getDate()}`;
    if(diff === 0) return `今天 ${md} 有场`;
    if(diff === 1) return `明天 ${md} 有场`;
    const sameWeek = diff <= (6 - base.getDay());
    return `${sameWeek ? '本周' : '下周'}${WEEK_NAMES[recur.day]} ${md} 有场`;
  }

  /* ---------- 自然语言搜索：关键词 → 结构化筛选条件（规则版，正式版接 LLM 语义解析） ---------- */
  /* 返回 { patch: {city?, weather?, budget?, group?}, cats: [], hits: [命中标签] } */
  function parseQuery(text){
    const t = String(text || '').toLowerCase();
    const patch = {}; const cats = []; const hits = [];
    for (const rule of DATA.NL_RULES){
      if (rule.keys.some(k => t.includes(k.toLowerCase()))){
        hits.push(rule.label);
        if (rule.patch) Object.assign(patch, rule.patch);
        if (rule.cat) for (const c of [].concat(rule.cat)){
          if (!cats.includes(c)) cats.push(c);
        }
      }
    }
    /* 人均金额：显式数字优先于关键词，如「人均50元」 */
    const m = t.match(/(\d{2,3})\s*(?:元|块)/);
    if (m){
      const amount = parseInt(m[1], 10);
      patch.budget = amount <= 50 ? 'low' : amount <= 150 ? 'mid' : 'high';
      hits.push(`💰 人均${amount}元`);
    }
    return { patch, cats, hits };
  }

  /* ---------- 行程时段编排（借鉴 eventschedule 的 Event Agenda：把行程拆成带时段的段落） ---------- */
  const SLOT_ORDER = ['am', 'pm', 'eve'];
  const SLOT_META = {
    am:  { name: '上午', emoji: '🌅' },
    pm:  { name: '下午', emoji: '🌞' },
    eve: { name: '晚上', emoji: '🌙' },
  };

  /* 按活动特征建议时段：夜间标签/演出→晚上，徒步/CityWalk→上午，其余→下午 */
  function suggestSlot(a){
    if (a.tags.some(t => t.includes('夜'))) return 'eve';
    if (a.cat === 'hike' || a.cat === 'walk') return 'am';
    if (a.cat === 'show') return 'eve';
    return 'pm';
  }

  /* 把行程按时段分组（各时段内保持加入顺序），返回 {am:[], pm:[], eve:[]} */
  function agendaGroups(myList, slots, activities){
    const groups = { am: [], pm: [], eve: [] };
    for (const id of myList){
      const a = activities.find(x => x.id === id);
      if (!a) continue;
      const s = SLOT_ORDER.includes(slots[id]) ? slots[id] : suggestSlot(a);
      groups[s].push(a);
    }
    return groups;
  }

  /* 展平为带时段字段的有序列表（地图序号 / 打卡 / 海报共用同一顺序） */
  function agendaFlat(myList, slots, activities){
    const g = agendaGroups(myList, slots, activities);
    return SLOT_ORDER.flatMap(s => g[s].map(a => ({ ...a, slot: s })));
  }

  /* ---------- iCal 日历导出（借鉴 eventschedule 的 .ics 下载） ---------- */
  /* 返回最近的周六（当天是周六则返回当天），时间为 00:00 */
  function nextSaturday(from){
    const d = from ? new Date(from.getTime()) : new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + (6 - d.getDay() + 7) % 7);
    return d;
  }

  /* items: agendaFlat 输出（含 slot 字段）；day: 行程日期；返回 RFC 5545 文本 */
  function buildICS(items, day){
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    const esc = s => String(s).replace(/\\/g,'\\\\').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r?\n/g,'\\n');
    const slotStart = { am: 9*60, pm: 14*60, eve: 19*60 };  /* 各时段基准开始时间 */
    const cursor = { ...slotStart };
    const at = min => { const d = new Date(day); d.setHours(Math.floor(min/60), min%60, 0, 0); return d; };
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WanderWeekend//Weekend Explorer//CN', 'CALSCALE:GREGORIAN'];
    items.forEach((a, i) => {
      const start = cursor[a.slot] ?? slotStart.pm;
      const end = start + 150;  /* 每项默认 2.5h，同时段内顺延半小时 */
      lines.push(
        'BEGIN:VEVENT',
        `UID:${a.id || i}@wanderweekend`,
        `DTSTAMP:${fmt(new Date())}`,
        `DTSTART:${fmt(at(start))}`,
        `DTEND:${fmt(at(end))}`,
        `SUMMARY:${esc(a.title)}`,
        `LOCATION:${esc(a.place || '')}`,
        `DESCRIPTION:${esc(`人均 ¥${a.price} · ${a.duration || ''} · 周末漫游指南`)}`,
        'END:VEVENT'
      );
      cursor[a.slot] = end + 30;
    });
    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  return { scoreActivity, nextRecurDate, recurLabel, parseQuery,
           SLOT_ORDER, SLOT_META, suggestSlot, agendaGroups, agendaFlat,
           nextSaturday, buildICS };
});
