# 注意事项

- 每次改动完成后，都必须创建一个对应的 Git commit，以便后续追踪和回滚。
- 每次改动后，都必须编写或更新相关测试，并在交付给用户前，确保所有测试和验证全部通过。

# 开发工作流

## 本地预览优先

- 改代码时优先使用本地预览，不要每次都 push 等 GitHub Pages 构建：
  - 启动：`python -m http.server 8000 --bind 127.0.0.1`（后台运行）
  - 访问：`http://127.0.0.1:8000`
  - 改完保存后浏览器按 F5 即可看到效果；如遇缓存，按 F12 → Network → 勾选 Disable cache
- 本地确认满意后，再批量 `git push origin main` 发布到 GitHub Pages（线上地址：https://muggle0408.github.io/weekend-explorer/）。

## 测试与验证

- 纯逻辑集中在 `engine.js`（推荐打分、周期日期、NL 解析、时段编排、ICS 导出），单元测试在 `test/engine.test.js`；交互回归测试在 `tests/filters.test.js`。
- 每次改动后执行：`node --check app.js && node --check engine.js && node --check data.js && node --test`（注意：`node --test` 不带目录参数，Windows 下传目录会误报失败）。
- 所有测试通过后才创建 commit。

## 版本号与缓存

- 每次改动 `styles.css` / `data.js` / `engine.js` / `app.js` 后，同步递增 `index.html` 中的 `?v=` 版本号参数，防止浏览器缓存旧资源。

## 技术约束

- 纯静态前端，不引入 npm 依赖、构建工具或外部运行时 API（保持断网可演示）。
- 新增可测逻辑时，写成 `engine.js` 中的纯函数（UMD：浏览器挂 `window.WW_ENGINE`，Node 走 `module.exports`），并补充对应单测。
