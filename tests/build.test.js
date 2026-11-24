const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist', 'douyin-video-downloader.user.js');

test('构建产物存在', () => {
  assert.ok(fs.existsSync(DIST), '先运行 npm run build');
});

test('userscript header 合法', () => {
  const s = fs.readFileSync(DIST, 'utf8');
  assert.match(s, /^\/\/ ==UserScript==/);
  assert.match(s, /@name\s+Douyin Video Downloader/);
  assert.match(s, /@match\s+https:\/\/www\.douyin\.com\/\*/);
  assert.match(s, /@grant\s+GM_download/);
  assert.match(s, /\/\/ ==\/UserScript==/);
});

test('模块按依赖顺序拼接', () => {
  const s = fs.readFileSync(DIST, 'utf8');
  const order = ['src/platform/browser.js', 'src/storage/preferences.js', 'src/core/arbiter.js', 'src/core/resolver.js', 'src/core/downloader.js', 'src/adapters/douyin.js', 'src/ui/panel.js', 'src/userscript.js'];
  let last = -1;
  for (const m of order) {
    const i = s.indexOf('/* ---- ' + m + ' ---- */');
    assert.ok(i > last, m + ' 顺序错误或缺失');
    last = i;
  }
});

test('产物中不含宿主私有依赖', () => {
  const s = fs.readFileSync(DIST, 'utf8');
  assert.equal(s.includes('__dySave'), false);
  assert.equal(s.includes('__dySetPrefs'), false);
  assert.equal(s.includes('__DY_PREFS'), false);
});
