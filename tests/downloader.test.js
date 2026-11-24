const test = require('node:test');
const assert = require('node:assert');
const { load } = require('./helper');

const MODS = ['src/platform/browser.js', 'src/storage/preferences.js', 'src/core/arbiter.js', 'src/core/downloader.js'];

test('标题清洗：非法字符替换、超长截断', () => {
  const DVD = load(MODS);
  assert.equal(DVD.downloader.sanitize('a/b:c*d?e"f<g>h|i'), 'a b c d e f g h i');
  assert.equal(DVD.downloader.sanitize('  x   y  '), 'x y');
  assert.equal(DVD.downloader.sanitize('测'.repeat(100)).length, 60);
});

test('扩展名推断', () => {
  const DVD = load(MODS);
  assert.equal(DVD.downloader.extOf('https://x/a.jpeg?b=1'), '.jpg');
  assert.equal(DVD.downloader.extOf('https://x/a.webp'), '.webp');
  assert.equal(DVD.downloader.extOf('https://x/a'), '.jpg');
});

test('最高画质取列表首个', () => {
  const DVD = load(MODS);
  assert.equal(DVD.downloader.topQuality('1080p|720p|540p'), '1080p');
  assert.equal(DVD.downloader.topQuality(''), '');
});

test('六类资源全部勾选时组装出 5 个任务 + 文案单独处理', () => {
  const DVD = load(MODS);
  const data = {
    type: 'video', id: '1', title: 't', video: 'https://v/1.mp4', cover: 'https://c/1.jpg',
    music: { url: 'https://m/1.mp3', cover: 'https://mc/1.jpg' },
    author: { avatar: 'https://a/1.jpg' }, medias: []
  };
  const job = DVD.downloader.buildJob(data, { selected: ['media', 'music', 'cover', 'music_cover', 'avatar', 'text'] });
  assert.deepEqual(job.map(j => j.k).sort(), ['avatar', 'cover', 'media', 'music', 'music_cover']);
});

test('图文作品按图片数量展开', () => {
  const DVD = load(MODS);
  const data = { type: 'image', medias: [{ type: 'image', url: 'https://i/3.jpg', index: 3 }, { type: 'image', url: 'https://i/1.jpg', index: 1 }] };
  const job = DVD.downloader.buildJob(data, { selected: ['media'] });
  assert.equal(job.length, 2);
  assert.equal(job[0].url, 'https://i/1.jpg');
  assert.equal(job[0].seq, 1);
});

test('只勾 media 且作品是视频 → 只有一个任务', () => {
  const DVD = load(MODS);
  const data = { type: 'video', video: 'https://v/1.mp4', music: { url: 'https://m/1.mp3' } };
  const job = DVD.downloader.buildJob(data, { selected: ['media'] });
  assert.equal(job.length, 1);
  assert.equal(job[0].ext, '.mp4');
});
