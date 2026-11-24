# Douyin Video Downloader

一个**独立**的浏览器 Userscript：在抖音网页版里保存你**有权访问**的作品资源。

从 [Douyin Web Desktop](https://github.com/yloong0116-png/douyin-web-desktop) 的下载模块拆出，不再依赖任何桌面启动器、Node.js 或 Playwright —— 装个 Userscript 管理器就能用。

> 第三方工具，与抖音官方无任何隶属或合作关系。请遵守平台规则与内容权利人的授权范围。

## 功能

- 六类资源可勾选：视频/图文、背景音乐、视频封面、音乐封面、作者头像、视频文案
- 默认只勾「视频/图文」，其余默认关闭；默认值可保存、可一键恢复
- 跨页面识别当前作品：详情页、个人主页浮层、搜索页、关注页、朋友页、收藏/历史
- 识别不到就**明确拒绝**，不会拿上一个作品的 ID 凑数
- 任务级冻结：点「开始下载」那一刻锁定作品，之后切视频也不会串

## 环境要求

| 项 | 要求 |
|---|---|
| 浏览器 | Chrome / Edge 88+（需要支持 ES2018 与 fetch） |
| Userscript 管理器 | Tampermonkey 或 Violentmonkey（推荐 Tampermonkey） |
| 账号 | 能正常访问 douyin.com 的账号（未登录状态下多数页面无法识别作品） |

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/)（或 Violentmonkey）
2. 打开本仓库的 `dist/douyin-video-downloader.user.js`
3. 点「Raw」，管理器会弹出安装页 → 确认安装
4. 打开 https://www.douyin.com/ ，右下角会出现 **⬇** 按钮

详细步骤见 [docs/INSTALL.md](docs/INSTALL.md)。

## 首次使用

1. 打开任意一个作品（推荐页、个人主页点开、搜索结果点开都行）
2. 点右下角 ⬇ → 弹出资源面板
3. 勾选需要的资源 → 「开始下载」

面板上的齿轮是**默认设置**：改完点「保存默认选项」，下次打开面板就用这套勾选。

## 六类资源

| 标识 | 内容 | 说明 |
|---|---|---|
| `media` | 视频 / 图文 | 多图作品会存成 `_01.jpg`、`_02.jpg`… |
| `music` | 背景音乐 | 原声 mp3 |
| `cover` | 视频封面 | |
| `music_cover` | 音乐封面 | |
| `avatar` | 作者头像 | |
| `text` | 视频文案 | 存成 `.txt` |

文件命名：`<清洗后的标题>_<时间戳>` + 可选序号/后缀 + 扩展名。

## 文件存在哪

**Userscript 不能指定任意磁盘路径**（浏览器沙箱限制）。文件会进入浏览器的下载目录：

- Chrome 默认：`%USERPROFILE%\Downloads`
- 可在浏览器设置里改，或在 Tampermonkey 设置里给 `GM_download` 指定子目录

这一点和桌面版不同（桌面版能直接写 `D:\Media\Douyin`）。

## 配置

偏好保存在 Userscript 管理器里（`GM_setValue`），没有管理器时回退 `localStorage`（键前缀 `dvd:`）。

| 键 | 类型 | 默认 |
|---|---|---|
| `prefs` | object | `{media:true, 其余 false}` |

## 常见问题

见 [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)。

## 已知限制

- **解析接口是第三方服务**（`parse.rcuts.com`），它失效则下载功能整体不可用，本项目无法修复。
- 抖音改版可能导致作品识别失败；改版时只需改 `src/adapters/douyin.js`。
- 未登录状态下多数页面拿不到作品标识，会提示「无法确定当前作品」。
- 不处理付费/权限受限/DRM 内容。

## 开发

```bash
npm run build     # 拼接 src/ → dist/*.user.js
npm test          # 跑核心逻辑单元测试
```

架构与模块边界见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)，依赖审计见 [docs/DEPENDENCY_AUDIT.md](docs/DEPENDENCY_AUDIT.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。

## 免责声明

本项目仅用于保存你拥有权利或已获授权的内容。使用者需自行遵守所在地法律、抖音平台规则以及内容权利人的授权要求。作者不对因使用本工具产生的任何后果负责。
