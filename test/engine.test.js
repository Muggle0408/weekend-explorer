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
