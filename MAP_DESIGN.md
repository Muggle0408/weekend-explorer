# 行程地图 · 技术方案设计（方案 A：真实区划矢量底图 + 导航深链）

> 本文档记录「行程地图」板块的选型评估与本期技术方案，是后续实现的依据。
> 视觉部分落地后需同步更新 `VISUAL_DESIGN.md`；新增纯函数需同步补充 `test/engine.test.js`。

---

## 1. 背景与现状

当前行程地图为纯手绘 SVG 示意图（`viewBox="0 0 100 100"` 百分比坐标系）：

- `data.js` → `CITY_MAPS`：每城 3 个手摆地标 + 一条手绘水系曲线（`river` path）
- `data.js` → `MAP_POS`：22 个活动的点位坐标，均为人工估计的百分比位置
- `app.js` → `renderMap()`：绘制背景、网格线、水系、地标、淡色点（同城其他活动）、路线折线、数字序号标记；点击标记滚动定位到对应活动卡片

**现状问题**：底图是抽象虚线框，与真实地理无关，用户无法建立空间认知；活动坐标靠手摆，新增城市/活动成本高且无依据。

## 2. 约束条件（不可妥协）

来自 `AGENTS.md` 与产品定位：

| 约束 | 影响 |
|---|---|
| 纯静态前端，零 npm 依赖、零外部运行时 API | 排除地图 SDK、瓦片服务 |
| 断网可演示 | 排除一切需联网的底图/静态图 API |
| GitHub Pages 托管 | 无服务端，API key 无法保密 |
| 视觉基调为莫奈《睡莲》印象派 | 底图必须可深度定制配色，真实地图瓦片风格冲突 |

## 3. 候选方案评估回顾

| 方案 | 成本 | 安全风险 | 离线 | 结论 |
|---|---|---|---|---|
| **A. 真实区划 GeoJSON → 本地 SVG 底图** | 零 | 零（无 key、无请求） | ✅ | **本期采用** |
| B. 高德/腾讯地图 JS API | 免费额度内零 | key 前端暴露，需域名白名单缓解 | ❌ | 否决（与断网约束冲突，留作正式版路径） |
| C. Leaflet + 本地 GeoJSON | 零 | 零 | ✅ | 否决（库体积与交互复杂度超出"示意级"需求） |
| D. 静态地图图 API | 免费额度 | key 暴露、需联网 | ❌ | 否决 |
| —— 高德 URI 深链导航 | 零 | 零（无需 key） | 降级隐藏 | **本期采用（导航出口）** |

**合规说明**：方案 A 输出的是标注"城市示意图"的抽象化矢量轮廓，不提供测绘级地理信息，风险可控；若未来切换到方案 B，官方 SDK 自带审图资质，合规问题由服务商承接。

## 4. 本期决策（已与产品确认）

1. **覆盖范围**：北上广深 4 城全部更换为真实区划轮廓底图
2. **交互层级**：静态示意级——保留现有"点击点位跳转卡片"，不做缩放/拖拽
3. **导航深链**：本期一起实现，点位/卡片增加「导航」按钮，跳转高德 URI，断网时隐藏

## 5. 总体架构

```
公开 GeoJSON（DataV.GeoAtlas 等）
        │  离线预处理（一次性，不进入运行时）
        ▼
简化 + 压缩 + 投影到 0-100 坐标系 ──► assets/maps/{city}.svg（每城 ≤ 30KB）
                                        │
运行时：ACTIVITIES 携带真实经纬度 ──► engine.js 纯函数投影 ──► 0-100 坐标
                                        │
                            app.js renderMap() 渲染：底图 + 点位 + 路线
                                        │
                            点位「导航」按钮 ──► 高德 URI 深链（有网时）
```

核心思路：**所有地理数据的复杂性在离线预处理阶段解决，运行时只做一次线性投影**，不引入任何地理库。

## 6. 数据管线设计（离线预处理，一次性）

### 6.1 数据源

- 阿里云 DataV.GeoAtlas（`https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json`），北上广深对应 adcode：110000 / 310000 / 440100 / 440300
- 选择区级边界（`_full` 含子区划），保留海岸线，天然包含水体轮廓（如深圳湾）

### 6.2 处理步骤

1. 下载 4 城 GeoJSON
2. 用 mapshaper 简化：`-simplify 10% keep-shapes`，目标每城 SVG path 数据 ≤ 30KB
3. 记录每城的经纬度包围盒 `bbox: [minLng, minLat, maxLng, maxLat]`
4. 将 polygon 坐标经投影函数（见 6.3）换算到 0-100 坐标系，生成静态 SVG 文件存入 `assets/maps/`，含：
   - 区划轮廓 path（细描边 + 极淡填充）
   - 水系/海面区域 path（若有）
   - 不内嵌文字，文字标注仍在运行时由 `CITY_MAPS.landmarks` 渲染

### 6.3 投影函数（运行时，engine.js）

新增纯函数，等距矩形投影（equirectangular，城市尺度下畸变可忽略）：

```js
// projectToMap(lng, lat, bbox) -> { x, y }  // 0-100 百分比坐标
// x = (lng - minLng) / (maxLng - minLng) * 100
// y = (1 - (lat - minLat) / (maxLat - minLat)) * 100   // 纬度翻转
// 按 cos(中心纬度) 修正纵横比，避免城市轮廓被压扁
```

- 预处理与运行时共用同一函数，保证底图与点位严格对齐
- 单测覆盖：bbox 四角映射、纵横比修正、越界输入

### 6.4 活动坐标迁移

- `ACTIVITIES` 每个活动新增 `lng` / `lat` 字段（人工从高德/腾讯地图拾取，一次性录入）
- `MAP_POS` 废弃，点位坐标由 `projectToMap()` 运行时计算
- `CITY_MAPS` 结构升级：`{ bbox, svg: 'assets/maps/sz.svg', landmarks: [...]（改为经纬度）, river 字段废弃 }`

## 7. 渲染层改动（app.js）

`renderMap()` 调整，交互契约不变：

| 元素 | 现状 | 改后 |
|---|---|---|
| 底图 | 虚线框 + 网格线 | `<image>`/内联 SVG 引入真实区划轮廓，网格线移除或极淡化 |
| 水系 | 手绘 river path | 由区划轮廓自带海岸线表达，`river`/`riverName` 字段废弃 |
| 地标 | 手摆坐标 | 改为经纬度，同样走 `projectToMap()` |
| 活动点位 | `MAP_POS` 查表 | `projectToMap(a.lng, a.lat, cityMap.bbox)` |
| 路线/标记/点击跳卡片 | 不变 | 不变 |

**视觉要求**（与 VISUAL_DESIGN.md 一致）：描边与填充从现有色板取色（`--water` / `--lilac` / `--cream` 系），保持"浮在画上的手绘地图"质感，不做成高德式写实风格。

## 8. 导航深链设计

- 点位标记与活动卡片增加「导航」按钮，链接格式：
  `https://uri.amap.com/marker?position={lng},{lat}&name={活动名}&src=weekend-explorer`
- 高德 URI 为公开协议，**无需 API key**；未安装高德 App 时自动回落网页版
- 降级策略：`navigator.onLine === false` 时按钮隐藏；点击后新窗口打开（`target="_blank" rel="noopener"`）
- 文案遵循 VISUAL_DESIGN.md 第 8 节调性：不出现技术词汇，按钮文案如「去这里 →」

## 9. 测试计划

| 类型 | 内容 | 位置 |
|---|---|---|
| 单测 | `projectToMap`：bbox 四角、中心点、纵横比修正、越界裁剪 | `test/engine.test.js` |
| 数据校验测试 | 4 城 bbox 合法（min<max、在中国经纬度范围内）；全部活动 lng/lat 落在所属城市 bbox 内 | `test/engine.test.js` |
| 回归 | 现有 29 个测试不受影响（点位点击跳转等行为不变） | `node --test` |
| 手动验证 | 本地预览 4 城切换，肉眼比对轮廓与点位相对位置（如深圳的深圳湾应在西南） | 本地 http.server |

## 10. 实施步骤

1. 获取并简化 4 城 GeoJSON，生成 `assets/maps/*.svg` 与各城 `bbox`
2. `engine.js` 新增 `projectToMap()` + 单测
3. `data.js`：活动补录 lng/lat、`CITY_MAPS` 结构升级、废弃 `MAP_POS`
4. `app.js`：`renderMap()` 接入新底图与投影；增加导航深链按钮（含断网降级）
5. `styles.css`：底图与导航按钮样式（莫奈色系）
6. 递增 `index.html` 的 `?v=`；`VISUAL_DESIGN.md` 追加更新记录
7. `node --check` × 3 + `node --test` 全绿后 commit；本地预览确认后 push

## 11. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 活动经纬度人工录入错误 | 单测校验"落在所属城市 bbox 内"；本地预览肉眼抽查 |
| GeoJSON 简化后轮廓失真（海岸线锯齿） | 控制简化比例，预览比对；失真则降到 5% |
| GeoAtlas 数据许可 | 仅提取几何轮廓做示意图，不声称精确边界；文档保留数据来源说明 |
| 深链 URI 协议变更 | 按钮为增强功能，失效不影响核心流程；测试中固定 URL 模板便于发现变更 |

## 12. 正式版演进路径（本期不做）

- 触发条件：需要缩放/拖拽交互、实时定位、路径规划（CONCEPTS.route 落地）时
- 切换方案 B：腾讯/高德地图 JS API，key 配置域名白名单 + HTTPS，地图模块懒加载（IntersectionObserver），弱网/断网降级回本期 SVG 示意图
- 本期的 `projectToMap` 与点位数据（lng/lat）可无缝迁移到真实地图坐标系，不浪费
