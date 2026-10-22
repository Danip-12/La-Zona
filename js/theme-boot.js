/* Script clásico y mínimo: fija tema, paleta, movimiento e idioma antes del primer pintado. */
(function () {
  var root = document.documentElement;
  try {
    var s = JSON.parse(localStorage.getItem('lazona.settings.v1') || '{}') || {};
    if (s.theme === 'light' || s.theme === 'dark' || s.theme === 'auto') root.setAttribute('data-theme', s.theme);
    if (typeof s.palette === 'string' && /^[a-z]{3,12}$/.test(s.palette)) root.setAttribute('data-palette', s.palette);
    if (s.reduceMotion === true) root.setAttribute('data-motion', 'reduce');
    if (s.lang === 'en' || s.lang === 'es') root.setAttribute('lang', s.lang);
  } catch (e) { /* almacenamiento bloqueado o JSON corrupto: valores por defecto */ }
})();
