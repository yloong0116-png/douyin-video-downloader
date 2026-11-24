(function (global) {
  'use strict';
  var DVD = global.DVD;
  if (!DVD || !DVD.ui) { console.error('[DVD] modules missing'); return; }
  DVD.ui.mount();
})(window);
