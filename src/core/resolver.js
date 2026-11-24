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
