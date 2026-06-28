(function () {
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebar-overlay');
  var openBtn = document.getElementById('menu-btn');
  var closeBtn = document.getElementById('sidebar-close');
  function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('open'); }
  function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }
  if (openBtn) openBtn.addEventListener('click', openSidebar);
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  var html = document.getElementById('html-root');
  var langBtn = document.getElementById('lang-toggle');
  function setLang(lang) {
    html.setAttribute('lang', lang);
    localStorage.setItem('kj-lang', lang);
  }
  if (langBtn) {
    langBtn.addEventListener('click', function () {
      setLang(html.getAttribute('lang') === 'ms' ? 'en' : 'ms');
    });
  }
  var savedLang = localStorage.getItem('kj-lang');
  if (savedLang === 'en' || savedLang === 'ms') setLang(savedLang);

  var revealEls = document.querySelectorAll('.reveal, .reveal-scale');
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });
  revealEls.forEach(function (el) { io.observe(el); });
})();
