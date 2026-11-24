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
