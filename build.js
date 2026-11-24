/* 零依赖构建：按依赖顺序拼接 src/ → dist/douyin-video-downloader.user.js */
const fs = require('fs'); const path = require('path');
const pkg = require('./package.json');
const ORDER = [
  'src/platform/browser.js',
  'src/storage/preferences.js',
  'src/core/arbiter.js',
  'src/core/resolver.js',
  'src/core/downloader.js',
  'src/adapters/douyin.js',
  'src/ui/panel.js',
  'src/userscript.js'
];
const header = `// ==UserScript==
// @name         Douyin Video Downloader
// @name:zh-CN   抖音视频下载器
// @namespace    https://github.com/yloong0116-png/douyin-video-downloader
// @version      ${pkg.version}
// @description  Save authorized Douyin videos, images, music, covers, avatars and captions
// @author       YG
// @license      MIT
// @match        https://www.douyin.com/*
// @connect      parse.rcuts.com
// @connect      douyin.com
// @connect      douyinpic.com
// @connect      douyinvod.com
// @connect      *
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @run-at       document-idle
// @noframes
// ==/UserScript==

`;
const body = ORDER.map(f => {
  const code = fs.readFileSync(path.join(__dirname, f), 'utf8');
  return '/* ---- ' + f + ' ---- */\n' + code;
}).join('\n');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/douyin-video-downloader.user.js'), header + body, 'utf8');
const size = fs.statSync(path.join(__dirname, 'dist/douyin-video-downloader.user.js')).size;
console.log('built dist/douyin-video-downloader.user.js ' + size + ' bytes v' + pkg.version);
