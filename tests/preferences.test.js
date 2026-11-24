const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helper');

const MODS = ['src/platform/browser.js', 'src/storage/preferences.js'];

test('默认只勾 media', () => {
  const DVD = load(MODS);
  const p = DVD.storage.load();
  assert.equal(p.media, true);
  assert.deepEqual(['music', 'cover', 'music_cover', 'avatar', 'text'].map(k => p[k]), [false, false, false, false, false]);
});

test('部分字段缺失时回退默认', () => {
  const DVD = load(MODS);
  DVD.storage.save({ media: false });
  const p = DVD.storage.load();
  assert.equal(p.media, false);
  assert.equal(p.music, false);
  assert.equal(p.text, false);
});

test('非法类型回退默认', () => {
  const DVD = load(MODS);
  DVD.storage.save({ media: 'yes', music: 1, cover: true });
  const p = DVD.storage.load();
  assert.equal(p.media, true);
  assert.equal(p.music, false);
  assert.equal(p.cover, true);
});

test('保存后可读回（持久化）', () => {
  const DVD = load(MODS);
  DVD.storage.save({ media: true, music: true, cover: true, music_cover: true, avatar: true, text: true });
  const p = DVD.storage.load();
  assert.deepEqual(Object.values(p), [true, true, true, true, true, true]);
});
