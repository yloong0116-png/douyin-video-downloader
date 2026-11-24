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
