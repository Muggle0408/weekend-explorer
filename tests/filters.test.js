/* 筛选 chips 交互回归测试（node:test + 轻量 DOM 桩，无第三方依赖）
 * 运行：node --test tests/
 *
 * 覆盖两个历史 bug：
 * 1. chips 逐个绑定事件，renderAll 重绘后第二次点击起全部失效 → 已改为事件委托
 * 2. localStorage/URL 残留非法状态值导致渲染中断、事件未绑定 → 已加 validateState
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

function makeEl(id){
  return {
    id, innerHTML: '', textContent: '', value: '', hidden: false,
    style: {}, dataset: {}, _h: {},
    classList: { add(){}, remove(){}, contains(){ return false; } },
    addEventListener(ev, fn){ (this._h[ev] = this._h[ev] || []).push(fn); },
    dispatch(ev, event){ (this._h[ev] || []).forEach(fn => fn(event)); },
    querySelectorAll(){ return []; },
    closest(){ return null; },
    scrollIntoView(){}, select(){},
  };
}

/* 启动应用：加载 data.js + app.js，触发 DOMContentLoaded */
function boot(storage){
  const els = {};
  const listeners = {};
  global.document = {
    getElementById(id){ return els[id] || (els[id] = makeEl(id)); },
    querySelectorAll(){ return []; },
    addEventListener(ev, fn){ (listeners[ev] = listeners[ev] || []).push(fn); },
  };
  global.location = { search: '', pathname: '/index.html', origin: 'http://localhost', href: '' };
  global.history = { replaceState(){} };
  global.localStorage = {
    _s: storage ? { ww_state_v1: JSON.stringify(storage) } : {},
    getItem(k){ return this._s[k] || null; },
    setItem(k, v){ this._s[k] = v; },
  };
  global.window = {};
  eval(fs.readFileSync(path.join(__dirname, '..', 'data.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'engine.js'), 'utf8'));
  eval(fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8'));
  (listeners['DOMContentLoaded'] || []).forEach(fn => fn());
  return els;
}

/* 模拟点击一个 chip */
function clickChip(els, key, id, multi){
  const chip = { dataset: { key, id, multi: multi ? 'true' : 'false' } };
  els['filters'].dispatch('click', {
    target: { closest: sel => (sel === '.chip' ? chip : null) },
  });
}

function activeIds(html){
  return [...html.matchAll(/class="chip active[^"]*" data-key="[^"]+" data-id="([^"]+)"/g)].map(m => m[1]);
}

test('首屏默认预选渲染（即开即玩）', () => {
  const els = boot();
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['bj']);
  assert.deepStrictEqual(activeIds(els['weatherChips'].innerHTML), ['sunny']);
  assert.ok(Number(els['resultCount'].textContent) > 0, '首屏应有推荐结果');
});

test('chips 连续点击可持续切换（事件委托回归）', () => {
  const els = boot();
  clickChip(els, 'city', 'sh');
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['sh']);
  /* 第二次点击发生在 renderAll 重绘之后，旧实现此处会失效 */
  clickChip(els, 'weather', 'rainy');
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['sh'], '重绘后城市选择应保持');
  assert.deepStrictEqual(activeIds(els['weatherChips'].innerHTML), ['rainy'], '第二次点击应生效');
  clickChip(els, 'city', 'gz');
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['gz'], '第三次点击仍应生效');
});

test('兴趣多选：点击选中、再点取消', () => {
  const els = boot();
  clickChip(els, 'cats', 'art', true);
  assert.deepStrictEqual(activeIds(els['catChips'].innerHTML), ['art']);
  clickChip(els, 'cats', 'market', true);
  assert.deepStrictEqual(activeIds(els['catChips'].innerHTML), ['art', 'market']);
  clickChip(els, 'cats', 'art', true);
  assert.deepStrictEqual(activeIds(els['catChips'].innerHTML), ['market']);
});

test('非法 localStorage 状态被校验回退，不阻塞事件绑定', () => {
  const els = boot({
    city: 'xx', weather: 'bad', budget: 'nope', group: 'nobody',
    cats: ['art', 'ghost'], myList: ['bj-01', 'fake'], checkin: { fake: true },
  });
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['bj'], '非法城市应回退北京');
  assert.deepStrictEqual(activeIds(els['weatherChips'].innerHTML), ['sunny'], '非法天气应回退晴天');
  assert.deepStrictEqual(activeIds(els['catChips'].innerHTML), ['art'], '非法兴趣应被过滤');
  assert.strictEqual(els['myCount'].textContent, '1 项', '非法行程项应被过滤');
  /* 校验后交互仍然可用 */
  clickChip(els, 'city', 'sz');
  assert.deepStrictEqual(activeIds(els['cityChips'].innerHTML), ['sz']);
});

test('切雨天 → 室内方案排在户外之前（天气改案）', () => {
  const els = boot();
  clickChip(els, 'weather', 'rainy');
  const cards = els['cards'].innerHTML;
  const indoorIdx = cards.indexOf('数字印象当代艺术展'); // 全天气适配
  const outdoorIdx = cards.indexOf('香山 · 短途徒步登顶'); // 仅晴天
  assert.ok(indoorIdx !== -1 && outdoorIdx !== -1, '两张卡都应在结果中');
  assert.ok(indoorIdx < outdoorIdx, '雨天时室内展应排在纯晴天徒步之前');
});
