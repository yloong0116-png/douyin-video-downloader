# Contributing

1. 改抖音 DOM 相关逻辑只动 `src/adapters/douyin.js`，不要把选择器散到别处
2. 裁决规则改动必须同步更新 `tests/arbiter.test.js`，并说明为什么原有规则不成立
3. 提交前跑 `npm run test:build`
4. 不要引入构建依赖（本项目零依赖，`build.js` 只做字符串拼接）

## 调试

- 面板按钮打印的日志都以 `[DVD]` 开头
- 想验证候选来源，在 `resolveCurrent` 返回处打 `console.log(r.ids, r.note)`
