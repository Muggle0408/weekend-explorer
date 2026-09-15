/* ============================================================
 * 周末漫游指南 · WanderWeekend
 * 核心逻辑：状态管理 / 渲染 / 推荐 / 组队 / 打卡 / 分享
 * ============================================================ */

const WW = (() => {
  const { CITIES, WEATHERS, CATEGORIES, BUDGETS, GROUP_TYPES,
          ACTIVITIES, GROUP_HINTS, WEATHER_TIPS, BUDGET_TIPS,
          MAP_POS, CITY_MAPS, CONCEPTS } = window.WW_DATA;
  const ENGINE = window.WW_ENGINE;

  /* ---------- 状态（默认 + URL 同步） ---------- */
  const state = {
    city: 'bj',
    weather: 'sunny',
    budget: 'mid',
    group: 'friends',
    cats: [],          // 多选兴趣
    sort: 'match',
    myList: [],        // 已选活动 id
    team: null,        // {code, members[]}
    checkin: {},       // {actId: true}
  };

  const LS_KEY = 'ww_state_v1';

  function saveState(){
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch(e){}
  }
  function loadState(){
    try {
      const raw = localStorage.getItem(LS_KEY);
      if(raw) Object.assign(state, JSON.parse(raw));
    } catch(e){}
  }
  function loadFromURL(){
    const p = new URLSearchParams(location.search);
    if(p.has('city'))    state.city    = p.get('city');
    if(p.has('weather')) state.weather = p.get('weather');
    if(p.has('budget'))  state.budget  = p.get('budget');
    if(p.has('group'))   state.group   = p.get('group');
    if(p.has('cats'))    state.cats    = p.get('cats').split(',').filter(Boolean);
    if(p.has('team'))    joinTeamByCode(p.get('team'));
    if(p.has('join'))    joinTeamByCode(p.get('join'));
  }

  /* 状态校验：localStorage / URL 残留非法值时回退默认，防止渲染中断导致事件未绑定 */
  function validateState(){
    if(!CITIES.some(c => c.id === state.city))       state.city = 'bj';
    if(!WEATHERS.some(w => w.id === state.weather))  state.weather = 'sunny';
    if(!BUDGETS.some(b => b.id === state.budget))    state.budget = 'mid';
    if(!GROUP_TYPES.some(g => g.id === state.group)) state.group = 'friends';
    state.cats = (state.cats || []).filter(id => CATEGORIES.some(c => c.id === id));
    state.myList = (state.myList || []).filter(id => ACTIVITIES.some(a => a.id === id));
    if(!state.checkin || typeof state.checkin !== 'object') state.checkin = {};
    Object.keys(state.checkin).forEach(id => { if(!state.myList.includes(id)) delete state.checkin[id]; });
    if(typeof state.shuffle !== 'number') state.shuffle = 0;
  }

  /* ---------- 推荐算法（核心打分在 engine.js，可独立测试） ---------- */
  function match(a){
    return ENGINE.scoreActivity(a, state);
  }

  function recommend(){
    let list = ACTIVITIES
      .filter(a => a.city === state.city)
      .map(a => ({...a, ...match(a)}));
    // 天气硬过滤：雨天天不强制，但给低分；这里我们不强制剔除，给用户选择
    list.sort((a,b) => b.score - a.score);
    if(state.sort === 'price') list.sort((a,b) => a.price - b.price);
    if(state.sort === 'hot')   list.sort((a,b) => b.hot - a.hot);
    /* 换一批：确定性轮转，保证每次点击结果不同 */
    if(state.shuffle > 0){
      const n = list.length;
      if(n > 1){
        const off = state.shuffle % n;
        list = list.slice(off).concat(list.slice(0, off));
      }
    }
    return list;
  }

  function shuffleCards(){
    state.shuffle = (state.shuffle || 0) + 1;
    renderCards();
    flashTip('已换一批，继续挑 👀');
  }

  /* ---------- 自然语言搜索（规则解析版，复用推荐引擎） ---------- */
  function escHtml(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function applyNL(){
    const input = document.getElementById('nlInput');
    const q = input.value.trim();
    if(!q) return;
    const { patch, cats, hits } = ENGINE.parseQuery(q);
    const hitsEl = document.getElementById('nlHits');
    hitsEl.hidden = false;
    if(hits.length === 0){
      hitsEl.innerHTML = `🤔 没太听懂「${escHtml(q)}」，试试这些关键词：城市名 / 下雨 / 免费 / 情侣 / 展览 / 徒步 / 拍照 / 人均50元`;
      return;
    }
    Object.assign(state, patch);
    if(cats.length) state.cats = cats;
    state.shuffle = 0;
    saveState(); updateURL(); renderAll();
    hitsEl.innerHTML = `✨ 已解析：<strong>${hits.join(' · ')}</strong>，筛选条件已自动应用 👇`;
    document.getElementById('cards').scrollIntoView({ behavior:'smooth', block:'start' });
  }

  /* ---------- 渲染：Hero 标签 ---------- */
  function renderHeroTags(){
    const tags = ['🏯 4 城 22 活动', '🌤️ 天气感知', '💰 预算分级', '👯 多人组队', '🎯 打卡海报', '📤 一键分享'];
    document.getElementById('heroTags').innerHTML = tags.map(t => `<span>${t}</span>`).join('');
  }

  /* ---------- 渲染：筛选 chips ---------- */
  function renderChips(){
    const map = [
      ['cityChips',    CITIES,    'city',    false, ''],
      ['weatherChips', WEATHERS,  'weather', false, 'cyan'],
      ['budgetChips',  BUDGETS,   'budget',  false, 'green'],
      ['groupChips',   GROUP_TYPES,'group',  false, 'violet'],
      ['catChips',     CATEGORIES,'cats',    true,  ''],
    ];
    map.forEach(([id, list, key, multi, color]) => {
      const el = document.getElementById(id);
      const selected = multi ? state[key] : [state[key]];
      el.innerHTML = list.map(item => {
        const active = selected.includes(item.id);
        const cls = active ? `chip active${color?' '+color:''}` : 'chip';
        return `<button type="button" class="${cls}" data-key="${key}" data-id="${item.id}" data-multi="${multi}">${item.emoji} ${item.name}</button>`;
      }).join('');
    });
    renderFilterSummary();
  }

  function renderFilterSummary(){
    const city    = CITIES.find(c => c.id === state.city);
    const weather = WEATHERS.find(w => w.id === state.weather);
    const budget  = BUDGETS.find(b => b.id === state.budget);
    const group   = GROUP_TYPES.find(g => g.id === state.group);
    const cats = state.cats.map(id => CATEGORIES.find(c=>c.id===id)?.name).filter(Boolean);
    const tip1 = WEATHER_TIPS[state.weather];
    const tip2 = BUDGET_TIPS[state.budget];
    const tip3 = GROUP_HINTS[state.group];
    const el = document.getElementById('filterSummary');
    el.classList.add('show');
    el.innerHTML = `
      📍 <strong>${city.name}</strong> · 🌤️ <strong>${weather.name}</strong> · 💰 <strong>${budget.name}</strong> · 👥 <strong>${group.name}</strong>${cats.length?' · 🎯 '+cats.join('、'):''}<br>
      💡 ${tip1} ｜ ${tip2} ｜ ${tip3}
    `;
  }

  /* ---------- 渲染：卡片 ---------- */
  function renderCards(){
    const list = recommend();
    document.getElementById('resultCount').textContent = list.length;
    const cards = document.getElementById('cards');
    const empty = document.getElementById('empty');
    if(list.length === 0){
      cards.innerHTML = ''; empty.hidden = false; return;
    }
    empty.hidden = true;
    cards.innerHTML = list.map(a => {
      const cat = CATEGORIES.find(c => c.id === a.cat);
      const added = state.myList.includes(a.id);
      const checked = state.checkin[a.id];
      const btn = checked
        ? `<button class="card-btn checkin" data-act="checkin" data-id="${a.id}">✓ 已打卡</button>`
        : added
          ? `<button class="card-btn added" data-act="remove" data-id="${a.id}">✓ 已加入</button>`
          : `<button class="card-btn" data-act="add" data-id="${a.id}">+ 加入周末</button>`;
      return `
        <div class="card" data-id="${a.id}">
          <div class="card-cover">
            <span class="card-cat">${cat.emoji} ${cat.name}</span>
            <span class="card-match">匹配 ${a.score}%</span>
            ${a.recur ? `<span class="card-recur">📅 ${ENGINE.recurLabel(a.recur)}</span>` : ''}
            ${a.cover}
          </div>
          <div class="card-body">
            <div class="card-title">${a.title}</div>
            <div class="card-place">📍 ${a.place}</div>
            <div class="card-meta">
              <span>${WEATHERS.find(w=>a.weather.includes(w.id))?.emoji} ${WEATHER_TIPS[a.weather[0]]?.split('，')[0]||''}</span>
              <span>💳 ¥${a.price}</span>
              <span>⏱️ ${a.duration}</span>
              <span>🔥 ${a.hot}</span>
            </div>
            <div class="card-tags">${a.tags.slice(0,4).map(t=>`<span>#${t}</span>`).join('')}</div>
            <div class="card-reason">${a.reason}</div>
            <div class="card-actions">
              ${btn}
              <button class="card-why" data-act="why" data-id="${a.id}" type="button" title="查看推荐依据">为什么推荐？</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- 我的周末 ---------- */
  function renderMyList(){
    const el = document.getElementById('myList');
    if(state.myList.length === 0){
      el.innerHTML = `<div class="my-empty">还没选活动，去上面挑挑吧 👆</div>`;
      document.getElementById('myCount').textContent = '0 项';
      document.getElementById('myTotal').textContent = '¥0';
      return;
    }
    const items = state.myList.map(id => ACTIVITIES.find(a=>a.id===id)).filter(Boolean);
    el.innerHTML = items.map(a => `
      <div class="my-item">
        <div class="my-emoji">${a.cover}</div>
        <div class="my-info">
          <div class="t">${a.title}</div>
          <div class="s">${a.place} · ${a.duration}</div>
        </div>
        <div class="my-price">¥${a.price}</div>
        <button class="btn btn-ghost" data-act="remove" data-id="${a.id}" style="padding:6px 10px">×</button>
      </div>
    `).join('');
    const total = items.reduce((s,a)=>s+a.price, 0);
    document.getElementById('myCount').textContent = `${items.length} 项`;
    document.getElementById('myTotal').textContent = `¥${total}`;
  }

  /* ---------- 组队 ---------- */
  function renderTeam(){
    const codeEl = document.getElementById('teamCode');
    const bodyEl = document.getElementById('teamBody');
    const listEl = document.getElementById('teamList');
    if(!state.team){
      codeEl.textContent = '--';
      bodyEl.innerHTML = `
        <p class="team-lead">生成专属组队码，分享链接给好友，自动同步行程。</p>
        <button class="btn btn-primary" id="btnCreateTeam" type="button">+ 创建组队</button>
      `;
      listEl.innerHTML = '';
      return;
    }
    codeEl.textContent = state.team.code;
    const link = location.origin + location.pathname + '?join=' + state.team.code;
    bodyEl.innerHTML = `
      <p class="team-lead">分享以下链接给好友，他们加入后自动同步行程 👇</p>
      <div class="team-code-big">${state.team.code}</div>
      <div class="team-link-row">
        <input type="text" readonly value="${link}" id="teamLinkInput">
        <button class="btn btn-primary" id="btnCopyLinkInline" type="button">复制</button>
      </div>
    `;
    listEl.innerHTML = state.team.members.map(m =>
      `<div class="team-member"><span class="dot"></span>${m}</div>`
    ).join('');
    document.getElementById('btnCopyLinkInline').onclick = () => {
      const inp = document.getElementById('teamLinkInput');
      inp.select(); document.execCommand('copy');
      flashTip('组队链接已复制 ✅');
    };
  }

  function createTeam(){
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    state.team = { code, members: [nickname()] };
    saveState(); renderTeam(); updateURL();
  }
  function joinTeamByCode(code){
    if(!code) return;
    if(!state.team || state.team.code !== code){
      state.team = { code: code.toUpperCase(), members: [nickname()] };
    } else {
      const me = nickname();
      if(!state.team.members.includes(me)) state.team.members.push(me);
    }
    saveState(); renderTeam();
  }
  function nickname(){
    const pool = ['小柚','Yuki','阿琛','66','橙子','小米','阿白','七七','野子','栗子','南风','拾光','云朵','海盐','鹿野','阿喵','豆芽','苏打','青禾','山月'];
    return pool[Math.floor(Math.random()*pool.length)];
  }

  /* ---------- 打卡 ---------- */
  function renderCheckin(){
    const items = state.myList.map(id => ACTIVITIES.find(a=>a.id===id)).filter(Boolean);
    const done = items.filter(a => state.checkin[a.id]).length;
    document.getElementById('checkinTag').textContent = `${done}/${items.length}`;
    document.getElementById('checkinBar').style.width = items.length ? (done*100/items.length)+'%' : '0%';
    const el = document.getElementById('checkinList');
    if(items.length === 0){
      el.innerHTML = `<div class="my-empty">完成活动后回来打卡，可生成专属海报 🎯</div>`;
      return;
    }
    el.innerHTML = items.map(a => {
      const ok = !!state.checkin[a.id];
      return `<div class="checkin-item ${ok?'done':''}" data-act="toggleCheckin" data-id="${a.id}">
        <span class="ci-emoji">${a.cover}</span>
        <span class="ci-name">${a.title}</span>
        <span>${ok?'✅ 已打卡':'○ 待打卡'}</span>
      </div>`;
    }).join('');
  }

  /* ---------- URL 同步（分享用） ---------- */
  function updateURL(){
    const p = new URLSearchParams();
    p.set('city', state.city);
    p.set('weather', state.weather);
    p.set('budget', state.budget);
    p.set('group', state.group);
    if(state.cats.length) p.set('cats', state.cats.join(','));
    if(state.team) p.set('team', state.team.code);
    const newUrl = location.pathname + '?' + p.toString();
    history.replaceState(null, '', newUrl);
  }

  /* ---------- 攻略海报 Canvas ---------- */
  function drawShareCanvas(){
    const c = document.getElementById('shareCanvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;

    // 背景渐变
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0,'#0b1019'); bg.addColorStop(.5,'#152033'); bg.addColorStop(1,'#0b1019');
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // 装饰圆
    ctx.fillStyle = 'rgba(84,210,232,.10)'; ctx.beginPath(); ctx.arc(W-50,80,260,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(245,199,106,.08)'; ctx.beginPath(); ctx.arc(80,H-100,220,0,Math.PI*2); ctx.fill();

    // 顶部 logo
    ctx.fillStyle = '#e8edf5'; ctx.font = 'bold 26px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('🗺️ 周末漫游指南', 40, 60);
    ctx.fillStyle = '#64748b'; ctx.font = '14px sans-serif';
    ctx.fillText('WanderWeekend · 你的专属周末行程', 40, 84);

    // 筛选摘要
    const city = CITIES.find(c=>c.id===state.city).name;
    const weather = WEATHERS.find(w=>w.id===state.weather);
    const budget = BUDGETS.find(b=>b.id===state.budget);
    const group = GROUP_TYPES.find(g=>g.id===state.group);
    ctx.fillStyle = '#9aa7bd'; ctx.font = '16px sans-serif';
    ctx.fillText(`${city} · ${weather.emoji}${weather.name} · ${budget.emoji}${budget.name} · ${group.emoji}${group.name}`, 40, 130);

    // 分割线
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(40,150); ctx.lineTo(W-40,150); ctx.stroke();

    // 标题
    ctx.fillStyle = '#ffd98a'; ctx.font = 'bold 28px sans-serif';
    ctx.fillText('🎯 我的周末行程', 40, 195);

    // 行程条目
    const items = state.myList.map(id => ACTIVITIES.find(a=>a.id===id)).filter(Boolean);
    let y = 240;
    if(items.length === 0){
      ctx.fillStyle = '#64748b'; ctx.font = '15px sans-serif';
      ctx.fillText('（还没选活动，先去挑挑吧）', 40, y);
      y += 30;
    } else {
      items.slice(0,5).forEach((a, i) => {
        // emoji 圆
        ctx.fillStyle = 'rgba(84,210,232,.15)'; ctx.beginPath(); ctx.arc(60,y-8,18,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e8edf5'; ctx.font = '20px sans-serif'; ctx.fillText(a.cover, 50, y-3);
        // 标题
        ctx.fillStyle = '#e8edf5'; ctx.font = 'bold 17px sans-serif';
        ctx.fillText(a.title, 95, y);
        // 副信息
        ctx.fillStyle = '#64748b'; ctx.font = '13px sans-serif';
        ctx.fillText(`📍 ${a.place}  ·  ¥${a.price}  ·  ${a.duration}`, 95, y+20);
        y += 60;
      });
      if(items.length > 5){
        ctx.fillStyle = '#9aa7bd'; ctx.font = '13px sans-serif';
        ctx.fillText(`... 还有 ${items.length-5} 项`, 95, y);
        y += 30;
      }
    }

    // 合计
    const total = items.reduce((s,a)=>s+a.price,0);
    y += 10;
    ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(40, y, W-80, 60);
    ctx.fillStyle = '#9aa7bd'; ctx.font = '14px sans-serif'; ctx.fillText('人均合计', 60, y+25);
    ctx.fillStyle = '#f5c76a'; ctx.font = 'bold 24px sans-serif'; ctx.fillText(`¥${total}`, 60, y+50);
    if(state.team){
      ctx.fillStyle = '#54d2e8'; ctx.font = '14px sans-serif';
      ctx.fillText(`组队码：${state.team.code}`, W-260, y+25);
      ctx.fillStyle = '#5cd69d'; ctx.font = '13px sans-serif';
      ctx.fillText(`成员：${state.team.members.length} 人`, W-260, y+50);
    }

    // 打卡进度
    const done = items.filter(a => state.checkin[a.id]).length;
    const pct = items.length ? Math.round(done*100/items.length) : 0;
    y += 80;
    ctx.fillStyle = '#9aa7bd'; ctx.font = '14px sans-serif'; ctx.fillText(`🏆 打卡进度 ${done}/${items.length}`, 40, y);
    ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fillRect(40, y+10, W-80, 8);
    ctx.fillStyle = '#5cd69d'; ctx.fillRect(40, y+10, (W-80)*pct/100, 8);

    // 底部水印
    ctx.fillStyle = '#64748b'; ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('扫码 / 复制链接 → 打开同款行程', W/2, H-30);
    ctx.textAlign = 'left';
  }

  /* ---------- 文案分享 ---------- */
  function buildShareText(){
    const city = CITIES.find(c=>c.id===state.city).name;
    const weather = WEATHERS.find(w=>w.id===state.weather);
    const items = state.myList.map(id => ACTIVITIES.find(a=>a.id===id)).filter(Boolean);
    const lines = [
      `【周末漫游指南】${city} · ${weather.emoji}${weather.name}`,
      '',
      ...items.map((a,i) => `${i+1}. ${a.cover} ${a.title}（¥${a.price} / ${a.duration}）`),
      '',
      `合计 ¥${items.reduce((s,a)=>s+a.price,0)} / 人`,
      state.team ? `组队码：${state.team.code}` : '',
      '',
      '用「周末漫游指南」一键定制你的周末 →',
    ].filter(Boolean);
    return lines.join('\n');
  }

  function downloadCanvas(){
    const c = document.getElementById('shareCanvas');
    const a = document.createElement('a');
    a.download = `周末漫游_${Date.now()}.png`;
    a.href = c.toDataURL('image/png');
    a.click();
    flashTip('海报已下载 ✅');
  }

  /* ---------- 弹层 ---------- */
  function openShare(){
    document.getElementById('shareModal').classList.add('open');
    setTimeout(drawShareCanvas, 50);
  }
  function closeShare(){ document.getElementById('shareModal').classList.remove('open'); }

  function openCheckin(){
    document.getElementById('checkinModal').classList.add('open');
    const items = state.myList.map(id => ACTIVITIES.find(a=>a.id===id)).filter(Boolean);
    const el = document.getElementById('checkinListModal');
    if(items.length === 0){
      el.innerHTML = `<div class="my-empty">还没有行程，先去推荐区挑活动吧 👆</div>`;
      return;
    }
    el.innerHTML = items.map(a => {
      const ok = !!state.checkin[a.id];
      return `<div class="checkin-modal-item ${ok?'done':''}">
        <span class="ci-emoji" style="font-size:24px">${a.cover}</span>
        <span class="ci-name" style="flex:1;font-weight:700">${a.title}</span>
        <button class="btn ${ok?'btn-ghost':'btn-go'}" data-act="toggleCheckin" data-id="${a.id}" type="button">${ok?'取消':'✓ 打卡'}</button>
      </div>`;
    }).join('');
  }
  function closeCheckin(){ document.getElementById('checkinModal').classList.remove('open'); renderCheckin(); }

  function flashTip(msg){
    const el = document.getElementById('shareTip');
    if(!el) return;
    const old = el.textContent;
    el.textContent = msg;
    setTimeout(()=>{ el.textContent = old; }, 1800);
  }

  /* ---------- 为什么推荐给我（透明化弹层 + 四维雷达） ---------- */
  const DIM_NAMES = { weather: '天气', budget: '预算', group: '同行', interest: '兴趣' };

  function openWhy(actId){
    const a = ACTIVITIES.find(x => x.id === actId);
    if(!a) return;
    const m = match(a);
    document.getElementById('whyModal').classList.add('open');
    document.getElementById('whyTitle').innerHTML = `
      <span class="why-emoji">${a.cover}</span>
      <div>
        <div class="wt-name">${a.title}</div>
        <div class="wt-sub">📍 ${a.place} · 综合匹配度 <strong>${m.score}%</strong></div>
      </div>
    `;
    drawRadar(m.dims);
    const bars = Object.entries(m.dims).map(([k, v]) => {
      const pct = Math.round(v * 100);
      const label = k === 'interest' && state.cats.length === 0 ? '兴趣（未选择·中性）' : DIM_NAMES[k];
      return `<div class="why-bar-row">
        <span class="wb-label">${label}</span>
        <div class="wb-track"><span style="width:${pct}%"></span></div>
        <span class="wb-val">${pct}%</span>
      </div>`;
    }).join('');
    document.getElementById('whyBars').innerHTML = `
      ${bars}
      <div class="why-reasons">${m.reason.length ? '✓ ' + m.reason.join(' · ') : '按热度与综合维度推荐'}</div>
    `;
  }
  function closeWhy(){ document.getElementById('whyModal').classList.remove('open'); }

  function drawRadar(dims){
    const c = document.getElementById('radarCanvas');
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    const cx = W/2, cy = H/2, R = 118;
    ctx.clearRect(0, 0, W, H);

    /* 背景网格（4 轴 · 4 层） */
    const angles = [ -Math.PI/2, 0, Math.PI/2, Math.PI ];  /* 上右下左 */
    for(let ring = 1; ring <= 4; ring++){
      ctx.beginPath();
      const r = R * ring / 4;
      angles.forEach((ang, i) => {
        const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255,255,255,.08)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    /* 轴线 */
    angles.forEach(ang => {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
      ctx.strokeStyle = 'rgba(255,255,255,.10)';
      ctx.stroke();
    });

    /* 分数多边形 */
    const vals = [dims.weather, dims.budget, dims.group, dims.interest];
    const grad = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    grad.addColorStop(0, 'rgba(245,199,106,.45)');
    grad.addColorStop(1, 'rgba(84,210,232,.45)');
    ctx.beginPath();
    vals.forEach((v, i) => {
      const r = R * Math.max(.12, v);
      const x = cx + Math.cos(angles[i]) * r, y = cy + Math.sin(angles[i]) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#f5c76a';
    ctx.lineWidth = 2;
    ctx.stroke();
    /* 顶点圆 */
    vals.forEach((v, i) => {
      const r = R * Math.max(.12, v);
      const x = cx + Math.cos(angles[i]) * r, y = cy + Math.sin(angles[i]) * r;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI*2);
      ctx.fillStyle = '#ffd98a'; ctx.fill();
    });

    /* 轴标签 */
    const labels = ['天气', '预算', '同行', '兴趣'];
    const valsPct = vals.map(v => Math.round(v*100) + '%');
    labels.forEach((lb, i) => {
      const ang = angles[i];
      const lx = cx + Math.cos(ang) * (R + 30);
      const ly = cy + Math.sin(ang) * (R + 26);
      ctx.fillStyle = '#e8edf5'; ctx.font = 'bold 15px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(lb, lx, ly - 9);
      ctx.fillStyle = '#f5c76a'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(valsPct[i], lx, ly + 9);
    });
  }

  /* ---------- SVG 行程地图（手绘城市示意 · 与「我的周末」联动） ---------- */
  function renderMap(){
    const wrap = document.getElementById('mapWrap');
    const cityMap = CITY_MAPS[state.city] || CITY_MAPS.bj;
    const cityName = CITIES.find(c => c.id === state.city)?.name || '';
    document.getElementById('mapCity').textContent = cityName;

    /* 当前城市内已加入行程的活动（保持加入顺序） */
    const items = state.myList
      .map(id => ACTIVITIES.find(a => a.id === id))
      .filter(a => a && a.city === state.city);
    /* 同城全部活动点位（淡显） */
    const allInCity = ACTIVITIES.filter(a => a.city === state.city);

    const lm = cityMap.landmarks.map(p => `
      <g class="map-landmark">
        <circle cx="${p.x}" cy="${p.y}" r="1.3"/>
        <text x="${p.x + 2.5}" y="${p.y + 1}">${p.name}</text>
      </g>
    `).join('');

    const faded = allInCity
      .filter(a => !items.find(x => x.id === a.id))
      .map(a => {
        const p = MAP_POS[a.id];
        return p ? `<circle class="map-dot-faded" cx="${p.x}" cy="${p.y}" r="1.6"><title>${a.title}</title></circle>` : '';
      }).join('');

    /* 路线：按加入顺序连线 */
    const pts = items.map(a => MAP_POS[a.id]).filter(Boolean);
    const route = pts.length >= 2
      ? `<polyline class="map-route" points="${pts.map(p => `${p.x},${p.y}`).join(' ')}"/>`
      : '';

    const markers = items.map((a, i) => {
      const p = MAP_POS[a.id];
      if(!p) return '';
      const done = state.checkin[a.id];
      return `<g class="map-marker${done ? ' done' : ''}" data-map-id="${a.id}">
        <circle cx="${p.x}" cy="${p.y}" r="3.4"/>
        <text x="${p.x}" y="${p.y + 1.3}">${i + 1}</text>
        <text class="map-marker-name" x="${p.x}" y="${p.y - 5}">${a.title.length > 8 ? a.title.slice(0, 8) + '…' : a.title}</text>
      </g>`;
    }).join('');

    wrap.innerHTML = `
      <svg viewBox="0 0 100 100" class="map-svg" preserveAspectRatio="xMidYMid meet">
        <rect class="map-bg" x="1" y="1" width="98" height="98" rx="4"/>
        ${[20,40,60,80].map(v => `<line class="map-grid" x1="${v}" y1="2" x2="${v}" y2="98"/><line class="map-grid" x1="2" y1="${v}" x2="98" y2="${v}"/>`).join('')}
        <path class="map-river" d="${cityMap.river}"/>
        <text class="map-river-name" x="6" y="${state.city === 'sz' ? 50 : 60}">${cityMap.riverName}</text>
        ${lm}
        ${faded}
        ${route}
        ${markers}
        <text class="map-city-name" x="50" y="9">${cityName} · 城市示意图</text>
      </svg>
    `;
    document.getElementById('mapTip').textContent = items.length >= 2
      ? `已串联 ${items.length} 个活动 · 点击数字点位跳转对应卡片（正式版接入腾讯地图）`
      : items.length === 1
        ? '再加入 1 个活动即可生成漫游路线 · 点击点位跳转卡片'
        : '加入活动后自动生成漫游路线，淡色点为同城其他活动';

    /* 点位点击 → 滚动到卡片并高亮 */
    wrap.querySelectorAll('.map-marker').forEach(g => {
      g.addEventListener('click', () => {
        const card = document.querySelector(`.card[data-id="${g.dataset.mapId}"]`);
        if(!card) return;
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('card-flash');
        setTimeout(() => card.classList.remove('card-flash'), 1800);
      });
    });
  }

  /* ---------- 概念功能区（灰态入口 + 三段式弹层） ---------- */
  function renderConcepts(){
    const grid = document.getElementById('conceptGrid');
    grid.innerHTML = Object.entries(CONCEPTS).map(([key, c]) => `
      <div class="concept-item" data-concept="${key}">
        <div class="ci-top">
          <span class="ci-icon">${c.icon}</span>
          <div>
            <div class="ci-title">${c.title}</div>
            <div class="ci-desc">${c.desc}</div>
          </div>
        </div>
        <span class="ci-badge">正式版规划中</span>
      </div>
    `).join('');
    grid.querySelectorAll('.concept-item').forEach(el => {
      el.addEventListener('click', () => openConcept(el.dataset.concept));
    });
  }

  function openConcept(key){
    const c = CONCEPTS[key];
    if(!c) return;
    document.getElementById('conceptTitle').innerHTML = `${c.icon} ${c.title} · 设计思路`;
    document.getElementById('conceptBody').innerHTML = `
      <div class="concept-block">
        <div class="cb-label pain">😣 用户痛点</div>
        <p>${c.pain}</p>
      </div>
      <div class="concept-block">
        <div class="cb-label idea">💡 产品思路</div>
        <p>${c.idea}</p>
      </div>
      <div class="concept-block">
        <div class="cb-label path">🔧 技术路径</div>
        <p>${c.path}</p>
      </div>
    `;
    document.getElementById('conceptModal').classList.add('open');
  }
  function closeConcept(){ document.getElementById('conceptModal').classList.remove('open'); }

  /* ---------- 全局渲染 ---------- */
  function renderAll(){
    renderChips();
    renderCards();
    renderMap();
    renderMyList();
    renderTeam();
    renderCheckin();
  }

  /* ---------- 事件绑定 ---------- */
  function bindEvents(){
    // chips（事件委托：renderAll 重绘 chips 后监听依然有效）
    document.getElementById('filters').addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if(!chip) return;
      const key = chip.dataset.key;
      const id  = chip.dataset.id;
      const multi = chip.dataset.multi === 'true';
      if(multi){
        const i = state.cats.indexOf(id);
        if(i>=0) state.cats.splice(i,1); else state.cats.push(id);
      } else {
        state[key] = id;
      }
      saveState(); updateURL(); renderAll();
    });

    // 排序
    document.querySelectorAll('.sort-btn').forEach(b => {
      b.addEventListener('click', () => {
        state.sort = b.dataset.sort;
        document.querySelectorAll('.sort-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderCards();
      });
    });

    // 卡片操作（事件委托）
    document.getElementById('cards').addEventListener('click', e => {
      const btn = e.target.closest('[data-act]');
      if(!btn) return;
      const id = btn.dataset.id;
      if(btn.dataset.act === 'add'){
        if(!state.myList.includes(id)) state.myList.push(id);
        flashTip('已加入周末 ✅');
      } else if(btn.dataset.act === 'remove'){
        state.myList = state.myList.filter(x => x !== id);
        delete state.checkin[id];
      } else if(btn.dataset.act === 'checkin'){
        state.checkin[id] = !state.checkin[id];
        flashTip(state.checkin[id] ? '打卡完成 🎯' : '已取消打卡');
      } else if(btn.dataset.act === 'why'){
        openWhy(id);
        return;
      }
      saveState(); updateURL(); renderAll();
    });

    // 我的周末 - 删除
    document.getElementById('myList').addEventListener('click', e => {
      const btn = e.target.closest('[data-act="remove"]');
      if(!btn) return;
      const id = btn.dataset.id;
      state.myList = state.myList.filter(x => x !== id);
      delete state.checkin[id];
      saveState(); updateURL(); renderAll();
    });

    // 我的周末 - 清空
    document.getElementById('btnClear').addEventListener('click', () => {
      if(confirm('确定清空周末行程？')){
        state.myList = []; state.checkin = {};
        saveState(); renderAll();
      }
    });

    // 打卡弹层
    document.getElementById('checkinList').addEventListener('click', e => {
      const btn = e.target.closest('[data-act="toggleCheckin"]');
      if(!btn) return;
      state.checkin[btn.dataset.id] = !state.checkin[btn.dataset.id];
      saveState(); renderCheckin();
    });
    document.getElementById('checkinListModal').addEventListener('click', e => {
      const btn = e.target.closest('[data-act="toggleCheckin"]');
      if(!btn) return;
      state.checkin[btn.dataset.id] = !state.checkin[btn.dataset.id];
      saveState(); openCheckin(); renderCheckin();
    });

    // 创建组队（事件委托）
    document.getElementById('teamBody').addEventListener('click', e => {
      if(e.target.id === 'btnCreateTeam' || e.target.closest('#btnCreateTeam')){
        createTeam();
      }
    });

    // 分享
    document.getElementById('btnShare').addEventListener('click', openShare);
    document.getElementById('btnDownload').addEventListener('click', downloadCanvas);
    document.getElementById('btnCopyLink').addEventListener('click', () => {
      navigator.clipboard.writeText(location.href).then(()=>flashTip('完整链接已复制 ✅'));
    });
    document.getElementById('btnCopyText').addEventListener('click', () => {
      navigator.clipboard.writeText(buildShareText()).then(()=>flashTip('攻略文案已复制 ✅'));
    });

    // 打卡弹层
    document.getElementById('btnCheckin').addEventListener('click', openCheckin);

    // Hero CTA（旧绑定已移除，见上方「首屏即开即玩」）
    document.getElementById('btnScrollFilter').addEventListener('click', () => {
      document.getElementById('filters').scrollIntoView({behavior:'smooth', block:'start'});
    });
    document.getElementById('btnReset').addEventListener('click', () => {
      state.cats = []; state.city='bj'; state.weather='sunny'; state.budget='mid'; state.group='friends';
      saveState(); updateURL(); renderAll();
      document.getElementById('filters').scrollIntoView({behavior:'smooth', block:'start'});
    });

    // Esc 关闭弹层
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape'){ closeShare(); closeCheckin(); closeWhy(); closeConcept(); }
    });

    // 换一批
    document.getElementById('btnShuffle').addEventListener('click', shuffleCards);

    // 自然语言搜索
    document.getElementById('btnNL').addEventListener('click', applyNL);
    document.getElementById('nlInput').addEventListener('keydown', e => {
      if(e.key === 'Enter') applyNL();
    });

    // Hero CTA：直接看推荐结果（首屏即开即玩）
    document.getElementById('btnStart').addEventListener('click', () => {
      document.getElementById('resultCount').scrollIntoView({behavior:'smooth', block:'start'});
    });
  }

  /* ---------- 初始化 ---------- */
  function init(){
    loadState();
    loadFromURL();
    validateState();
    renderHeroTags();
    renderAll();
    renderConcepts();
    bindEvents();
    // 启动时如果有 team，分享一下
    if(state.team){
      setTimeout(() => {
        flashTip(`已加入组队 ${state.team.code}，欢迎 🎉`);
      }, 600);
    }
  }

  /* ---------- 对外暴露 ---------- */
  return { init, openShare, closeShare, openCheckin, closeCheckin,
           openWhy, closeWhy, closeConcept,
           goHome:()=>location.href=location.pathname };
})();

document.addEventListener('DOMContentLoaded', WW.init);