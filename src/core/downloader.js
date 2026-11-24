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
