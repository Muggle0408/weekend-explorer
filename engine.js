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

  return { scoreActivity };
});
