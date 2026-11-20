/* sagelight · 交互：主题切换 / 阅读进度 / 目录 / 代码复制 / 搜索 */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;

  function $(sel, ctx) {
    return (ctx || doc).querySelector(sel);
  }

  function $all(sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  }

  function on(el, type, fn, opts) {
    if (el) el.addEventListener(type, fn, opts || false);
  }

  function raf(fn) {
    var ticking = false;
    return function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        ticking = false;
        fn();
      });
    };
  }

  /* ---------- 1. 深浅色切换 ---------- */
  function initTheme() {
    var toggle = $("#theme-toggle");
    if (!toggle) return;
    on(toggle, "click", function () {
      var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try {
        localStorage.setItem("theme", next);
      } catch (e) {}
      // 让 mermaid 图形跟随主题重绘
      var evt;
      try {
        evt = new CustomEvent("themechange", { detail: next });
      } catch (e) {
        evt = doc.createEvent("Event");
        evt.initEvent("themechange", true, true);
      }
      doc.dispatchEvent(evt);
    });
  }

  /* ---------- 2. 阅读进度 ---------- */
  function initProgress() {
    var bar = $("#reading-progress");
    if (!bar) return;
    var update = raf(function () {
      var el = doc.documentElement;
      var max = el.scrollHeight - el.clientHeight;
      var top = window.pageYOffset || el.scrollTop || 0;
      bar.style.width = (max > 0 ? Math.min(100, (top / max) * 100) : 0) + "%";
    });
    on(window, "scroll", update, { passive: true });
    on(window, "resize", update);
    update();
  }

  /* ---------- 3. 代码块：语言标签 + 复制 ---------- */
  function initCode() {
    $all("figure.highlight").forEach(function (fig) {
      if (fig.parentNode && fig.parentNode.classList.contains("codeblock")) return;
      var lang = "";
      Array.prototype.forEach.call(fig.classList, function (c) {
        if (c === "highlight" || !c) return;
        if (c.indexOf("lang-") === 0) lang = c.slice(5);
        else if (!lang) lang = c;
      });
      var button = doc.createElement("button");
      button.className = "codebar__copy";
      button.type = "button";
      button.textContent = "复制";

      var bar = doc.createElement("div");
      bar.className = "codebar";
      var label = doc.createElement("span");
      label.className = "codebar__lang";
      label.textContent = lang && lang !== "plaintext" ? lang : "text";
      bar.appendChild(label);
      bar.appendChild(button);
      fig.insertBefore(bar, fig.firstChild);

      on(button, "click", function () {
        var pre = fig.querySelector("td.code pre") || fig.querySelector("pre");
        if (!pre) return;
        var text = pre.innerText || pre.textContent || "";
        var done = function () {
          button.textContent = "已复制";
          button.classList.add("is-done");
          window.setTimeout(function () {
            button.textContent = "复制";
            button.classList.remove("is-done");
          }, 1600);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, function () {});
        } else {
          var ta = doc.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          doc.body.appendChild(ta);
          ta.select();
          try {
            doc.execCommand("copy");
            done();
          } catch (e) {}
          doc.body.removeChild(ta);
        }
      });
    });
  }

  /* ---------- 4. 文内目录 + 滚动高亮 ---------- */
  function slugify(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/[`~!@#$%^&*()+=\[\]{}|\\:;"'<>,.?\/]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48);
  }

  function initToc() {
    var article = $(".post[data-toc-depth]");
    if (!article) return;
    var content = $(".post__content", article);
    var slots = $all("[data-toc]", article);
    if (!content || !slots.length) return;

    var depth = parseInt(article.getAttribute("data-toc-depth"), 10) || 3;
    var selector = depth >= 3 ? "h2, h3" : "h2";
    var heads = $all(selector, content).filter(function (h) {
      return !h.closest("blockquote");
    });

    if (!heads.length) {
      $all(".toc-inline, .toc-aside", article).forEach(function (el) {
        el.parentNode && el.parentNode.removeChild(el);
      });
      return;
    }

    function texToText(tex) {
      var map = {
        "\\cdot": "·", "\\times": "×", "\\rightarrow": "→", "\\to": "→", "\\leftarrow": "←",
        "\\nabla": "∇", "\\partial": "∂", "\\infty": "∞", "\\pm": "±", "\\approx": "≈",
        "\\leq": "≤", "\\geq": "≥", "\\neq": "≠", "\\rho": "ρ", "\\mu": "μ", "\\nu": "ν",
        "\\theta": "θ", "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\pi": "π",
        "\\lambda": "λ", "\\sigma": "σ", "\\tau": "τ", "\\epsilon": "ε", "\\phi": "φ"
      };
      var text = String(tex || "");
      Object.keys(map).forEach(function (key) {
        text = text.split(key).join(map[key]);
      });
      return text
        .replace(/\\text\{([^}]*)\}/g, "$1")
        .replace(/\\mathrm\{([^}]*)\}/g, "$1")
        .replace(/\\left|\\right/g, "")
        .replace(/\\[,;!]/g, "")
        .replace(/[{}]/g, "")
        .replace(/\^2/g, "²")
        .replace(/\^3/g, "³")
        .replace(/\s+/g, " ")
        .trim();
    }

    function headingText(node) {
      var clone = node.cloneNode(true);
      Array.prototype.forEach.call(clone.querySelectorAll("[data-tex]"), function (el) {
        el.textContent = texToText(el.getAttribute("data-tex"));
      });
      return String(clone.textContent || "").replace(/\s+/g, " ").trim();
    }

    heads.forEach(function (h, i) {
      if (h.id) return;
      var base = slugify(headingText(h)) || "section-" + (i + 1);
      var id = base;
      var n = 1;
      while (doc.getElementById(id)) {
        id = base + "-" + n++;
      }
      h.id = id;
    });

    var list = doc.createElement("ul");
    var lastLi = null;
    heads.forEach(function (h) {
      var li = doc.createElement("li");
      var a = doc.createElement("a");
      a.href = "#" + h.id;
      a.textContent = headingText(h).replace(/^#+\s*/, "").trim();
      li.appendChild(a);
      if (h.tagName === "H3" && lastLi) {
        var sub = lastLi.querySelector("ul");
        if (!sub) {
          sub = doc.createElement("ul");
          lastLi.appendChild(sub);
        }
        sub.appendChild(li);
      } else {
        list.appendChild(li);
        lastLi = li;
      }
    });

    slots.forEach(function (slot) {
      slot.appendChild(list.cloneNode(true));
    });

    var links = $all(".toc a", article);
    var linkMap = {};
    links.forEach(function (a) {
      linkMap[a.getAttribute("href").slice(1)] = a;
    });

    function setActive(id) {
      links.forEach(function (a) {
        a.classList.remove("is-active");
      });
      var current = linkMap[id];
      if (current) current.classList.add("is-active");
    }

    var spy = raf(function () {
      var line = (window.pageYOffset || 0) + 110;
      var active = heads[0];
      for (var i = 0; i < heads.length; i++) {
        var top = heads[i].getBoundingClientRect().top + (window.pageYOffset || 0);
        if (top <= line) active = heads[i];
        else break;
      }
      if (active) setActive(active.id);
    });
    on(window, "scroll", spy, { passive: true });
    on(window, "resize", spy);
    spy();

    on(article, "click", function (ev) {
      var a = ev.target.closest && ev.target.closest('.toc a, .toc-inline a');
      if (a) {
        var detail = a.closest("details");
        if (detail) detail.removeAttribute("open");
      }
    });
  }

  /* ---------- 5. 回到顶部 ---------- */
  function initBackTop() {
    on($("#back-top"), "click", function (ev) {
      ev.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- 6. 外链 / 图片懒加载 ---------- */
  function initLinksAndImages() {
    var host = window.location.host;
    $all('.post__content a[href^="http"]').forEach(function (a) {
      try {
        if (new URL(a.href).host !== host) {
          a.target = "_blank";
          a.rel = "noopener noreferrer";
        }
      } catch (e) {}
    });
    $all(".post__content img").forEach(function (img) {
      img.loading = "lazy";
      img.decoding = "async";
    });
  }

  /* ---------- 7. 按需加载资源 ---------- */
  var ROOT = (doc.body && doc.body.getAttribute("data-root")) || "/";

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var url = ROOT.replace(/\/$/, "") + "/" + String(src).replace(/^\//, "");
      var exist = $all("script[src]").some(function (s) {
        return s.getAttribute("src") === url;
      });
      if (exist) return resolve();
      var el = doc.createElement("script");
      el.src = url;
      el.async = true;
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error("load failed: " + url)); };
      doc.head.appendChild(el);
    });
  }

  /* ---------- 7.1 公式：同步阶段已转成 .math-* 节点，这里直接用 KaTeX 渲染 ---------- */
  function initMath() {
    var nodes = $all(".math-display, .math-inline");
    if (!nodes.length) return;
    loadScript("js/vendor/katex/katex.min.js")
      .then(function () {
        if (!window.katex) return;
        nodes.forEach(function (node) {
          var tex = node.getAttribute("data-tex") || node.textContent || "";
          if (!tex.trim()) return;
          try {
            window.katex.render(tex, node, {
              displayMode: node.classList.contains("math-display"),
              throwOnError: false,
              strict: false
            });
          } catch (e) {
            node.textContent = tex;
          }
        });
      })
      .catch(function () {});
  }
  /* ---------- 8. mermaid（识别 fence 里的图 + 按需加载） ---------- */
  var MERMAID_HEAD = /^\s*(flowchart|graph\s+(TD|TB|BT|RL|LR)|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|gantt|pie|journey|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4Context|C4Container|sankey-beta|xychart-beta|block-beta)\b/m;

  function looksLikeMermaid(text) {
    return MERMAID_HEAD.test(String(text || "").slice(0, 600));
  }

  function initMermaid() {
    var hosts = [];
    $all("figure.highlight").forEach(function (fig) {
      var pre = fig.querySelector("pre");
      var text = pre ? pre.textContent : "";
      if (text && looksLikeMermaid(text)) hosts.push({ host: fig, text: text });
    });
    $all("pre code.language-mermaid, div.language-mermaid").forEach(function (el) {
      var host = el.closest("figure") || el.parentNode;
      if (host) hosts.push({ host: host, text: el.textContent });
    });
    if (!hosts.length) return;

    var nodes = hosts.map(function (item) {
      var div = doc.createElement("div");
      div.className = "mermaid";
      var src = String(item.text || "").trim();
      div.textContent = src;
      div.setAttribute("data-src", src);
      item.host.parentNode.replaceChild(div, item.host);
      return div;
    });

    var render = function () {
      var dark = root.getAttribute("data-theme") === "dark";
      nodes.forEach(function (div) {
        if (div.hasAttribute("data-processed")) {
          div.removeAttribute("data-processed");
          div.innerHTML = "";
          div.textContent = div.getAttribute("data-src") || "";
        }
      });
      try {
        window.mermaid.initialize({
          startOnLoad: false,
          theme: dark ? "dark" : "neutral",
          securityLevel: "loose",
          fontFamily: getComputedStyle(doc.body).fontFamily
        });
        var job = window.mermaid.run({ nodes: nodes });
        if (job && job.catch) job.catch(function () {});
      } catch (e) {}
    };

    loadScript("js/vendor/mermaid.min.js")
      .then(function () {
        render();
        on(doc, "themechange", render);
      })
      .catch(function () {});
  }
  /* ---------- 9. 搜索 ---------- */
  function initSearch() {
    var rootEl = $("#search-root");
    var input = $("#search-input");
    var results = $("#search-results");
    if (!rootEl || !input || !results) return;
    var status = $("#search-status");
    var indexUrl = rootEl.getAttribute("data-index") || "/search.json";
    var posts = [];

    function escapeHtml(s) {
      return String(s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    function mark(text, q) {
      var safe = escapeHtml(text);
      if (!q) return safe;
      var re = new RegExp("(" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      return safe.replace(re, "<mark>$1</mark>");
    }

    function render(list, q) {
      results.innerHTML = "";
      if (!q) {
        if (status) status.textContent = "输入关键词开始过滤 · 共 " + posts.length + " 篇";
        return;
      }
      if (status) status.textContent = list.length ? "找到 " + list.length + " 篇" : "没有匹配的笔记";
      list.slice(0, 40).forEach(function (p) {
        var li = doc.createElement("li");
        li.className = "search-hit";
        var title = doc.createElement("a");
        title.className = "search-hit__title";
        title.href = p.url;
        title.innerHTML = mark(p.title, q);
        li.appendChild(title);
        var meta = doc.createElement("p");
        meta.className = "search-hit__meta";
        var bits = [p.date].concat(p.categories || [], (p.tags || []).map(function (t) {
          return "#" + t;
        }));
        meta.textContent = bits.filter(Boolean).join("  ·  ");
        li.appendChild(meta);
        if (p.text) {
          var idx = p.text.toLowerCase().indexOf(q.toLowerCase());
          var snippet = idx >= 0 ? p.text.slice(Math.max(0, idx - 40), idx + 80) : p.text.slice(0, 110);
          var text = doc.createElement("p");
          text.className = "search-hit__text";
          text.innerHTML = (idx > 40 ? "…" : "") + mark(snippet, q) + "…";
          li.appendChild(text);
        }
        results.appendChild(li);
      });
    }

    function search(q) {
      q = String(q || "").trim().toLowerCase();
      if (!q) return render([], "");
      var scored = posts
        .map(function (p) {
          var score = 0;
          if (p.title.toLowerCase().indexOf(q) >= 0) score += 6;
          (p.tags || []).forEach(function (t) {
            if (t.toLowerCase().indexOf(q) >= 0) score += 3;
          });
          (p.categories || []).forEach(function (c) {
            if (c.toLowerCase().indexOf(q) >= 0) score += 2;
          });
          if ((p.text || "").toLowerCase().indexOf(q) >= 0) score += 1;
          return { post: p, score: score };
        })
        .filter(function (x) {
          return x.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score || (a.post.date < b.post.date ? 1 : -1);
        })
        .map(function (x) {
          return x.post;
        });
      render(scored, q);
    }

    fetch(indexUrl)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        posts = data || [];
        var q = new URLSearchParams(window.location.search).get("q");
        if (q) {
          input.value = q;
          search(q);
        } else {
          render([], "");
        }
      })
      .catch(function () {
        if (status) status.textContent = "搜索索引加载失败";
      });

    var timer = null;
    on(input, "input", function () {
      window.clearTimeout(timer);
      var value = input.value;
      timer = window.setTimeout(function () {
        search(value);
      }, 90);
    });

    on(doc, "keydown", function (ev) {
      if (ev.key === "/" && doc.activeElement !== input) {
        ev.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    try { initTheme(); } catch (e) {}
    try { initProgress(); } catch (e) {}
    try { initCode(); } catch (e) {}
    try { initToc(); } catch (e) {}
    try { initBackTop(); } catch (e) {}
    try { initLinksAndImages(); } catch (e) {}
    try { initMath(); } catch (e) {}
    try { initMermaid(); } catch (e) {}
    try { initSearch(); } catch (e) {}
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
