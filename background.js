// background.js — Service worker that orchestrates the full-page capture

let isCapturing = false;

// Listen for toolbar icon click
chrome.action.onClicked.addListener(async (tab) => {
  if (isCapturing) return;

  // Can't capture chrome:// or edge:// pages
  if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("edge://") || tab.url.startsWith("chrome-extension://")) {
    showBadge("✗", "#e74c3c", 2000);
    return;
  }

  isCapturing = true;
  showBadge("...", "#3498db");

  try {
    // Inject and run the content script
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    // content.js returns page dimensions
    const pageInfo = results[0]?.result;
    if (!pageInfo) throw new Error("Could not read page dimensions");

    const {
      scrollHeight,
      viewportHeight,
      viewportWidth,
      devicePixelRatio,
      originalScrollX,
      originalScrollY,
    } = pageInfo;

    // Calculate tiles
    const totalTiles = Math.ceil(scrollHeight / viewportHeight);
    const tiles = [];

    for (let i = 0; i < totalTiles; i++) {
      const scrollY = i * viewportHeight;

      // Scroll to tile position
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (y) => window.scrollTo(0, y),
        args: [scrollY],
      });

      // Wait for rendering to settle
      await sleep(200);

      // Capture visible viewport
      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
        format: "png",
      });

      tiles.push({
        dataUrl,
        y: scrollY,
        index: i,
      });
    }

    // Restore original scroll position
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (x, y) => window.scrollTo(x, y),
      args: [originalScrollX, originalScrollY],
    });

    // Remove any injected styles (sticky fix)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const el = document.getElementById("__fss_style_override");
        if (el) el.remove();
      },
    });

    // Send tiles to offscreen document for stitching
    await ensureOffscreenDocument();

    const response = await chrome.runtime.sendMessage({
      action: "stitch-and-copy",
      tiles,
      fullWidth: viewportWidth * devicePixelRatio,
      fullHeight: scrollHeight * devicePixelRatio,
      viewportHeight: viewportHeight * devicePixelRatio,
      devicePixelRatio,
    });

    if (!response) throw new Error("No response from offscreen document");
    if (!response.success) throw new Error(response.error || "Failed to stitch image");

    // Inject content script into active tab to write the Data URL to clipboard
    // This bypasses the "Document is not focused" DOMException in offscreen documents
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: async (dataUrl) => {
        try {
          if (!document.hasFocus()) window.focus();
          const res = await fetch(dataUrl);
          const rawBlob = await res.blob();

          // CRITICAL FIX: explicitly Reconstruct the blob to force the exact MIME type.
          // Otherwise, certain apps (like Windows Clipboard/Explorer) might default to treating 
          // unstructured binary data as a generic file and randomly assign an .mp3 extension.
          const imgBlob = new Blob([rawBlob], { type: "image/png" });

          const item = new ClipboardItem({ "image/png": imgBlob });
          await navigator.clipboard.write([item]);
          return true;
        } catch (e) {
          throw new Error("Clipboard write failed: " + e.toString());
        }
      },
      args: [response.dataUrl],
    });

    const success = injectionResults[0]?.result;
    if (success !== true) {
      throw new Error("Content script clipboard write failed");
    }

    showBadge("✓", "#27ae60", 2000);
  } catch (err) {
    console.error("Screenshot capture failed:", err);
    showBadge("✗", "#e74c3c", 2000);
  } finally {
    isCapturing = false;
  }
});



// --- Helpers ---

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showBadge(text, color, clearAfterMs) {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color });
  if (clearAfterMs) {
    setTimeout(() => chrome.action.setBadgeText({ text: "" }), clearAfterMs);
  }
}

async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: "offscreen.html",
    reasons: ["CLIPBOARD"],
    justification: "Write full-page screenshot PNG to clipboard",
  });
}
