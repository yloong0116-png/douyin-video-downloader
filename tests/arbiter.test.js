const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helper');

const MODS = ['src/platform/browser.js', 'src/storage/preferences.js', 'src/core/arbiter.js'];

test('单个候选直接采用（详情页 URL）', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([{ id: '11111111', via: 'url:path' }]);
  assert.equal(r.chosen.id, '11111111');
  assert.equal(r.conflict, false);
});

test('两个相同 ID 的不同来源 → 不冲突', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([{ id: '11111111', via: 'url:modal_id' }, { id: '11111111', via: 'video-href' }]);
  assert.equal(r.ids.length, 1);
  assert.equal(r.conflict, false);
});

test('URL 权威 vs DOM 残留 → 采用 URL 并记录分歧', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([
    { id: '22222222', via: 'video-attr' },
    { id: '11111111', via: 'url:modal_id' }
  ]);
  assert.equal(r.chosen.id, '11111111');
  assert.equal(r.chosen.via, 'url:modal_id');
  assert.match(r.note, /dom-disagrees:22222222/);
  assert.equal(r.conflict, false);
});

test('浮层播放器权威 vs 背景 feed → 采用浮层', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([
    { id: '33333333', via: 'feed-active-video' },
    { id: '44444444', via: 'dialog-video' }
  ]);
  assert.equal(r.chosen.id, '44444444');
  assert.equal(r.conflict, false);
});

test('无权威来源 + 两个不同 ID → 拒绝（不猜）', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([
    { id: '55555555', via: 'video-attr' },
    { id: '66666666', via: 'recent-click' }
  ]);
  assert.equal(r.chosen, null);
  assert.equal(r.conflict, true);
  assert.match(r.note, /multi:/);
});

test('空候选 → 拒绝且不崩溃', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([]);
  assert.equal(r.chosen, null);
  assert.equal(r.ids.length, 0);
});

test('候选缺 id 字段被过滤', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([{ via: 'url:path' }, null, { id: '77777777', via: 'video-href' }]);
  assert.equal(r.chosen.id, '77777777');
});

test('推荐流活动项 + 点击上下文同 ID → 采用活动项', () => {
  const DVD = load(MODS);
  const r = DVD.arbiter.decide([
    { id: '88888888', via: 'recent-click' },
    { id: '88888888', via: 'feed-active-video' }
  ]);
  assert.equal(r.chosen.via, 'feed-active-video');
});
