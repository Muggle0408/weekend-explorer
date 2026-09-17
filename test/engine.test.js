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

/* ---------- 经纬度 → 地图坐标投影（方案 A：真实区划底图） ---------- */

test('projectToMap：bbox 四角映射（经向跨度修正后小于纬向）', () => {
  // 10°×10° bbox，中心纬度 25°：cos(25°)≈0.9063，东西向实际距离短于南北向 → x 满幅被压缩
  const bbox = [100, 20, 110, 30];
  assert.deepStrictEqual(ENGINE.projectToMap(100, 30, bbox), { x: 0, y: 0 });       // 左上
  assert.deepStrictEqual(ENGINE.projectToMap(100, 20, bbox), { x: 0, y: 100 });     // 左下
  assert.deepStrictEqual(ENGINE.projectToMap(110, 30, bbox), { x: 90.63, y: 0 });   // 右上
  assert.deepStrictEqual(ENGINE.projectToMap(110, 20, bbox), { x: 90.63, y: 100 }); // 右下
});

test('projectToMap：bbox 中心映射到坐标中心', () => {
  const bbox = [100, 20, 110, 30];
  const p = ENGINE.projectToMap(105, 25, bbox);
  assert.strictEqual(p.x, 45.32); // 50 * cos(25°)
  assert.strictEqual(p.y, 50);
});

test('projectToMap：cos(中心纬度) 纵横比修正生效', () => {
  // 同一 10°×10° 地理范围：不修正时角点应为 100，修正后随纬度升高而减小
  const low = ENGINE.projectToMap(110, 30, [100, 20, 110, 30]);   // 中心纬度 25°
  const high = ENGINE.projectToMap(110, 60, [100, 50, 110, 60]);  // 中心纬度 55°
  const expected = c => Math.round(100 * Math.cos(c * Math.PI / 180) * 100) / 100;
  assert.strictEqual(low.x, expected(25));
  assert.strictEqual(high.x, expected(55));
  assert.ok(high.x < low.x, '纬度越高 cos 修正越强，x 满幅应更小');
  assert.ok(low.x < 100 && high.x < 100, '修正后不应拉满 100');
});

test('projectToMap：东西跨度大于南北时压缩 y 方向', () => {
  // 20°×10°，中心纬度 25°：spanLng=20*cos(25°)≈18.13 > spanLat=10 → x 满幅，y 压缩
  const bbox = [110, 20, 130, 30];
  assert.deepStrictEqual(ENGINE.projectToMap(130, 30, bbox), { x: 100, y: 0 });
  const p = ENGINE.projectToMap(110, 20, bbox);
  assert.strictEqual(p.x, 0);
  assert.ok(p.y > 50 && p.y < 60, `y 应被压缩到约 55.17，实际 ${p.y}`);
});

test('projectToMap：越界经纬度 clamp 到 [0,100]', () => {
  const bbox = [100, 20, 110, 30];
  assert.deepStrictEqual(ENGINE.projectToMap(99, 31, bbox), { x: 0, y: 0 });
  assert.deepStrictEqual(ENGINE.projectToMap(112, 19, bbox), { x: 100, y: 100 });
});

/* ---------- 方案 A 数据校验：真实区划底图与活动坐标 ---------- */

test('CITY_MAPS：4 城 bbox 合法（min<max，在中国经纬度范围内）', () => {
  for (const city of DATA.CITIES) {
    const m = DATA.CITY_MAPS[city.id];
    assert.ok(m && Array.isArray(m.bbox), `${city.id} 缺少 bbox`);
    const [minLng, minLat, maxLng, maxLat] = m.bbox;
    assert.ok(minLng < maxLng && minLat < maxLat, `${city.id} bbox 顺序错误`);
    assert.ok(minLng >= 73 && maxLng <= 136, `${city.id} 经度超出中国范围`);
    assert.ok(minLat >= 3 && maxLat <= 54, `${city.id} 纬度超出中国范围`);
    assert.ok(Array.isArray(m.landmarks) && m.landmarks.length > 0, `${city.id} 缺少地标`);
  }
});

test('全部活动 lng/lat 落在所属城市 bbox 内', () => {
  for (const a of DATA.ACTIVITIES) {
    assert.ok(typeof a.lng === 'number' && typeof a.lat === 'number', `${a.id} 缺少 lng/lat`);
    const [minLng, minLat, maxLng, maxLat] = DATA.CITY_MAPS[a.city].bbox;
    assert.ok(a.lng >= minLng && a.lng <= maxLng, `${a.id} 经度 ${a.lng} 超出 ${a.city} bbox`);
    assert.ok(a.lat >= minLat && a.lat <= maxLat, `${a.id} 纬度 ${a.lat} 超出 ${a.city} bbox`);
  }
});

test('全部地标 lng/lat 落在所属城市 bbox 内', () => {
  for (const city of DATA.CITIES) {
    const { bbox, landmarks } = DATA.CITY_MAPS[city.id];
    for (const lm of landmarks) {
      assert.ok(lm.lng >= bbox[0] && lm.lng <= bbox[2], `${city.id} 地标 ${lm.name} 经度越界`);
      assert.ok(lm.lat >= bbox[1] && lm.lat <= bbox[3], `${city.id} 地标 ${lm.name} 纬度越界`);
    }
  }
});
