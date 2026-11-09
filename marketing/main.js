/* Data Cloud Compare — site interactions */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- theme */
  var themeToggle = document.querySelector('[data-theme-toggle]');
  function syncThemeLabel() {
    if (!themeToggle) return;
    var dark = doc.dataset.theme !== 'light';
    themeToggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#070a11' : '#f6f8fc');
  }
  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      var next = doc.dataset.theme === 'light' ? 'dark' : 'light';
      doc.dataset.theme = next;
      try { localStorage.setItem('dcc-theme', next); } catch (e) {}
      syncThemeLabel();
    });
  }
  syncThemeLabel();

  /* ------------------------------------------------------------ mobile nav */
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  function closeNav() {
    if (!navToggle || !navLinks) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    navLinks.classList.remove('open');
  }
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!open));
      navToggle.setAttribute('aria-label', open ? 'Open menu' : 'Close menu');
      navLinks.classList.toggle('open', !open);
    });
    navLinks.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeNav();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeNav();
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 980) closeNav();
    });
  }

  /* -------------------------------------------------------- scroll reveal */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealItems.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealItems.forEach(function (el) { revealObserver.observe(el); });
  }

  /* ------------------------------------------------------ number counters */
  function formatNumber(value, node) {
    var decimals = parseInt(node.getAttribute('data-decimals') || '0', 10);
    var format = node.getAttribute('data-format');
    if (format === 'compact' && value >= 1000000) {
      return (value / 1000000).toFixed(value >= 10000000 ? 1 : 2) + 'M';
    }
    if (format === 'comma') {
      return Math.round(value).toLocaleString('en-US');
    }
    return value.toFixed(decimals);
  }

  function animateCounter(node) {
    var target = parseFloat(node.getAttribute('data-count'));
    if (!isFinite(target)) return;
    if (reduceMotion) {
      node.textContent = formatNumber(target, node);
      return;
    }
    var start = null;
    var duration = 1500;
    function frame(now) {
      if (start === null) start = now;
      var progress = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = formatNumber(target * eased, node);
      if (progress < 1) requestAnimationFrame(frame);
      else node.textContent = formatNumber(target, node);
    }
    requestAnimationFrame(frame);
  }

  var counters = Array.prototype.slice.call(document.querySelectorAll('[data-count]'));
  if (counters.length) {
    if (!('IntersectionObserver' in window)) {
      counters.forEach(animateCounter);
    } else {
      var counterObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCounter(entry.target);
            counterObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.45 });
      counters.forEach(function (el) { counterObserver.observe(el); });
    }
  }

  /* --------------------------------------------------------------- copy */
  var copyButton = document.querySelector('[data-copy-target]');
  if (copyButton) {
    copyButton.addEventListener('click', function () {
      var target = document.getElementById(copyButton.getAttribute('data-copy-target'));
      if (!target) return;
      var text = target.innerText;
      var label = copyButton.querySelector('span');
      var done = function () {
        if (!label) return;
        label.textContent = 'Copied';
        copyButton.classList.add('copied');
        window.setTimeout(function () {
          label.textContent = 'Copy';
          copyButton.classList.remove('copied');
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(function () { fallback(text, done); });
      } else {
        fallback(text, done);
      }
    });
  }

  function fallback(text, done) {
    var area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(area);
  }

  /* --------------------------------------------------------------- year */
  document.querySelectorAll('[data-year]').forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  /* ----------------------------------------------------- header on scroll */
  var header = document.querySelector('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
