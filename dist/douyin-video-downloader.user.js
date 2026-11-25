// ==UserScript==
// @name         Douyin Video Downloader
// @name:zh-CN   抖音视频下载器
// @namespace    https://github.com/yloong0116-png/douyin-video-downloader
// @version      0.1.1
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

/* ---- src/platform/browser.js ---- */
/* 平台能力层：只在这里区分浏览器原生 API 与 Userscript 管理器 API */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};
  var hasGM = typeof GM_setValue === 'function';

  DVD.platform = {
    get: function (k, dflt) {
      try {
        if (hasGM) { var v = GM_getValue(k); return v === undefined ? dflt : v; }
        var raw = localStorage.getItem('dvd:' + k);
        return raw === null ? dflt : JSON.parse(raw);
      } catch (e) { return dflt; }
    },
    set: function (k, v) {
      try {
        if (hasGM) { GM_setValue(k, v); return true; }
        localStorage.setItem('dvd:' + k, JSON.stringify(v)); return true;
      } catch (e) { return false; }
    },
    /* 优先 GM_xmlhttpRequest（可跨域），回退 fetch */
    request: function (opt) {
      return new Promise(function (resolve, reject) {
        if (typeof GM_xmlhttpRequest === 'function') {
          GM_xmlhttpRequest({
            method: opt.method || 'GET', url: opt.url,
            headers: opt.headers || {}, data: opt.body,
            timeout: opt.timeout || 20000,
            onload: function (r) { resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, text: r.responseText }); },
            onerror: function () { reject(new Error('network')); },
            ontimeout: function () { reject(new Error('timeout')); }
          });
          return;
        }
        fetch(opt.url, { method: opt.method || 'GET', headers: opt.headers || {}, body: opt.body })
          .then(function (r) { return r.text().then(function (t) { resolve({ ok: r.ok, status: r.status, text: t }); }); })
          .catch(reject);
      });
    },
    /* 保存二进制：优先 GM_download（进下载管理器），回退 blob + a[download] */
    saveBlob: function (url, filename, referer) {
      return new Promise(function (resolve, reject) {
        if (typeof GM_download === 'function') {
          GM_download({
            url: url, name: filename, saveAs: false,
            headers: referer ? { Referer: referer } : undefined,
            onload: function () { resolve(filename); },
            onerror: function (e) { reject(new Error('download: ' + (e && e.error) )); },
            ontimeout: function () { reject(new Error('download timeout')); }
          });
          return;
        }
        fetch(url, { headers: referer ? { Referer: referer } : {} })
          .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.blob(); })
          .then(function (b) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(b); a.download = filename;
            document.body.appendChild(a); a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
            resolve(filename);
          })
          .catch(reject);
      });
    }
  };
})(window);

/* ---- src/storage/preferences.js ---- */
/* 六类资源偏好：默认只勾 media，其余 false */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};
  var KEY = 'prefs';
  var DEFAULTS = { media: true, music: false, cover: false, music_cover: false, avatar: false, text: false };
  var KEYS = ['media', 'music', 'cover', 'music_cover', 'avatar', 'text'];

  function normalize(o) {
    var out = {};
    KEYS.forEach(function (k) { out[k] = (o && typeof o[k] === 'boolean') ? o[k] : DEFAULTS[k]; });
    return out;
  }

  DVD.storage = {
    KEYS: KEYS,
    DEFAULTS: DEFAULTS,
    normalize: normalize,
    load: function () { return normalize(DVD.platform.get(KEY, null)); },
    save: function (o) { return DVD.platform.set(KEY, normalize(o)); }
  };
})(window);

/* ---- src/core/arbiter.js ---- */
/* 作品 ID 仲裁：纯函数，无 DOM 依赖，可直接单元测试。
 * 规则（v3.3 保留）：
 *  - 候选必须来自不同来源，按可信度排序
 *  - URL 显式标识（path / modal_id / vid）与浮层播放器有裁决权
 *  - 无权威来源且候选互相矛盾 → 拒绝，绝不回退旧上下文
 */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};

  var PRI = {
    'url:path': 100, 'url:modal_id': 96, 'url:vid': 94,
    'dialog-video': 92, 'feed-active-video': 85,
    'video-href': 70, 'video-attr': 65, 'recent-click': 30
  };

  function decide(candidates) {
    var list = (candidates || []).filter(function (c) { return c && c.id; });
    var ids = [];
    list.forEach(function (c) { if (ids.indexOf(c.id) < 0) ids.push(c.id); });

    var ranked = list.slice().sort(function (a, b) { return (PRI[b.via] || 0) - (PRI[a.via] || 0); });
    var top = ranked[0];
    var out = { ids: ids, chosen: null, conflict: false, note: '' };

    if (ids.length === 1) {
      out.chosen = { id: ids[0], via: (top && top.via) || 'single' };
      return out;
    }
    if (ids.length === 0) return out;

    var authoritative = top && (top.via.indexOf('url:') === 0 || top.via === 'dialog-video');
    if (authoritative) {
      out.chosen = { id: top.id, via: top.via };
      var others = ids.filter(function (x) { return x !== top.id; });
      if (others.length) out.note = 'dom-disagrees:' + others.join(',');
      return out;
    }
    out.conflict = true;
    out.note = 'multi:' + ids.join(',');
    return out;
  }

  DVD.arbiter = { decide: decide, PRIORITY: PRI };
})(window);

/* ---- src/core/resolver.js ---- */
/* 作品上下文对外接口：冻结一次任务的作品信息，落盘前不再变化 */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};

  function snapshot(r, descOf) {
    if (!r || !r.chosen) return null;
    return Object.freeze({
      taskId: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      awemeId: String(r.chosen.id),
      via: r.chosen.via,
      page: r.page || location.pathname,
      pageUrl: location.href,
      title: descOf ? descOf(r.bestEl) : '',
      capturedAt: Date.now()
    });
  }

  DVD.resolver = { snapshot: snapshot };
})(window);

/* ---- src/core/downloader.js ---- */
/* 下载引擎：解析 → 组装任务 → 落盘。任务绑定在 snapshot 上，不受页面切换影响。 */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};
  var API = 'https://parse.rcuts.com:8443/v1/parse';
  var UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 aweme_8.3.1 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/zh Region/CN';

  function sanitize(s) {
    return String(s || '').replace(/[\\/:*?"<>|\r\n\t]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  }
  function extOf(u) {
    var m = String(u).split('?')[0].match(/\.(jpe?g|png|webp|gif)$/i);
    return m ? '.' + m[1].toLowerCase().replace('jpeg', 'jpg') : '.jpg';
  }
  function stamp() { return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14); }
  function topQuality(q) { return String(q || '').split('|').map(function (x) { return x.trim(); }).filter(Boolean)[0] || ''; }

  function parse(id, quality) {
    return DVD.platform.request({
      method: 'POST', url: API,
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ url: 'https://www.douyin.com/video/' + id, sv: '1', client: 'ios-shortcut', quality: quality || 'all' }),
      timeout: 20000
    }).then(function (r) {
      var j = null;
      try { j = JSON.parse(r.text); } catch (e) {}
      if (!j) return { err: 'invalid json' };
      if (j.code !== 0 || !j.data) return { err: 'code=' + j.code + ' ' + (j.msg || '') };
      return { data: j.data };
    });
  }

  function buildJob(d, snap) {
    var sel = snap.selected || [];
    var job = [];
    var type = String(d.type || '').toLowerCase();
    var seen = Object.create(null);
    var imgs = (d.medias || []).filter(function (m) { return m && m.type === 'image' && m.url; })
      .map(function (m, i) { return { url: m.url, index: typeof m.index === 'number' ? m.index : i }; })
      .sort(function (a, b) { return a.index - b.index; })
      .filter(function (m) { return seen[m.url] ? false : (seen[m.url] = 1, true); });

    if (sel.indexOf('media') >= 0) {
      if (type !== 'video' && imgs.length) imgs.forEach(function (m, i) { job.push({ k: 'media', url: m.url, ext: '.jpg', seq: i + 1 }); });
      else {
        var v = d.video || ((d.medias || [])[0] && d.medias[0].url) || '';
        if (v) job.push({ k: 'media', url: v, ext: '.mp4', seq: 0 });
      }
    }
    var musicUrl = (d.music && d.music.url) || d.audio || '';
    if (sel.indexOf('music') >= 0 && musicUrl) job.push({ k: 'music', url: musicUrl, ext: '.mp3', seq: 0 });
    if (sel.indexOf('cover') >= 0 && d.cover) job.push({ k: 'cover', url: d.cover, ext: extOf(d.cover), tag: '_cover', seq: 0 });
    var mc = (d.music && d.music.cover) || '';
    if (sel.indexOf('music_cover') >= 0 && mc) job.push({ k: 'music_cover', url: mc, ext: extOf(mc), tag: '_music_cover', seq: 0 });
    var av = (d.author && d.author.avatar) || '';
    if (sel.indexOf('avatar') >= 0 && av) job.push({ k: 'avatar', url: av, ext: extOf(av), tag: '_avatar', seq: 0 });
    return job;
  }

  function start(task) {
    var T = '[DVD] task=' + task.taskId;
    console.log(T + ' start id=' + task.awemeId + ' via=' + task.via + ' selected=' + (task.selected || []).join(','));
    return parse(task.awemeId, 'all').then(function (r) {
      if (r.err) { console.warn(T + ' parse failed: ' + r.err); return { ok: false, err: r.err }; }
      var d = r.data;
      var got = String(d.id || '');
      if (got && got !== task.awemeId) { console.warn(T + ' ABORT id mismatch ' + got); return { ok: false, err: 'id mismatch' }; }

      var q = topQuality(d.quality_list);
      var p = (q && d.quality !== q) ? parse(task.awemeId, q).then(function (r2) {
        return (!r2.err && String(r2.data.id || '') === task.awemeId) ? r2.data : d;
      }) : Promise.resolve(d);

      return p.then(function (data) {
        var title = String(data.title || data.desc || task.title || 'douyin').trim();
        var base = sanitize(title) || 'douyin';
        var cfg = DVD.storage.load();
        var sel = task.selected || [];
        var job = buildJob(data, { selected: sel });
        var name = base + '_' + stamp();
        var files = [], chain = Promise.resolve();

        job.forEach(function (item, i) {
          chain = chain.then(function () {
            var fn = name + (item.seq ? '_' + String(item.seq).padStart(2, '0') : '') + (item.tag || '') + item.ext;
            return DVD.platform.saveBlob(item.url, fn, 'https://www.douyin.com/')
              .then(function () { files.push(fn); console.log(T + ' ok ' + item.k + ' -> ' + fn); })
              .catch(function (e) { console.warn(T + ' fail ' + item.k + ' ' + e.message); });
          });
        });

        if (sel.indexOf('text') >= 0 && title) {
          chain = chain.then(function () {
            try {
              var blob = new Blob([title + '\n'], { type: 'text/plain' });
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob); a.download = name + '.txt';
              document.body.appendChild(a); a.click();
              setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
              files.push(name + '.txt');
              console.log(T + ' ok text');
            } catch (e) { console.warn(T + ' fail text ' + e.message); }
          });
        }
        return chain.then(function () {
          console.log(T + ' DONE files=' + files.length + ' :: ' + files.join(' | '));
          return { ok: files.length > 0, files: files };
        });
      });
    }).catch(function (e) {
      console.warn(T + ' FAILED ' + e.message);
      return { ok: false, err: e.message };
    });
  }

  DVD.downloader = { start: start, buildJob: buildJob, sanitize: sanitize, extOf: extOf, topQuality: topQuality };
})(window);

/* ---- src/adapters/douyin.js ---- */
/* 抖音页面适配层：把 DOM 状态转成候选作品 ID 列表。
 * DOM 改版时只改这一层。所有 v3.3 保护机制在此保留：
 *  - 路由变化清空点击上下文
 *  - href 优先于可能滞留的 data-e2e-vid
 *  - 无 URL 标识且无浮层时，只接受正在播放且可见的播放器
 */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};
  var area = function (el) {
    var r = el.getBoundingClientRect();
    var w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    var h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return w * h;
  };
  var lastClick = null;     // { id, ts, path }
  var lastPath = location.pathname;

  function idLike(s) { return /^\d{8,}$/.test(String(s || '')); }

  function attrsOf(el) {
    if (!el || !el.getAttribute) return '';
    var v = el.getAttribute('data-e2e-vid') || el.getAttribute('data-aweme-id') ||
            el.getAttribute('data-vid') || el.getAttribute('data-id');
    return idLike(v) ? String(v) : '';
  }

  function urlIds() {
    var out = [];
    var m = location.search.match(/[?&]modal_id=(\d{8,})/);
    if (m) out.push({ id: m[1], via: 'url:modal_id' });
    var p = location.pathname.match(/\/video\/(\d{8,})/) || location.pathname.match(/\/note\/(\d{8,})/);
    if (p) out.push({ id: p[1], via: 'url:path' });
    var v = location.search.match(/[?&]vid=(\d{8,})/);
    if (v) out.push({ id: v[1], via: 'url:vid' });
    return out;
  }

  /* 宿主：href 优先（渲染态更可信），attr 次之；两者不一致时用 href 并记录 */
  function hostOf(v) {
    var n = v, byHref = null, byAttr = null;
    for (var i = 0; i < 14 && n; i++) {
      if (!byAttr) { var a = attrsOf(n); if (a) byAttr = { id: a, el: n }; }
      if (!byHref && n.getAttribute) {
        var h = n.getAttribute('href');
        if (h) {
          var m = String(h).match(/\/video\/(\d{8,})/) || String(h).match(/[?&]modal_id=(\d{8,})/);
          if (m) byHref = { id: m[1], el: n };
        }
      }
      n = n.parentElement;
    }
    if (byHref) return { id: byHref.id, el: byHref.el, via: 'href', attrDisagree: (byAttr && byAttr.id !== byHref.id) ? byAttr.id : '' };
    return byAttr ? { id: byAttr.id, el: byAttr.el, via: 'attr', attrDisagree: '' } : null;
  }

  function onScreen(v) {
    var r = v.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) return false;
    var w = Math.max(0, Math.min(r.right, window.innerWidth) - Math.max(r.left, 0));
    var h = Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, 0));
    return (w * h) >= (r.width * r.height) * 0.3;
  }

  /* 只有"内部真的含播放器"的可见浮层才算作品浮层；登录弹窗等一律忽略 */
  function dialogScope() {
    var list = document.querySelectorAll('[role="dialog"], [data-e2e="video-detail"], [class*="modal"], [class*="Modal"]');
    for (var i = 0; i < list.length && i < 8; i++) {
      var d = list[i];
      var r = d.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (!d.querySelector('video')) continue;
      return d;
    }
    return null;
  }

  function resolveCurrent() {
    var out = { videos: document.querySelectorAll('video').length, candidates: [], chosen: null,
                conflict: false, note: '', page: location.pathname };

    if (location.pathname !== lastPath) {      // SPA 切路由：旧点击上下文立即作废
      lastPath = location.pathname;
      lastClick = null;
    }

    urlIds().forEach(function (c) { out.candidates.push({ id: c.id, via: c.via }); });
    var hasUrl = out.candidates.length > 0;

    var act = document.querySelector('[data-e2e="feed-active-video"][data-e2e-vid]');
    if (act) {
      var ar = act.getBoundingClientRect();
      if (ar.width > 0 && ar.height > 0) out.candidates.push({ id: act.getAttribute('data-e2e-vid'), via: 'feed-active-video' });
      else out.note = 'active-hidden';
    }

    var scope = dialogScope();
    var best = null, skipped = 0;
    [].slice.call((scope || document).querySelectorAll('video')).forEach(function (v) {
      if (!onScreen(v)) { skipped++; return; }
      var h = hostOf(v);
      if (!h) { skipped++; return; }
      var playing = !v.paused && !v.ended && v.currentTime > 0;
      /* 无 URL 标识、无浮层时：播放中的才算"当前作品"，否则视为残留播放器 */
      if (!hasUrl && !scope && !playing) { skipped++; return; }
      var a = area(v);
      var score = a + (playing ? 5e5 : 0);
      if (!best || score > best.score) {
        best = { id: h.id, via: (scope ? 'dialog-video' : (h.via === 'href' ? 'video-href' : 'video-attr')),
                 score: score, el: v, playing: playing, attrDisagree: h.attrDisagree };
      }
    });
    if (best) {
      out.candidates.push({ id: best.id, via: best.via });
      out.play = best.playing;
      if (best.attrDisagree) out.note = (out.note ? out.note + ';' : '') + 'attr-stale:' + best.attrDisagree;
    }
    out.bestEl = best ? best.el : null;
    out.scope = scope;
    out.skipped = skipped;

    if (lastClick && lastClick.path === location.pathname && Date.now() - lastClick.ts < 30000) {
      out.candidates.push({ id: lastClick.id, via: 'recent-click' });
    }

    var d = DVD.arbiter.decide(out.candidates);
    out.ids = d.ids; out.chosen = d.chosen; out.conflict = d.conflict;
    if (d.note) out.note = (out.note ? out.note + ';' : '') + d.note;
    return out;
  }

  document.addEventListener('click', function (e) {
    var n = e.target;
    for (var i = 0; i < 14 && n; i++) {
      var id = attrsOf(n);
      if (id) { lastClick = { id: id, ts: Date.now(), path: location.pathname }; return; }
      var href = n.getAttribute && n.getAttribute('href');
      if (href) {
        var m = String(href).match(/\/video\/(\d{8,})/) || String(href).match(/[?&]modal_id=(\d{8,})/);
        if (m) { lastClick = { id: m[1], ts: Date.now(), path: location.pathname }; return; }
      }
      n = n.parentElement;
    }
  }, true);

  DVD.adapter = {
    resolveCurrent: resolveCurrent,
    descOf: function (el) {
      var scope = (el && el.closest && el.closest('[data-e2e="feed-item"]')) || document;
      var d = scope.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"]');
      if (!d) d = document.querySelector('[data-e2e="video-desc"], [data-e2e="browse-video-desc"]');
      return d ? d.textContent.trim() : '';
    }
  };
})(window);

/* ---- src/ui/panel.js ---- */
/* 下载面板：六类勾选 + 默认设置。UI 代码沿用原实现。 */
(function (global) {
  'use strict';
  var DVD = global.DVD = global.DVD || {};
  var btn = null, panel = null, settings = null, snap = null;
  var OPTS = [
    { k: 'media', label: '视频 / 图文' },
    { k: 'music', label: '背景音乐' },
    { k: 'cover', label: '视频封面' },
    { k: 'music_cover', label: '音乐封面' },
    { k: 'avatar', label: '作者头像' },
    { k: 'text', label: '视频文案' }
  ];
  var LABEL = {};
  OPTS.forEach(function (o) { LABEL[o.k] = o.label; });

  function toast(msg, ms) {
    var t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);padding:12px 18px;' +
      'background:rgba(20,20,20,.92);color:#fff;border-radius:10px;font:14px/1.5 system-ui;z-index:2147483647;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.45);pointer-events:none';
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 2400);
  }
  function flash(txt) {
    if (!btn) return;
    btn.textContent = txt;
    setTimeout(function () { btn.textContent = '\u2B07'; }, 1600);
  }

  var OPTS = [
    { k: 'media', label: '视频 / 图文', hint: '原片 · 全部原图' },
    { k: 'music', label: '背景音乐', hint: '.mp3' },
    { k: 'cover', label: '视频封面', hint: '作品封面图' },
    { k: 'music_cover', label: '音乐封面', hint: '音乐封面图' },
    { k: 'avatar', label: '作者头像', hint: '头像图' },
    { k: 'text', label: '视频文案', hint: '.txt' }
  ];
  var LABEL = {};
  OPTS.forEach(function (o) { LABEL[o.k] = o.label; });

  function boxes(scope) {
    return scope ? [].slice.call(scope.querySelectorAll('input[type="checkbox"]')) : [];
  }
  function setAll(scope, v) { boxes(scope).forEach(function (b) { b.checked = v; }); }
  function readChecked(scope) {
    var o = {};
    boxes(scope).forEach(function (b) { o[b.getAttribute('data-k')] = b.checked; });
    return o;
  }
  function applyChecked(scope, obj) {
    boxes(scope).forEach(function (b) {
      var k = b.getAttribute('data-k');
      b.checked = typeof obj[k] === 'boolean' ? obj[k] : DEFAULTS[k];
    });
  }
  function selected() {
    return boxes(panel).filter(function (b) { return b.checked; }).map(function (b) { return b.getAttribute('data-k'); });
  }
  function closeSettings() { if (settings) settings.style.display = 'none'; }
  function close() { closeSettings(); if (panel) panel.style.display = 'none'; snap = null; }

  function mkBtn(text, primary, fn, parent, flex) {
    var b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = 'flex:' + (flex === undefined ? 1 : flex) + ';padding:7px 0;border:none;border-radius:8px;cursor:pointer;font:12px system-ui;' +
      (primary ? 'background:#fe2c55;color:#fff' : 'background:rgba(255,255,255,.13);color:#e8e8ea');
    b.addEventListener('mouseenter', function () { b.style.filter = 'brightness(1.18)'; });
    b.addEventListener('mouseleave', function () { b.style.filter = 'none'; });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
    parent.appendChild(b);
    return b;
  }

  function row(o, scope) {
    var r = document.createElement('label');
    r.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px;border-radius:8px;cursor:pointer';
    r.addEventListener('mouseenter', function () { r.style.background = 'rgba(255,255,255,.08)'; });
    r.addEventListener('mouseleave', function () { r.style.background = 'transparent'; });
    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-k', o.k);
    cb.style.cssText = 'accent-color:#fe2c55;width:15px;height:15px;cursor:pointer';
    var t = document.createElement('span');
    t.innerHTML = '<span style="font-weight:500">' + o.label + '</span>' +
      '<span style="opacity:.45;font-size:11px;margin-left:6px">' + o.hint + '</span>';
    r.appendChild(cb); r.appendChild(t);
    scope.appendChild(r);
    return cb;
  }

  function buildSettings() {
    if (settings) return settings;
    settings = document.createElement('div');
    settings.style.cssText = 'position:fixed;right:282px;bottom:196px;width:236px;padding:12px 14px;' +
      'background:rgba(24,24,27,.96);border-radius:14px;color:#f2f2f3;font:13px/1.5 system-ui;' +
      'z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.55);display:none';

    var head = document.createElement('div');
    head.textContent = '默认下载选项';
    head.style.cssText = 'font-size:13px;font-weight:600;margin-bottom:6px;opacity:.92';
    settings.appendChild(head);

    OPTS.forEach(function (o) { row(o, settings); });

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;opacity:.45;margin-top:6px;line-height:1.4';
    hint.textContent = '修改后需点「保存默认选项」才会生效';
    settings.appendChild(hint);

    var r1 = document.createElement('div');
    r1.style.cssText = 'display:flex;gap:6px;margin-top:8px';
    mkBtn('保存默认选项', true, function () {
      var next = normalize(readChecked(settings));
      try {
        DVD.storage.save(next);
        prefs = next;
        toast('默认选项已保存');
        console.log('[DVD] prefs saved ' + JSON.stringify(next));
      } catch (e) {
        console.log('[DouyinSave] prefs save fail ' + e.message);
        toast('保存失败');
      }
      closeSettings();
    }, r1, 1.4);
    settings.appendChild(r1);

    var r2 = document.createElement('div');
    r2.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    mkBtn('恢复默认', false, function () {
      applyChecked(settings, DEFAULTS);
      hint.textContent = '已填入默认值，点「保存默认选项」后生效';
      hint.style.color = '#fe2c55';
    }, r2);
    mkBtn('取消', false, function () { closeSettings(); }, r2);
    settings.appendChild(r2);

    document.body.appendChild(settings);
    return settings;
  }

  function buildPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;right:16px;bottom:196px;width:250px;padding:12px 14px;' +
      'background:rgba(18,18,20,.94);border-radius:14px;color:#f2f2f3;font:13px/1.5 system-ui;' +
      'z-index:2147483647;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px';
    var h = document.createElement('div');
    h.textContent = '选择下载内容';
    h.style.cssText = 'font-size:13px;font-weight:600;opacity:.92';
    var gear = document.createElement('div');
    gear.textContent = '\u2699';
    gear.title = '默认下载选项';
    gear.style.cssText = 'cursor:pointer;font-size:15px;opacity:.55;line-height:1;padding:2px 4px;border-radius:6px';
    gear.addEventListener('mouseenter', function () { gear.style.opacity = '1'; gear.style.background = 'rgba(255,255,255,.1)'; });
    gear.addEventListener('mouseleave', function () { gear.style.opacity = '.55'; gear.style.background = 'transparent'; });
    gear.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var s = buildSettings();
      if (s.style.display === 'block') { s.style.display = 'none'; return; }
      applyChecked(s, prefs);
      s.style.display = 'block';
    });
    head.appendChild(h); head.appendChild(gear);
    panel.appendChild(head);

    OPTS.forEach(function (o) { row(o, panel); });

    var r1 = document.createElement('div');
    r1.style.cssText = 'display:flex;gap:6px;margin-top:10px';
    mkBtn('全选', false, function () { setAll(panel, true); }, r1);
    mkBtn('全不选', false, function () { setAll(panel, false); }, r1);
    panel.appendChild(r1);

    var r2 = document.createElement('div');
    r2.style.cssText = 'display:flex;gap:6px;margin-top:6px';
    mkBtn('取消', false, function () { close(); }, r2);
    mkBtn('开始下载', true, function () {
      if (!snap) { close(); return; }
      var sel = selected();
      if (!sel.length) { toast('至少选择一项'); return; }
      var payload = JSON.stringify({
        task_id: snap.task_id,
        aweme_id: snap.aweme_id,
        via: snap.via,
        title: snap.title,
        captured_at: snap.captured_at,
        page_url: snap.page_url,
        selected: sel
      });
      console.log('[DouyinSave] submit task=' + snap.task_id + ' id=' + snap.aweme_id + ' selected=' + sel.join(','));
      try { DVD.downloader.start(JSON.parse(payload)); flash('\u2026'); } catch (e) { console.log('[DouyinSave] binding fail ' + e.message); }
      close();
    }, r2);
    panel.appendChild(r2);

    document.body.appendChild(panel);
    return panel;
  }

  function openPanel() {
    var r = DVD.adapter.resolveCurrent();
    var log = '[DouyinSave] resolve page=' + r.page + ' videos=' + r.videos + ' ids=' + JSON.stringify(r.ids) + ' conflict=' + r.conflict + (r.note ? ' note=' + r.note : '') + ' scope=' + (r.scope ? 'dialog' : (r.bestEl ? 'player' : 'none')) + ' play=' + r.play + ' skipped=' + r.skipped;
    if (!r.chosen) {
      console.log(log + ' -> refused (cannot determine current aweme)');
      toast('无法确定当前作品（本页未检测到作品标识）');
      flash('\u2715');
      return;
    }
    snap = Object.freeze({
      task_id: 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      aweme_id: String(r.chosen.id),
      via: r.chosen.via,
      title: descOf(r.bestEl),
      captured_at: Date.now(),
      page_url: location.href
    });
    console.log(log + ' -> locked ' + snap.aweme_id + ' via ' + snap.via + ' task ' + snap.task_id);
    var p = buildPanel();
    applyChecked(p, prefs);
    closeSettings();
    p.style.display = 'block';
    console.log('[DouyinSave] panel open prefs=' + JSON.stringify(prefs));
  }

  function mount() {
    if (btn || !document.body) return;
    btn = document.createElement('div');
    btn.textContent = '\u2B07';
    btn.title = '保存当前作品（可选择内容）';
    btn.style.cssText = 'position:fixed;right:16px;bottom:150px;width:34px;height:34px;line-height:32px;text-align:center;' +
      'font-size:18px;color:#fff;background:rgba(30,30,30,.75);border-radius:50%;cursor:pointer;' +
      'z-index:2147483646;user-select:none;font-family:system-ui;box-shadow:0 2px 10px rgba(0,0,0,.4)';
    btn.addEventListener('mouseenter', function () { btn.style.background = 'rgba(254,44,85,.9)'; });
    btn.addEventListener('mouseleave', function () { btn.style.background = 'rgba(30,30,30,.75)'; });
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (panel && panel.style.display === 'block') { close(); return; }
      openPanel();
    });
    document.body.appendChild(btn);
    console.log('[DouyinSave] v' + VERSION + ' button mounted prefs=' + JSON.stringify(prefs));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();


  DVD.ui = { mount: mount, openPanel: openPanel };
})(window);

/* ---- src/userscript.js ---- */
(function (global) {
  'use strict';
  var DVD = global.DVD;
  if (!DVD || !DVD.ui) { console.error('[DVD] modules missing'); return; }
  DVD.ui.mount();
})(window);
