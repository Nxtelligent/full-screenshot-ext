// content.js — Injected into the active tab to prepare for capture
// This is an IIFE that returns page dimensions

(() => {
  // Neutralize fixed/sticky elements so they don't repeat in every tile
  const styleId = "__fss_style_override";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      *, *::before, *::after {
        position: static !important;
        /* Preserve elements that use position:relative for layout */
      }
      html, body {
        overflow: visible !important;
        height: auto !important;
      }
    `;

    // More surgical approach: only neutralize fixed and sticky
    style.textContent = `
      *:not(html):not(body) {
        /* Reset only fixed/sticky to static */
      }
      html, body {
        overflow: visible !important;
      }
    `;

    // Actually, let's be precise: find fixed/sticky elements and neutralize them
    style.textContent = "";

    // Find all fixed/sticky elements and tag them
    const allElements = document.querySelectorAll("*");
    const fixedElements = [];
    allElements.forEach((el) => {
      const computed = window.getComputedStyle(el);
      if (
        computed.position === "fixed" ||
        computed.position === "sticky"
      ) {
        fixedElements.push({
          el,
          original: computed.position,
        });
        el.dataset.__fssOrigPos = computed.position;
        el.style.setProperty("position", "absolute", "important");
      }
    });

    // Also ensure body/html don't clip
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const origHtmlOverflow = htmlEl.style.overflow;
    const origBodyOverflow = bodyEl.style.overflow;
    htmlEl.style.setProperty("overflow", "visible", "important");
    bodyEl.style.setProperty("overflow", "visible", "important");

    // Store cleanup info
    window.__fssCleanup = () => {
      fixedElements.forEach(({ el, original }) => {
        el.style.removeProperty("position");
        delete el.dataset.__fssOrigPos;
      });
      htmlEl.style.overflow = origHtmlOverflow;
      bodyEl.style.overflow = origBodyOverflow;
    };
  }

  // Return page dimensions
  const scrollHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.offsetHeight,
    document.body.clientHeight,
    document.documentElement.clientHeight
  );

  return {
    scrollHeight,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
    devicePixelRatio: window.devicePixelRatio || 1,
    originalScrollX: window.scrollX,
    originalScrollY: window.scrollY,
  };
})();
