/* ============================================================
 * 周末漫游指南 · WanderWeekend
 * mock 数据：4 个城市、20+ 活动
 * 数据维度：城市 / 类型 / 天气适配 / 人均预算 / 标签 / 推荐理由
 * ============================================================ */

const CITIES = [
  { id: 'bj', name: '北京', emoji: '🏯', desc: '胡同 · 艺术 · 历史' },
  { id: 'sh', name: '上海', emoji: '🌆', desc: '外滩 · 弄堂 · 海派' },
  { id: 'gz', name: '广州', emoji: '🌴', desc: '老城 · 早茶 · 珠江' },
  { id: 'sz', name: '深圳', emoji: '🌊', desc: '滨海 · 科技 · 创意' },
];

const WEATHERS = [
  { id: 'sunny', name: '晴天', emoji: '☀️', tag: '户外友好', indoor: false },
  { id: 'cloudy', name: '阴天', emoji: '⛅', tag: '都行', indoor: false },
  { id: 'rainy', name: '雨天', emoji: '🌧️', tag: '建议室内', indoor: true },
];

const CATEGORIES = [
  { id: 'art',     name: '展览',     emoji: '🖼️' },
  { id: 'market',  name: '市集',     emoji: '🛍️' },
  { id: 'show',    name: '演出',     emoji: '🎭' },
  { id: 'walk',    name: 'CityWalk', emoji: '🚶' },
  { id: 'cafe',    name: '咖啡探店', emoji: '☕' },
  { id: 'hike',    name: '短途徒步', emoji: '🥾' },
  { id: 'script',  name: '剧本杀',   emoji: '🎲' },
];

const BUDGETS = [
  { id: 'low',  name: '省钱', range: [0, 50],   emoji: '💰' },
  { id: 'mid',  name: '适中', range: [50, 150], emoji: '💳' },
  { id: 'high', name: '犒劳', range: [150, 300],emoji: '✨' },
];

const GROUP_TYPES = [
  { id: 'solo',    name: '独自出发', emoji: '🧍' },
  { id: 'couple',  name: '情侣约会', emoji: '💑' },
  { id: 'friends', name: '三五好友', emoji: '👯' },
  { id: 'family',  name: '家庭出行', emoji: '👨‍👩‍👧' },
];

/* 活动数据 · 4 城 × 5-6 条 */
const ACTIVITIES = [
  /* ===== 北京 ===== */
  {
    id: 'bj-01', city: 'bj', cat: 'art',
    title: '798 · 数字印象当代艺术展',
    place: '朝阳区 798 艺术区 A07',
    cover: '🎨',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 88,
    group: ['friends','couple','family'],
    duration: '2-3h',
    tags: ['艺术','拍照','室内','网红打卡'],
    reason: '12 位新锐艺术家联展，雨天也能拍出氛围感大片。',
    hot: 96,
  },
  {
    id: 'bj-02', city: 'bj', cat: 'market',
    title: '三里屯 · 周日复古手作市集',
    place: '朝阳区 三里屯通盈中心',
    cover: '🛍️',
    weather: ['sunny','cloudy'],
    budget: 'mid', price: 0,
    group: ['friends','family'],
    duration: '2-4h',
    tags: ['手作','复古','户外','免费入场'],
    reason: '40+ 原创摊位，逛吃逛喝一站搞定。',
    hot: 91,
  },
  {
    id: 'bj-03', city: 'bj', cat: 'show',
    title: '国家大剧院 · 春日室内音乐会',
    place: '西城区 国家大剧院音乐厅',
    cover: '🎼',
    weather: ['rainy','cloudy'],
    budget: 'high', price: 280,
    group: ['couple','family','friends'],
    duration: '1.5h',
    tags: ['古典','室内','高格调'],
    reason: '雨天窝在剧院里听一场贝多芬，绝了。',
    hot: 88,
  },
  {
    id: 'bj-04', city: 'bj', cat: 'walk',
    title: '后海 · 老胡同 CityWalk',
    place: '西城区 后海-烟袋斜街',
    cover: '🚶',
    weather: ['sunny','cloudy'],
    budget: 'low', price: 0,
    group: ['solo','friends','family'],
    duration: '3-4h',
    tags: ['历史','胡同','免费','出片'],
    reason: '胡同白墙灰瓦，0 元出大片路线。',
    hot: 94,
  },
  {
    id: 'bj-05', city: 'bj', cat: 'cafe',
    title: '五道营胡同 · 独立咖啡地图',
    place: '东城区 五道营胡同',
    cover: '☕',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 65,
    group: ['solo','couple','friends'],
    duration: '2-3h',
    tags: ['咖啡','胡同','出片','惬意'],
    reason: '5 家获奖咖啡馆，挨家打卡不踩雷。',
    hot: 90,
  },
  {
    id: 'bj-06', city: 'bj', cat: 'hike',
    title: '香山 · 短途徒步登顶',
    place: '海淀区 香山公园',
    cover: '🌲',
    weather: ['sunny'],
    budget: 'low', price: 10,
    group: ['friends','family','solo'],
    duration: '半天',
    tags: ['徒步','自然','登高','10 元'],
    reason: '10 元门票登顶看京城，秋日限定。',
    hot: 85,
  },

  /* ===== 上海 ===== */
  {
    id: 'sh-01', city: 'sh', cat: 'walk',
    title: '外滩 · 万国建筑 CityWalk',
    place: '黄浦区 中山东一路',
    cover: '🌆',
    weather: ['sunny','cloudy'],
    budget: 'low', price: 0,
    group: ['solo','couple','friends','family'],
    duration: '2-3h',
    tags: ['地标','夜景','免费'],
    reason: '沿江 1.5km，52 栋万国建筑免费看。',
    hot: 97,
  },
  {
    id: 'sh-02', city: 'sh', cat: 'cafe',
    title: '武康路 · 老洋房咖啡巡礼',
    place: '徐汇区 武康路',
    cover: '☕',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 58,
    group: ['solo','couple','friends'],
    duration: '3h',
    tags: ['咖啡','梧桐','文艺'],
    reason: '梧桐树下 6 家独立咖啡，每家都是封面级。',
    hot: 93,
  },
  {
    id: 'sh-03', city: 'sh', cat: 'art',
    title: 'M50 · 当代影像艺术季',
    place: '普陀区 M50 创意园',
    cover: '🖼️',
    weather: ['rainy','cloudy'],
    budget: 'mid', price: 80,
    group: ['friends','couple'],
    duration: '2-3h',
    tags: ['艺术','影像','室内'],
    reason: '雨天的最佳归宿，仓库里的影像诗。',
    hot: 87,
  },
  {
    id: 'sh-04', city: 'sh', cat: 'show',
    title: '安福路 · 经典话剧《茶馆》',
    place: '徐汇区 上海话剧艺术中心',
    cover: '🎭',
    weather: ['rainy','cloudy','sunny'],
    budget: 'high', price: 240,
    group: ['couple','family','friends'],
    duration: '2.5h',
    tags: ['话剧','经典','高格调'],
    reason: '老舍名剧全新阵容，文艺周末首选。',
    hot: 89,
  },
  {
    id: 'sh-05', city: 'sh', cat: 'market',
    title: '田子坊 · 海派文创市集',
    place: '黄浦区 田子坊',
    cover: '🛍️',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 0,
    group: ['friends','family','couple'],
    duration: '2-3h',
    tags: ['文创','海派','室内外'],
    reason: '弄堂里的小店聚落，文创控的天堂。',
    hot: 86,
  },
  {
    id: 'sh-06', city: 'sh', cat: 'hike',
    title: '佘山 · 一日轻徒步',
    place: '松江区 佘山国家森林公园',
    cover: '🌲',
    weather: ['sunny'],
    budget: 'low', price: 0,
    group: ['family','friends'],
    duration: '半天',
    tags: ['徒步','自然','0 元'],
    reason: '上海唯一山林，免费登顶看松江。',
    hot: 78,
  },

  /* ===== 广州 ===== */
  {
    id: 'gz-01', city: 'gz', cat: 'walk',
    title: '永庆坊 · 西关老街 CityWalk',
    place: '荔湾区 永庆坊',
    cover: '🏮',
    weather: ['sunny','cloudy'],
    budget: 'low', price: 0,
    group: ['solo','friends','family'],
    duration: '3h',
    tags: ['岭南','老街','免费','出片'],
    reason: '骑楼老街 + 月亮桥，0 元出岭南大片。',
    hot: 92,
  },
  {
    id: 'gz-02', city: 'gz', cat: 'cafe',
    title: '东山口 · 民国洋楼咖啡地图',
    place: '越秀区 东山口',
    cover: '☕',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 48,
    group: ['solo','couple','friends'],
    duration: '2-3h',
    tags: ['咖啡','民国','文艺'],
    reason: '红砖洋楼群里的精品咖啡巡游。',
    hot: 88,
  },
  {
    id: 'gz-03', city: 'gz', cat: 'art',
    title: '太古汇 · 当代设计双年展',
    place: '天河区 太古汇 L2',
    cover: '🖼️',
    weather: ['rainy','cloudy','sunny'],
    budget: 'high', price: 120,
    group: ['friends','couple','family'],
    duration: '2h',
    tags: ['设计','室内','高格调'],
    reason: '全球 30 位设计师作品，雨天也好逛。',
    hot: 84,
  },
  {
    id: 'gz-04', city: 'gz', cat: 'market',
    title: '天环广场 · 周末文创市集',
    place: '天河区 天环广场',
    cover: '🛍️',
    weather: ['sunny','cloudy'],
    budget: 'mid', price: 0,
    group: ['friends','family'],
    duration: '2-3h',
    tags: ['文创','户外','市集'],
    reason: 'CBD 里的精致市集，吃喝玩乐一站。',
    hot: 82,
  },
  {
    id: 'gz-05', city: 'gz', cat: 'show',
    title: '珠江夜游 · 游船爵士夜',
    place: '天河区 天字码头',
    cover: '🚢',
    weather: ['sunny','cloudy'],
    budget: 'high', price: 198,
    group: ['couple','family','friends'],
    duration: '1.5h',
    tags: ['夜游','音乐','珠江'],
    reason: '珠江夜风 + 现场爵士，浪漫天花板。',
    hot: 90,
  },

  /* ===== 深圳 ===== */
  {
    id: 'sz-01', city: 'sz', cat: 'art',
    title: '华侨城 · OCT 当代艺术展',
    place: '南山区 华侨城创意文化园',
    cover: '🎨',
    weather: ['sunny','cloudy','rainy'],
    budget: 'mid', price: 68,
    group: ['friends','couple','family'],
    duration: '2-3h',
    tags: ['艺术','创意园','室内'],
    reason: '深圳最经典的创意园，雨天也好逛。',
    hot: 91,
  },
  {
    id: 'sz-02', city: 'sz', cat: 'hike',
    title: '深圳湾公园 · 海边徒步',
    place: '南山区 深圳湾公园',
    cover: '🌊',
    weather: ['sunny','cloudy'],
    budget: 'low', price: 0,
    group: ['solo','couple','family','friends'],
    duration: '2-3h',
    tags: ['海边','徒步','免费','看海'],
    reason: '13km 海滨栈道，0 元看海看日落。',
    hot: 95,
  },
  {
    id: 'sz-03', city: 'sz', cat: 'cafe',
    title: '海上世界 · 海景咖啡街',
    place: '南山区 海上世界',
    cover: '☕',
    weather: ['sunny','cloudy'],
    budget: 'mid', price: 68,
    group: ['solo','couple','friends'],
    duration: '2h',
    tags: ['海景','咖啡','出片'],
    reason: '海风 + 邮轮 + 精品咖啡，出片率 100%。',
    hot: 89,
  },
  {
    id: 'sz-04', city: 'sz', cat: 'show',
    title: '万象天地 · 即兴喜剧夜',
    place: '南山区 万象天地剧场',
    cover: '🎤',
    weather: ['rainy','cloudy','sunny'],
    budget: 'high', price: 180,
    group: ['friends','couple'],
    duration: '1.5h',
    tags: ['喜剧','脱口秀','夜晚'],
    reason: '爆笑解压，周末就该这样笑到肚子痛。',
    hot: 87,
  },
  {
    id: 'sz-05', city: 'sz', cat: 'walk',
    title: '南头古城 · 古城 CityWalk',
    place: '南山区 南头古城',
    cover: '🏯',
    weather: ['sunny','cloudy'],
    budget: 'low', price: 0,
    group: ['solo','friends','family'],
    duration: '3-4h',
    tags: ['古城','历史','免费','出片'],
    reason: '1700 年古城 + 文创小店，0 元漫步。',
    hot: 86,
  },
];

/* 团队奖励：根据同行人数给不同提示文案 */
const GROUP_HINTS = {
  solo:    '独自出发，建议选安全系数高、人流适中的活动。',
  couple:  '情侣档，已为你避开亲子/嘈杂类活动。',
  friends: '三五好友，分摊预算更划算，可考虑组合行程。',
  family:  '家庭出行，已过滤陡峭徒步与深夜场。',
};

/* 天气推荐策略文案 */
const WEATHER_TIPS = {
  sunny: '阳光正好，户外活动放心冲 ☀️',
  cloudy: '天气凉爽，室内外都合适 ⛅',
  rainy: '雨天主推室内，户外备好雨具 🌧️',
};

/* 预算策略 */
const BUDGET_TIPS = {
  low:  '0-50 元/人的省钱路线已为你筛出 💰',
  mid:  '50-150 元/人的适中推荐 💳',
  high: '犒劳自己，150+ 元的精致体验 ✨',
};

/* ---------- SVG 手绘地图数据 ---------- */
/* 各活动在所在城市示意图上的坐标（百分比 0-100） */
const MAP_POS = {
  /* 北京 */
  'bj-01': { x: 44, y: 22 }, /* 798（东北） */
  'bj-02': { x: 55, y: 34 }, /* 三里屯 */
  'bj-03': { x: 37, y: 62 }, /* 国家大剧院 */
  'bj-04': { x: 36, y: 50 }, /* 后海 */
  'bj-05': { x: 38, y: 44 }, /* 五道营 */
  'bj-06': { x: 16, y: 30 }, /* 香山（西北郊） */
  /* 上海 */
  'sh-01': { x: 64, y: 50 }, /* 外滩（东） */
  'sh-02': { x: 34, y: 56 }, /* 武康路 */
  'sh-03': { x: 34, y: 34 }, /* M50 */
  'sh-04': { x: 36, y: 52 }, /* 安福路 */
  'sh-05': { x: 48, y: 66 }, /* 田子坊 */
  'sh-06': { x: 24, y: 84 }, /* 佘山（西南郊） */
  /* 广州 */
  'gz-01': { x: 34, y: 46 }, /* 永庆坊（老城西） */
  'gz-02': { x: 50, y: 36 }, /* 东山口 */
  'gz-03': { x: 62, y: 42 }, /* 太古汇 */
  'gz-04': { x: 60, y: 40 }, /* 天环广场 */
  'gz-05': { x: 58, y: 56 }, /* 天字码头（珠江边） */
  /* 深圳 */
  'sz-01': { x: 42, y: 58 }, /* 华侨城 */
  'sz-02': { x: 30, y: 76 }, /* 深圳湾（南） */
  'sz-03': { x: 24, y: 64 }, /* 海上世界（西） */
  'sz-04': { x: 54, y: 48 }, /* 万象天地 */
  'sz-05': { x: 38, y: 64 }, /* 南头古城 */
};

/* 城市示意图：手绘风格地标 + 水系曲线 */
const CITY_MAPS = {
  bj: {
    landmarks: [
      { name: '故宫', x: 40, y: 52 },
      { name: '鸟巢', x: 48, y: 26 },
      { name: '颐和园', x: 20, y: 24 },
    ],
    river: 'M 0,40 C 18,38 26,52 42,54 C 58,56 66,70 100,72',
    riverName: '护城河',
  },
  sh: {
    landmarks: [
      { name: '人民广场', x: 50, y: 44 },
      { name: '静安寺', x: 40, y: 42 },
      { name: '陆家嘴', x: 74, y: 46 },
    ],
    river: 'M 0,64 C 20,62 34,52 46,50 C 60,48 68,44 100,40',
    riverName: '黄浦江',
  },
  gz: {
    landmarks: [
      { name: '北京路', x: 46, y: 44 },
      { name: '珠江新城', x: 62, y: 46 },
      { name: '沙面', x: 30, y: 50 },
    ],
    river: 'M 0,62 C 22,60 40,54 56,58 C 72,62 84,68 100,70',
    riverName: '珠江',
  },
  sz: {
    landmarks: [
      { name: '市民中心', x: 56, y: 44 },
      { name: '深圳大学', x: 38, y: 56 },
      { name: '蛇口', x: 20, y: 66 },
    ],
    river: 'M 0,52 C 16,54 24,60 36,66 C 52,74 70,84 100,90',
    riverName: '深圳湾',
  },
};

/* 概念功能（正式版规划中）· 三段式：痛点 → 思路 → 路径 */
const CONCEPTS = {
  locate: {
    icon: '📡', title: '组员实时定位',
    desc: '集合时不再群里刷屏「你到哪了」',
    pain: '周六下午集合，群里刷屏「你到哪了」「到底在哪个门集合」，位置说不清，等人浪费时间。',
    idea: '组队成员打开链接授权位置后，在行程地图上实时显示每个人的坐标与预计到达时间，谁没出发一目了然。',
    path: '正式版技术路径：WebSocket 长连接 + 浏览器 Geolocation / 腾讯定位 SDK，服务端广播成员坐标，前端地图实时渲染。',
  },
  vote: {
    icon: '🗳️', title: '组内投票',
    desc: '「去 A 还是去 B」一票解决',
    pain: '三五好友兴趣不一致，「随便」「都行」式的讨论拖垮决策，最后哪都没去成。',
    idea: '把候选行程一键发起组内投票，每人一票 + 匹配度参考，少数服从多数，10 分钟定案。',
    path: '正式版技术路径：组队房间内投票状态同步（实时推送 + 截止时间），投票结果直接生成最终行程。',
  },
  nl: {
    icon: '💬', title: '自然语言搜索',
    desc: '说一句「想要安静能拍照的地方」',
    pain: '标签筛选仍需理解产品分类，说不出「想要安静、能拍照、人均 50 内」这种自然诉求对应的标签组合。',
    idea: '输入一句自然语言，自动解析为筛选条件组合（安静→低人流，能拍照→出片标签）并出推荐结果。',
    path: '正式版技术路径：LLM 语义解析 → 结构化筛选条件映射 → 复用现有推荐引擎，输入框已预留入口。',
  },
  route: {
    icon: '🧭', title: '手动规划路线',
    desc: '拖拽点位，路线自动重排',
    pain: '多个活动地点分散，不知道先去哪个最顺路，临时改行程后路线全乱。',
    idea: '在地图上拖拽活动点位调整顺序，路线与交通耗时自动重算，形成最优漫游动线。',
    path: '正式版技术路径：腾讯地图 JS API 拖拽交互 + 路径规划接口，当前 SVG 示意图已展示自动连线逻辑。',
  },
};

/* 导出 */
window.WW_DATA = {
  CITIES, WEATHERS, CATEGORIES, BUDGETS, GROUP_TYPES,
  ACTIVITIES, GROUP_HINTS, WEATHER_TIPS, BUDGET_TIPS,
  MAP_POS, CITY_MAPS, CONCEPTS,
};