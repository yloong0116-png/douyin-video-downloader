# CHANGELOG

## 0.1.0 — 2026-11-25

从 `douyin-web-desktop` 的 `16-save-video.js` v3.3 独立拆分。

### 保留的行为
- 六类资源勾选、默认只勾视频/图文、默认值可保存与恢复
- 跨页面作品识别与任务级冻结
- v3.3 的两处串号修复：推荐流容器残留 `data-e2e-vid`、点击上下文跨路由存活

### 解耦改动
- 移除对 `window.__DY_PREFS` / `__dySetPrefs` / `__dySave` 的依赖，改为内置 storage + downloader
- 裁决逻辑抽成 `src/core/arbiter.js` 纯函数，可单元测试
- DOM 采集收敛到 `src/adapters/douyin.js`，改版只改这一层
- 保存走 `GM_download`，回退 blob 下载（不再依赖 Playwright 绑定）

### 已知差异
- 无法指定绝对下载目录（浏览器限制），文件进浏览器下载目录
