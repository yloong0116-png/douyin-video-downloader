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
