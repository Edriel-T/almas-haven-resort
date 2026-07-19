/**
 * Shared chrome: nav, toast, year, scroll reveal
 */
(function () {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const header = document.getElementById("header");
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("scrolled", window.scrollY > 8);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const toggle = document.getElementById("menuToggle");
  const nav = document.getElementById("nav");
  toggle?.addEventListener("click", () => {
    const open = nav?.classList.toggle("open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    document.body.classList.toggle("nav-open", !!open);
  });
  nav?.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle?.setAttribute("aria-expanded", "false");
      document.body.classList.remove("nav-open");
    });
  });

  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  nav?.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    const file = href.split("#")[0].split("/").pop().toLowerCase() || "index.html";
    if (file === path || (path === "" && file === "index.html")) {
      a.classList.add("active");
    }
  });

  let toastTimer;
  function toast(message) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.hidden = false;
    el.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.hidden = true;
    }, 4200);
  }
  window.AlmaUI = { toast };

  /* Scroll reveal */
  let observer;
  function observe(nodes) {
    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
      );
    }
    nodes.forEach((el, i) => {
      if (el.dataset.revealDelay) {
        el.style.setProperty("--reveal-delay", el.dataset.revealDelay);
      } else {
        el.style.setProperty("--reveal-delay", `${Math.min(i * 60, 360)}ms`);
      }
      observer.observe(el);
    });
  }

  function refresh() {
    const nodes = document.querySelectorAll(".reveal:not(.is-visible)");
    observe([...nodes]);
  }

  function initReveal() {
    refresh();
  }

  window.AlmaReveal = { refresh };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initReveal);
  } else {
    initReveal();
  }

  // Prefer reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    document.documentElement.classList.add("reduce-motion");
  }
})();
