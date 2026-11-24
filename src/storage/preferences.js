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
