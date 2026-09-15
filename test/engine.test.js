/* 推荐引擎 scoreActivity 边界用例（node --test） */
const test = require('node:test');
const assert = require('node:assert');
const DATA = require('../data.js');
const ENGINE = require('../engine.js');

const base = { city: 'bj', weather: 'sunny', budget: 'mid', group: 'friends', cats: [] };
const byId = id => DATA.ACTIVITIES.find(a => a.id === id);

test('雨天不适配的户外活动天气维度低分', () => {
  const hike = byId('bj-06'); // 香山，仅晴天
  const r = ENGINE.scoreActivity(hike, { ...base, weather: 'rainy' });
  assert.strictEqual(r.dims.weather, 0.2);
});

test('天气适配时天气维度满分', () => {
  const art = byId('bj-01'); // 全天气适配
  const r = ENGINE.scoreActivity(art, { ...base, weather: 'rainy' });
  assert.strictEqual(r.dims.weather, 1);
  assert.ok(r.reason.includes('天气适配'));
});

test('预算同档满分 / 相邻档半分 / 跨两档极低分', () => {
  const mid = byId('bj-01');  // budget: mid
  assert.strictEqual(ENGINE.scoreActivity(mid, { ...base, budget: 'mid' }).dims.budget, 1);
  assert.strictEqual(ENGINE.scoreActivity(mid, { ...base, budget: 'low' }).dims.budget, 0.5);
  assert.strictEqual(ENGINE.scoreActivity(mid, { ...base, budget: 'high' }).dims.budget, 0.5);
  const high = byId('bj-03'); // budget: high
  assert.strictEqual(ENGINE.scoreActivity(high, { ...base, budget: 'low' }).dims.budget, 0.15);
});

test('未选兴趣走中性分，命中满分，未命中低分', () => {
  const art = byId('bj-01'); // cat: art
  assert.strictEqual(ENGINE.scoreActivity(art, { ...base, cats: [] }).dims.interest, 0.8);
  assert.strictEqual(ENGINE.scoreActivity(art, { ...base, cats: ['art'] }).dims.interest, 1);
  assert.strictEqual(ENGINE.scoreActivity(art, { ...base, cats: ['hike'] }).dims.interest, 0.25);
});

test('同行维度：包含满分，不包含低分', () => {
  const market = byId('bj-02'); // group: friends, family
  assert.strictEqual(ENGINE.scoreActivity(market, { ...base, group: 'friends' }).dims.group, 1);
  assert.strictEqual(ENGINE.scoreActivity(market, { ...base, group: 'couple' }).dims.group, 0.3);
});

test('全部活动的匹配分落在 42-99 区间', () => {
  for (const a of DATA.ACTIVITIES) {
    const r = ENGINE.scoreActivity(a, base);
    assert.ok(r.score >= 42 && r.score <= 99, `${a.id} 分数越界: ${r.score}`);
  }
});

test('同城活动推荐理由包含「同城」', () => {
  const r = ENGINE.scoreActivity(byId('bj-01'), base);
  assert.ok(r.reason.includes('同城'));
});

/* ---------- 周期性活动 ---------- */

test('nextRecurDate：当天即举办日则返回当天', () => {
  const sun = new Date(2026, 0, 4); // 2026-01-04 周日
  assert.strictEqual(sun.getDay(), 0);
  const d = ENGINE.nextRecurDate(0, sun);
  assert.strictEqual(d.getDate(), 4);
  assert.strictEqual(d.getDay(), 0);
});

test('nextRecurDate：返回未来最近的举办日', () => {
  const sun = new Date(2026, 0, 4); // 周日
  const sat = ENGINE.nextRecurDate(6, sun);
  assert.strictEqual(sat.getDay(), 6);
  assert.strictEqual(sat.getDate(), 10); // 2026-01-10 周六
});

test('recurLabel：今天 / 明天 / 本周 / 下周', () => {
  const sun = new Date(2026, 0, 4); // 周日
  assert.strictEqual(ENGINE.recurLabel({ day: 0 }, sun), '今天 1/4 有场');
  assert.strictEqual(ENGINE.recurLabel({ day: 1 }, sun), '明天 1/5 有场');
  assert.strictEqual(ENGINE.recurLabel({ day: 6 }, sun), '本周六 1/10 有场');
  const fri = new Date(2026, 0, 9); // 周五
  assert.strictEqual(ENGINE.recurLabel({ day: 1 }, fri), '下周一 1/12 有场');
});

test('带 recur 字段的活动数据合法（day 为 0-6）', () => {
  for (const a of DATA.ACTIVITIES.filter(a => a.recur)) {
    assert.ok(Number.isInteger(a.recur.day) && a.recur.day >= 0 && a.recur.day <= 6, a.id);
  }
});

/* ---------- 自然语言搜索 ---------- */

test('parseQuery：多维关键词同时解析', () => {
  const r = ENGINE.parseQuery('北京 下雨天 免费 想安静看展');
  assert.strictEqual(r.patch.city, 'bj');
  assert.strictEqual(r.patch.weather, 'rainy');
  assert.strictEqual(r.patch.budget, 'low');
  assert.ok(r.cats.includes('art'));
  assert.ok(r.cats.includes('cafe')); // 安静 → 展览+咖啡
  assert.ok(r.hits.length >= 4);
});

test('parseQuery：情侣 + 拍照 + 人均金额', () => {
  const r = ENGINE.parseQuery('和对象去拍照，人均50元以内');
  assert.strictEqual(r.patch.group, 'couple');
  assert.strictEqual(r.patch.budget, 'low'); // 显式金额优先
  assert.ok(r.cats.includes('walk'));
});

test('parseQuery：人均金额分档', () => {
  assert.strictEqual(ENGINE.parseQuery('人均80元').patch.budget, 'mid');
  assert.strictEqual(ENGINE.parseQuery('人均200元').patch.budget, 'high');
});

test('parseQuery：空输入与无命中输入', () => {
  assert.strictEqual(ENGINE.parseQuery('').hits.length, 0);
  assert.strictEqual(ENGINE.parseQuery('随便看看').hits.length, 0);
});

test('parseQuery：大小写不敏感（citywalk / solo）', () => {
  const r = ENGINE.parseQuery('周末 CityWalk 一个人');
  assert.strictEqual(r.patch.group, 'solo');
  assert.ok(r.cats.includes('walk'));
});

/* ---------- 行程时段编排 ---------- */

test('suggestSlot：按活动特征建议时段', () => {
  assert.strictEqual(ENGINE.suggestSlot(byId('bj-06')), 'am');  // 徒步 → 上午
  assert.strictEqual(ENGINE.suggestSlot(byId('bj-04')), 'am');  // CityWalk → 上午
  assert.strictEqual(ENGINE.suggestSlot(byId('sz-04')), 'eve'); // 夜晚标签 → 晚上
  assert.strictEqual(ENGINE.suggestSlot(byId('bj-03')), 'eve'); // 演出 → 晚上
  assert.strictEqual(ENGINE.suggestSlot(byId('bj-01')), 'pm');  // 展览 → 下午
});

test('agendaFlat：按 上午→下午→晚上 排序，时段内保持加入顺序', () => {
  const myList = ['sz-04', 'bj-01', 'bj-06']; // eve, pm, am（乱序加入）
  const flat = ENGINE.agendaFlat(myList, {}, DATA.ACTIVITIES);
  assert.deepStrictEqual(flat.map(a => a.id), ['bj-06', 'bj-01', 'sz-04']);
  assert.deepStrictEqual(flat.map(a => a.slot), ['am', 'pm', 'eve']);
});

test('agendaFlat：用户手动调整时段优先于建议', () => {
  const myList = ['bj-06', 'bj-01'];
  const flat = ENGINE.agendaFlat(myList, { 'bj-06': 'eve' }, DATA.ACTIVITIES);
  assert.deepStrictEqual(flat.map(a => a.id), ['bj-01', 'bj-06']);
  assert.strictEqual(flat[1].slot, 'eve');
});

test('agendaGroups：忽略无效活动与非法时段', () => {
  const g = ENGINE.agendaGroups(['bj-01', 'not-exist'], { 'bj-01': 'bad' }, DATA.ACTIVITIES);
  assert.strictEqual(g.am.length + g.pm.length + g.eve.length, 1);
  assert.strictEqual(g.pm[0].id, 'bj-01'); // 非法时段回退到建议时段
});

/* ---------- iCal 日历导出 ---------- */

test('nextSaturday：返回最近的周六（当天周六则返回当天）', () => {
  const sun = new Date(2026, 0, 4); // 周日
  const sat = ENGINE.nextSaturday(sun);
  assert.strictEqual(sat.getDay(), 6);
  assert.strictEqual(sat.getDate(), 10);
  const same = ENGINE.nextSaturday(new Date(2026, 0, 10)); // 周六
  assert.strictEqual(same.getDate(), 10);
});

test('buildICS：生成合法 VCALENDAR 结构', () => {
  const day = new Date(2026, 0, 10); // 周六
  const items = [
    { id: 'bj-06', title: '香山徒步', place: '香山公园', price: 10, duration: '半天', slot: 'am' },
    { id: 'sz-04', title: '即兴喜剧夜', place: '万象天地剧场', price: 180, duration: '1.5h', slot: 'eve' },
  ];
  const ics = ENGINE.buildICS(items, day);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.strictEqual((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART:20260110T090000'));  // 上午 09:00
  assert.ok(ics.includes('DTSTART:20260110T190000'));  // 晚上 19:00
  assert.ok(ics.includes('SUMMARY:香山徒步'));
  assert.ok(ics.includes('LOCATION:香山公园'));
  assert.ok(ics.includes('\r\n')); // RFC 5545 要求 CRLF
});

test('buildICS：同时段多个活动顺延不重叠', () => {
  const day = new Date(2026, 0, 10);
  const items = [
    { id: 'a1', title: '活动一', place: '', price: 0, duration: '', slot: 'pm' },
    { id: 'a2', title: '活动二', place: '', price: 0, duration: '', slot: 'pm' },
  ];
  const ics = ENGINE.buildICS(items, day);
  assert.ok(ics.includes('DTSTART:20260110T140000')); // 第一个 14:00
  assert.ok(ics.includes('DTSTART:20260110T170000')); // 第二个 14:00+150min+30min = 17:00
});

test('buildICS：特殊字符按 RFC 5545 转义', () => {
  const ics = ENGINE.buildICS([{ id: 'x', title: '爬山, 看海; 日落', place: '', price: 0, duration: '', slot: 'am' }], new Date(2026, 0, 10));
  assert.ok(ics.includes('SUMMARY:爬山\\, 看海\\; 日落'));
});
