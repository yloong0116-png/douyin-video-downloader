# 配置

## 偏好存储位置

| 环境 | 位置 |
|---|---|
| Tampermonkey | 脚本存储区（`GM_setValue`，键 `prefs`） |
| Violentmonkey | 同上 |
| 无管理器（回退） | `localStorage['dvd:prefs']` |

## 结构

```json
{ "media": true, "music": false, "cover": false, "music_cover": false, "avatar": false, "text": false }
```

| 键 | 含义 | 默认 |
|---|---|---|
| media | 视频 / 图文（多图作品存多张） | true |
| music | 背景音乐 mp3 | false |
| cover | 视频封面 | false |
| music_cover | 音乐封面 | false |
| avatar | 作者头像 | false |
| text | 视频文案 `.txt` | false |

## 面板操作

- 面板里的勾选**只影响本次**，不改变默认
- 齿轮 → 「保存默认选项」才写入存储
- 「恢复默认」把默认重置为「只勾视频/图文」

## 下载目录

由浏览器决定，脚本无法指定（见 README「文件存在哪」）。
