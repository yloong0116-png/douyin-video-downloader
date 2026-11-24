# 安装

## 1. 装 Userscript 管理器

- Chrome / Edge：[Tampermonkey](https://www.tampermonkey.net/)（推荐）或 [Violentmonkey](https://violentmonkey.github.io/)
- 从商店安装后，浏览器右上角会出现管理器图标

## 2. 装脚本

任选一种：

**A. 从仓库文件安装（推荐，最新）**

1. 打开 `dist/douyin-video-downloader.user.js`
2. 点右上角 **Raw**
3. Tampermonkey 会弹出安装页 → **安装**

**B. 本地文件**

1. 下载 `dist/douyin-video-downloader.user.js`
2. 打开管理器面板 → 「添加新脚本」→ 粘贴全文 → Ctrl+S

## 3. 首次运行

1. 打开 https://www.douyin.com/ 并登录
2. 右下角出现 **⬇** 按钮
3. 点开任意作品 → 点 ⬇ 测试

## 4. 权限确认

首次触发跨域请求时，Tampermonkey 可能提示允许 `@connect`，选择「总是允许」即可。拒绝的话解析接口调不通。

## 5. 卸载

管理器面板 → 找到「Douyin Video Downloader」→ 删除。偏好会随之清除（存在管理器存储里）。
