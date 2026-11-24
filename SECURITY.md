# Security

- 本项目不收集、不上传任何用户数据；偏好只存在本地（`GM_setValue` / `localStorage`）
- 唯一的出站请求是第三方解析接口 `parse.rcuts.com`，用于把作品 ID 换成直链
- 不接受来自 URL 参数或页面的可执行内容
- 发现安全问题请开 issue（不要在 issue 里贴 Cookie 或 token）

## 权限说明（userscript header）

| 权限 | 用途 |
|---|---|
| `GM_setValue` / `GM_getValue` | 存六类勾选偏好 |
| `GM_xmlhttpRequest` | 调解析接口、跨域取资源 |
| `GM_download` | 把文件交给浏览器下载 |
| `@connect *` | 资源直链域名不固定，需要通配（可自行收窄） |
