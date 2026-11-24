const fs = require('fs'); const path = require('path'); const vm = require('vm');

/** 按顺序把 src 模块加载进一个假的 window，返回 DVD 命名空间 */
function load(mods) {
  const store = Object.create(null);
  const win = {
    console: { log() {}, warn() {}, error() {} },
    localStorage: {
      getItem(k) { return k in store ? store[k] : null; },
      setItem(k, v) { store[k] = String(v); },
      removeItem(k) { delete store[k]; }
    },
    location: { pathname: '/', search: '', href: 'https://www.douyin.com/' },
    document: { querySelectorAll: () => [], querySelector: () => null, addEventListener() {} }
  };
  win.window = win;
  const ctx = vm.createContext(win);
  for (const m of mods) {
    const code = fs.readFileSync(path.join(__dirname, '..', m), 'utf8');
    vm.runInContext(code, ctx, { filename: m });
  }
  return win.DVD;
}
module.exports = { load };
