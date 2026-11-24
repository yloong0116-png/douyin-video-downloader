# 依赖审计

源文件：`16-save-video.js` v3.3（SHA-256 `8b13f7d07998b71b1942d85de3ecd949cf0cb924fab652ab2bd7356ae109af28`，17,953 B）

## 1. 调用链（原项目）

```
launcher.js
  ├─ ctx.addInitScript(window.__DY_PREFS = {...})      ← 注入初始偏好
  ├─ ctx.exposeBinding('__dySetPrefs')                  ← 面板「保存默认」
  └─ ctx.exposeBinding('__dySave')                      ← 面板「开始下载」
        ↓
16-save-video.js
  ├─ openPanel() → resolveCurrent() → 冻结 snap
  ├─ buildPanel() / buildSettings()  ← 纯 DOM
  └─ 点下载 → JSON.stringify(snap) → window.__dySave(payload)
        ↓
launcher.js __dySave
  ├─ POST parse.rcuts.com/v1/parse
  ├─ 校验返回 id === 快照 id
  ├─ 组装 job（media/music/cover/music_cover/avatar）
  ├─ fs 写盘到 SAVE_DIR
  └─ 文案写 .txt
```

## 2. 依赖分类

### A. 可直接独立使用

| 代码 | 说明 |
|---|---|
| `resolveCurrent()` 采集逻辑 | 只读 DOM/URL |
| `area / onScreen / dialogScope / hostOf / attrsOf / urlIds` | 纯 DOM 读取 |
| `descOf()` | 读页面文案 |
| 面板 DOM 与样式（`buildPanel / buildSettings / row / mkBtn / toast / flash`） | 纯 DOM |
| 六类 OPTS 定义与勾选读写 | 纯 DOM |
| 裁决规则（PRI + 冲突判定） | 纯逻辑，已抽成 `core/arbiter.js` |

### B. 需要重构接口

| 原依赖 | 原用途 | 新实现 |
|---|---|---|
| `window.__DY_PREFS` | 初始偏好 | `storage.load()` ← `GM_getValue` / `localStorage` |
| `window.__dySetPrefs(json)` | 保存默认 | `storage.save(obj)` |
| `window.__dySave(json)` | 执行下载（Node 侧） | `downloader.start(task)`（浏览器侧，GM_download） |
| `fs.writeFileSync(SAVE_DIR)` | 写盘到指定目录 | `GM_download`（无法指定绝对路径，浏览器限制） |
| `fetch(parse API)`（Node 侧，无 CORS） | 解析 | `GM_xmlhttpRequest`（可跨域），回退 `fetch` |

### C. 必须由宿主（管理器/浏览器）提供

| 能力 | 提供方 | 缺失时的降级 |
|---|---|---|
| 跨域请求 | `GM_xmlhttpRequest` | `fetch`（受 CORS 限制，可能失败） |
| 文件保存 | `GM_download` | `blob` + `a[download]` |
| 偏好持久化 | `GM_setValue` | `localStorage` |

### D. 与下载无关、已舍弃

- launcher 的窗口/导航/日志/单实例
- 其余 userscript（导航隐藏、全屏、SmartFeed、DouyInPlus）
- Playwright 与 Chromium 打包
- `save-core.js`（Node 侧工具函数）

## 3. 解耦后的模块边界

```
userscript.js          入口：启动面板
  ├─ platform/browser  唯一区分「浏览器 API vs 管理器 API」的地方
  ├─ storage/preferences  六类偏好
  ├─ core/arbiter      纯函数裁决（可测）
  ├─ core/resolver     任务快照冻结
  ├─ core/downloader   解析 → 组装 → 落盘
  ├─ adapters/douyin   DOM 采集（改版只改这里）
  └─ ui/panel          面板与勾选
```

## 4. 保留的两处 v3.3 修复

1. **残留 `data-e2e-vid`**：`hostOf()` 优先取 `<a href="/video/…">`（渲染态），属性与之冲突记 `attr-stale` 并采用 href。
2. **点击上下文跨路由**：`lastClick` 带 `pathname`，`resolveCurrent()` 发现路由变化即清空；且无 URL 标识、无浮层时只接受「正在播放且可见」的播放器。

两处在独立版中均逐字保留，未简化。
