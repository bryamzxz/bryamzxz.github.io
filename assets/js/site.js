/* —————————————————————————————————————————————————————————————————
   bryamzxz — progressive enhancement only.
   Nothing here is required to read the site: every feature attaches to
   markup that already renders and reads correctly without JavaScript.
   ————————————————————————————————————————————————————————————————— */
(function () {
  'use strict';

  /* Must match the rail breakpoint in main.css: below it there is no gutter
     wide enough to hold the rail without overlapping the prose column. */
  var RAIL_MQ = '(min-width: 1360px)';
  var toArray = function (list) { return Array.prototype.slice.call(list); };

  /* ————————————————————————— theme ————————————————————————— */

  var THEME_KEY = 'bz-theme';
  var MODES = ['auto', 'light', 'dark'];

  function storedMode() {
    try {
      var m = localStorage.getItem(THEME_KEY);
      return MODES.indexOf(m) > -1 ? m : 'auto';
    } catch (e) { return 'auto'; }
  }

  function persistMode(mode) {
    try {
      if (mode === 'auto') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, mode);
    } catch (e) {}
  }

  function initTheme() {
    var btn = document.querySelector('[data-theme-toggle]');
    if (!btn) return;
    var label = btn.querySelector('[data-theme-label]');
    var mode = storedMode();

    function render() {
      if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', mode);
      if (label) label.textContent = mode;
      btn.setAttribute('aria-label', 'Colour theme: ' + mode + '. Activate to change.');
      btn.setAttribute('title', 'Theme: ' + mode);
    }

    btn.hidden = false;
    render();
    btn.addEventListener('click', function () {
      mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
      persistMode(mode);
      render();
    });
  }

  /* ————————————————————— heading anchors ————————————————————— */

  function slugify(text) {
    var slug = text.toLowerCase()
      .replace(/[^\wÀ-ɏ\s-]+/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return slug || 'section';
  }

  /* kramdown already emits ids for every heading; this only fills gaps and
     records the pristine heading text before the anchor mutates textContent. */
  function initAnchors(root) {
    toArray(root.querySelectorAll('h2, h3, h4')).forEach(function (h) {
      var text = h.textContent.trim();
      h.setAttribute('data-heading-text', text);

      if (!h.id) {
        var base = slugify(text), id = base, n = 2;
        while (document.getElementById(id)) id = base + '-' + n++;
        h.id = id;
      }
      if (h.querySelector('.anchor')) return;

      var a = document.createElement('a');
      a.className = 'anchor';
      a.href = '#' + h.id;
      a.setAttribute('aria-label', 'Permalink to “' + text + '”');
      a.innerHTML = '<span aria-hidden="true">§</span>';
      h.appendChild(a);
    });
  }

  /* ———————————— § cross-references become real links ———————————— */

  /* Maps "3.1" -> the id of the heading that opens section 3.1, so the
     dozens of in-prose "see §3.3" references stop being dead text. */
  function sectionMap(root) {
    var map = {};
    toArray(root.querySelectorAll('h2, h3, h4')).forEach(function (h) {
      var text = h.getAttribute('data-heading-text') || h.textContent;
      var m = /^\s*(\d+(?:\.\d+)*)\.?\s+/.exec(text);
      if (m && !map[m[1]]) map[m[1]] = h.id;
    });
    return map;
  }

  function initCrossRefs(root, map) {
    if (!Object.keys(map).length) return;

    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.nodeValue.indexOf('§') === -1) return NodeFilter.FILTER_REJECT;
        for (var p = node.parentNode; p && p !== root; p = p.parentNode) {
          var tag = p.nodeName;
          if (tag === 'A' || tag === 'CODE' || tag === 'PRE' || /^H[1-6]$/.test(tag)) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    var nodes = [], node;
    while ((node = walker.nextNode())) nodes.push(node);

    var re = /§\s?(\d+(?:\.\d+)*)/g;
    nodes.forEach(function (textNode) {
      var text = textNode.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0, hit = false, m;

      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        var id = map[m[1]];
        if (!id) continue;
        hit = true;
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var a = document.createElement('a');
        a.className = 'xref';
        a.href = '#' + id;
        a.textContent = m[0];
        frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (!hit) return;
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  /* ——————————————————— table of contents ——————————————————— */

  /* "3.1 CVE-2026-37711 — dol_eval() Code Injection via …" reads as
     "3.1 CVE-2026-37711" in a 15rem rail. Full text stays in the tooltip. */
  function tocLabel(heading) {
    var text = (heading.getAttribute('data-heading-text') || heading.textContent).trim();
    var cut = text.split(/\s+[—–]\s+/)[0];
    if (cut.length >= 6) text = cut;
    return text.length > 46 ? text.slice(0, 45).replace(/[\s,;:.]+$/, '') + '…' : text;
  }

  function initToc(root) {
    var details = document.querySelector('[data-toc]');
    var host = document.querySelector('[data-toc-body]');
    if (!details || !host) return;

    var headings = toArray(root.querySelectorAll('h2, h3'));
    if (headings.length < 4) return;

    var list = document.createElement('ol');
    list.className = 'toc-list';

    var entries = [], group = -1;
    headings.forEach(function (h) {
      var level = h.tagName === 'H2' ? 2 : 3;
      if (level === 2) group++;

      var li = document.createElement('li');
      li.className = 'toc-item toc-item--h' + level;
      li.setAttribute('data-group', String(group));

      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + h.id;
      a.textContent = tocLabel(h);
      a.title = h.getAttribute('data-heading-text') || h.textContent;

      li.appendChild(a);
      list.appendChild(li);
      entries.push({ heading: h, li: li, link: a, group: group, level: level });
    });

    host.appendChild(list);
    details.hidden = false;

    /* Wide viewports get a fixed rail in the left gutter; narrower ones get
       an ordinary collapsible block in the flow. */
    var mq = window.matchMedia(RAIL_MQ);
    function syncMode() {
      if (mq.matches) {
        details.classList.add('post-toc--rail');
        details.open = true;
      } else {
        details.classList.remove('post-toc--rail', 'is-stowed');
        details.open = false;
      }
      syncRailVisibility();
    }
    syncMode();
    if (mq.addEventListener) mq.addEventListener('change', syncMode);
    else if (mq.addListener) mq.addListener(syncMode);

    /* Collapsing a link that jumps within the same page is what a reader
       expects on a phone; on the rail it would be destructive. The collapse
       removes ~900px from above the target, so letting the browser's own
       fragment scroll race the layout change lands hundreds of pixels off —
       close first, then scroll once layout has settled. */
    list.addEventListener('click', function (e) {
      var link = e.target.closest('.toc-link');
      if (!link || mq.matches) return;

      var id = link.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      details.open = false;
      requestAnimationFrame(function () {
        var smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
        if (history.replaceState) history.replaceState(null, '', '#' + id);
      });
    });

    var active = null;

    function highlight(entry) {
      if (entry === active) return;
      active = entry;
      entries.forEach(function (item) {
        item.li.classList.toggle('is-active', item === entry);
        /* Only the section you are actually in unfolds its subsections. */
        item.li.classList.toggle(
          'is-open',
          item.level === 2 || item.group === entry.group
        );
      });
      scrollRailTo(entry);
    }

    function scrollRailTo(entry) {
      if (!mq.matches || !details.open) return;
      var li = entry.li;
      var top = li.offsetTop, bottom = top + li.offsetHeight;
      if (top >= host.scrollTop && bottom <= host.scrollTop + host.clientHeight) return;
      host.scrollTop = Math.max(0, top - host.clientHeight / 2 + li.offsetHeight / 2);
    }

    /* The rail lives in the left gutter of the prose column, but the header,
       dossier, citation and footer all run to the wider column and would sit
       underneath it. Show the rail only when prose fills its whole vertical
       band — visibility:hidden keeps the geometry measurable while stowed,
       so this cannot oscillate. */
    function syncRailVisibility() {
      if (!mq.matches) return;
      var prose = root.getBoundingClientRect();
      var band = details.getBoundingClientRect();
      var slack = 40;
      details.classList.toggle(
        'is-stowed',
        !(prose.top <= band.top + slack && prose.bottom >= band.bottom - slack)
      );
    }

    function spy() {
      /* A heading counts as current once it reaches the top third of the
         viewport — h2s carry ~6rem of margin, so a tighter line lags badly. */
      var line = Math.max(140, Math.min(300, window.innerHeight * 0.3));
      var current = entries[0];

      for (var i = 0; i < entries.length; i++) {
        if (entries[i].heading.getBoundingClientRect().top <= line) current = entries[i];
        else break;
      }
      /* The last section is often too short to ever cross the line. */
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        current = entries[entries.length - 1];
      }
      highlight(current);
      syncRailVisibility();
    }

    onScrollOrResize(spy);
    spy();
  }

  /* ————————————————————— reading progress ————————————————————— */

  function initReadbar(root) {
    var fill = document.querySelector('[data-readbar-fill]');
    if (!fill || !root) return;

    function update() {
      var rect = root.getBoundingClientRect();
      var scrollable = rect.height - window.innerHeight;
      var ratio = scrollable <= 0 ? 1 : -rect.top / scrollable;
      fill.style.transform = 'scaleX(' + Math.min(1, Math.max(0, ratio)) + ')';
    }

    onScrollOrResize(update);
    update();
  }

  /* ————————————————————— code block chrome ————————————————————— */

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy') ? resolve() : reject();
      } catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }

  var LANG_NAMES = { php: 'PHP', sql: 'SQL', http: 'HTTP', html: 'HTML', js: 'JS', shell: 'Shell', bash: 'Bash', yaml: 'YAML', json: 'JSON' };

  function initCodeBlocks(root) {
    toArray(root.querySelectorAll('pre')).forEach(function (pre) {
      var wrap = pre.closest('.highlighter-rouge') || pre.closest('.highlight') || pre;
      if (wrap.parentNode && wrap.parentNode.classList.contains('code-block')) return;

      var shell = document.createElement('div');
      shell.className = 'code-block';
      wrap.parentNode.insertBefore(shell, wrap);
      shell.appendChild(wrap);

      var bar = document.createElement('div');
      bar.className = 'code-block__bar';

      var match = /language-([\w+#.-]+)/.exec(wrap.className || '');
      var lang = match && match[1];
      if (lang && lang !== 'plaintext' && lang !== 'text') {
        var tag = document.createElement('span');
        tag.className = 'code-block__lang';
        tag.textContent = LANG_NAMES[lang] || lang.toUpperCase();
        bar.appendChild(tag);
      }

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-block__copy';
      btn.textContent = 'Copy';
      btn.setAttribute('aria-label', 'Copy code to clipboard');
      bar.appendChild(btn);
      shell.appendChild(bar);

      var reset;
      btn.addEventListener('click', function () {
        var code = pre.querySelector('code') || pre;
        copyText(code.innerText.replace(/\n+$/, '')).then(function () {
          btn.textContent = 'Copied';
          btn.classList.add('is-done');
        }, function () {
          btn.textContent = 'Press ⌘C';
        });
        clearTimeout(reset);
        reset = setTimeout(function () {
          btn.textContent = 'Copy';
          btn.classList.remove('is-done');
        }, 1800);
      });
    });
  }

  /* —————————————————————————— plumbing —————————————————————————— */

  var scrollHandlers = [], scheduled = false;

  function runHandlers() {
    scheduled = false;
    scrollHandlers.forEach(function (fn) { fn(); });
  }

  function onScrollOrResize(fn) {
    if (!scrollHandlers.length) {
      var schedule = function () {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(runHandlers);
      };
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule, { passive: true });
    }
    scrollHandlers.push(fn);
  }

  function init() {
    initTheme();

    var prose = document.querySelector('.prose');
    if (!prose) return;

    initAnchors(prose);
    initCodeBlocks(prose);

    var post = document.querySelector('[data-post-body]');
    if (!post) return;

    initCrossRefs(post, sectionMap(post));
    initToc(post);
    initReadbar(post);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
