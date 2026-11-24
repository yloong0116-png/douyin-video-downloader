# 测试

## 自动化（本仓库自带）

```bash
npm test
```

| 测试文件 | 覆盖 |
|---|---|
| `tests/arbiter.test.js` | 单候选、多候选、URL 权威、浮层权威、冲突拒绝、空候选 |
| `tests/preferences.test.js` | 默认值、部分字段、非法值回退、保存后读回 |
| `tests/downloader.test.js` | 命名清洗、扩展名推断、多图序号、最高画质解析 |
| `tests/build.test.js` | 构建产物存在、header 合法、模块顺序正确 |

## 真实验证（本仓库未完成）

以下项目**没有**在新项目中独立跑过，不能算通过：

- 六类资源逐项真实下载（需要登录账号与授权内容）
- Tampermonkey / Violentmonkey 双环境安装实测
- 13 类页面的识别矩阵（原桌面版做过，见桌面版仓库的 TESTING.md）

要补真实验证，按 `docs/USER_GUIDE.md` 手动走一遍，把结果追加到本文件。
