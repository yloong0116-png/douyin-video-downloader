# FINAL REPORT — douyin-video-downloader 0.1.0

日期：2026-11-25　状态：源码独立完成、测试通过、已推私有仓库；**未公开发布、未建 Release**。

## 1. 原始模块依赖关系

`16-save-video.js` v3.3（`8b13f7d0…`，17,953 B）在桌面版里依赖三类宿主能力：

| 依赖 | 提供方 | 用途 |
|---|---|---|
| `window.__DY_PREFS` | `launcher.js` `addInitScript` | 初始偏好 |
| `window.__dySetPrefs(json)` | `ctx.exposeBinding` | 保存默认勾选 |
| `window.__dySave(json)` | `ctx.exposeBinding` | 下载（Node 侧写盘） |

其余全部是页面内逻辑（DOM 采集、裁决、面板），无 launcher 耦合。

## 2. 解耦方案

| 原能力 | 新实现 |
|---|---|
| 初始偏好 | `storage.load()` ← `GM_getValue`，回退 `localStorage['dvd:prefs']` |
| 保存默认 | `storage.save(obj)` |
| 下载写盘 | `downloader.start(task)` → `GM_download`，回退 `blob + a[download]` |
| Node 侧 fetch 解析 | `GM_xmlhttpRequest`（可跨域），回退 `fetch` |
| 裁决逻辑（内联在 resolveCurrent） | 抽成 `core/arbiter.js` 纯函数 |

## 3. 实际拆分的文件

```
src/platform/browser.js   平台能力（唯一区分管理器 API 的地方）
src/storage/preferences.js 六类偏好
src/core/arbiter.js        裁决纯函数（PRI + 冲突拒绝）
src/core/resolver.js       任务快照冻结
src/core/downloader.js     解析 → 组装 → 落盘
src/adapters/douyin.js     DOM 采集（改版只改这里）
src/ui/panel.js            面板与勾选（原 UI 代码原样搬入）
src/userscript.js          入口
build.js                   零依赖拼接构建
tests/                     4 个测试文件 + helper
```

## 4. 新旧代码差异

- **UI 代码零重写**：面板、勾选、保存默认、恢复默认、toast/flash 全部由原文件切片生成，只替换了 4 处宿主接口调用。
- **裁决逻辑外移**：原 `resolveCurrent` 末尾的 PRI/冲突段替换为 `DVD.arbiter.decide(out.candidates)`，采集部分逐字保留。
- **下载改为浏览器侧**：新增 `downloader.js`（移植桌面版 `__dySave` 的流程与校验），保存改走 `GM_download`。
- **命名规则、六类资源、质量升级、id 二次校验**：全部保留。

## 5. 作品识别机制是否完整保留

**是，两处 v3.3 修复逐字保留：**

1. 残留 `data-e2e-vid`：`hostOf()` 优先 `<a href="/video/…">`，属性冲突记 `attr-stale` 并采用 href。
2. 点击上下文跨路由：`lastClick` 带 `pathname`，路由一变即清空；无 URL 标识且无浮层时只接受「正在播放 + 30% 可见」的播放器。

其余保留项：URL 三来源（path/modal_id/vid）、浮层作用域（仅含 video 的可见浮层）、活动项可见性校验、冲突拒绝、无候选拒绝。

## 6. 六类资源测试结果

| 项 | 结果 | 级别 |
|---|---|---|
| `buildJob` 组装（六类全勾 → 5 个 job + 文案单独） | 通过 | 单元测试 |
| 图文按图片数量展开、按 index 排序 | 通过 | 单元测试 |
| 只勾 media 时只出 1 个任务 | 通过 | 单元测试 |
| 扩展名推断 / 标题清洗 / 最高画质 | 通过 | 单元测试 |
| **真实逐项下载** | **未做** | 未验证 |

## 7. 不同页面测试结果

**未在新项目重跑**。原桌面版 2026-11-25 做过矩阵：详情页、他人主页浮层、自己主页浮层、搜索浮层锁定正确，无作品页正确拒绝；关注页/朋友页由用户确认。本独立版沿用同一套采集代码，但**没有独立复测**，不得写成已通过。

## 8. 浏览器兼容性

- 构建产物 header 合法、模块顺序正确（构建测试覆盖）
- **Chrome + Tampermonkey 实测安装：未做**
- Violentmonkey：未做
- 回退路径（无管理器时用 `fetch`/`localStorage`）：代码存在，未实测

## 9. 许可证审查

- 自有代码：MIT（Copyright 2026 YG），与作者其他项目一致
- 依赖：**零第三方代码**（无 npm 依赖、无第三方脚本复制）
- 未包含抖音官方代码或资源
- 未包含用户数据、Cookie、Token、个人路径（工作树与 git 历史双向扫描均为 0 命中）

## 10. Git commit

`0af333ae013095dad623bd59cb1a08f3e7ce751c`（main，30 个文件）

## 11. GitHub 仓库

https://github.com/yloong0116-png/douyin-video-downloader

## 12. 仓库可见性

**Private**（按要求，未经确认不公开）

## 13. Release

**未创建**。发布条件里「真实下载验证」「真实环境安装验证」未完成，因此不满足发首个 Release 的门槛。

## 14. 未完成事项

1. 六类资源逐项真实下载（需登录账号与授权内容）
2. Tampermonkey / Violentmonkey 真实安装与运行
3. 13 类页面的独立识别矩阵复测
4. 解析接口失效时的降级提示（目前只打控制台）

## 15. 已知问题

- 下载目录无法指定（浏览器限制），与桌面版的 `D:\Media\Douyin` 行为不同，已在 README 说明
- 解析依赖第三方 `parse.rcuts.com`
- 抖音改版会导致 `adapters/douyin.js` 失效

## 16. 如何继续开发

1. 改选择器 → 只动 `src/adapters/douyin.js`
2. 改裁决规则 → 动 `src/core/arbiter.js` + 同步 `tests/arbiter.test.js`
3. 新增资源类型 → `storage/preferences.js` 的 KEYS + `ui/panel.js` 的 OPTS + `downloader.buildJob`
4. 每次改完 `npm run test:build`
5. 提交前 `git status` 确认没有把 `node_modules`、日志、截图带进去

工作方式见 `CONTRIBUTING.md`。
