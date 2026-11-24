# 功能清单

| 功能 | 状态 | 位置 |
|---|---|---|
| 下载面板挂载（右下 ⬇） | 已实现，本机实测 | src/ui/panel.js |
| 六类资源勾选 | 已实现 | src/ui/panel.js |
| 默认只勾视频/图文 | 已实现，单元测试覆盖 | src/storage/preferences.js |
| 默认值保存 / 恢复默认 | 已实现 | src/ui/panel.js + storage |
| 跨页面作品识别 | 已实现 | src/adapters/douyin.js |
| 冲突拒绝 / 无法识别拒绝 | 已实现，单元测试覆盖 | src/core/arbiter.js |
| 任务级冻结 | 已实现 | src/core/resolver.js |
| 解析 → 组装 → 落盘 | 已实现 | src/core/downloader.js |
| 文案 .txt | 已实现 | src/core/downloader.js |
| 多图作品序号命名 | 已实现 | src/core/downloader.js |

## 未验证（不得当作通过）

- 六类资源**逐项真实下载**（本仓库只做了构建与单元测试，未在真实账号下逐项跑）
- Tampermonkey / Violentmonkey 双环境实测（只在构建层面确认 header 合法）
- 抖音改版后的选择器有效性

> 原桌面版在 2026-11-25 做过页面识别矩阵实测（详情页/主页浮层/搜索浮层/无作品页），结论记录在桌面版仓库；本独立版沿用同一套识别代码，但**未独立重跑该矩阵**。
