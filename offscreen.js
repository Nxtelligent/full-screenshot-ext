// offscreen.js — Receives tile images, stitches on canvas, writes to clipboard

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "stitch-and-copy") {
    handleStitchAndCopy(msg)
      .then((dataUrl) => {
        sendResponse({ success: true, dataUrl });
      })
      .catch((err) => {
        console.error("Stitch error:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function handleStitchAndCopy({ tiles, fullWidth, fullHeight, viewportHeight, devicePixelRatio }) {
  const MAX_CANVAS_DIM = 16384;

  let canvasWidth = fullWidth;
  let canvasHeight = fullHeight;
  let scaleFactor = 1;

  if (canvasHeight > MAX_CANVAS_DIM) {
    scaleFactor = MAX_CANVAS_DIM / canvasHeight;
    canvasWidth = Math.round(canvasWidth * scaleFactor);
    canvasHeight = MAX_CANVAS_DIM;
  }
  if (canvasWidth > MAX_CANVAS_DIM) {
    const widthScale = MAX_CANVAS_DIM / canvasWidth;
    scaleFactor *= widthScale;
    canvasWidth = MAX_CANVAS_DIM;
    canvasHeight = Math.round(canvasHeight * widthScale);
  }

  const canvas = document.getElementById("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // Pre-load all tile images in parallel
  const images = await Promise.all(tiles.map((t) => loadImage(t.dataUrl)));

  for (let i = 0; i < tiles.length; i++) {
    const img = images[i];
    const tile = tiles[i];

    if (i === tiles.length - 1 && tiles.length > 1) {
      // Last tile handling: browser clamps scroll to (scrollHeight - viewportHeight).
      // So the actual scroll position may be less than what we requested.
      const scrollHeightCSS = fullHeight / devicePixelRatio;
      const viewportCSS = viewportHeight / devicePixelRatio;
      const actualScrollY = Math.min(tile.y, scrollHeightCSS - viewportCSS);
      const actualScrollYPx = actualScrollY * devicePixelRatio;

      // Where previous tiles have drawn up to (in device pixels)
      const prevCoverage = tile.y * devicePixelRatio;
      // How many pixels in this tile overlap with already-drawn content
      const overlapPx = prevCoverage - actualScrollYPx;

      if (overlapPx > 0 && overlapPx < img.height) {
        // Crop out the overlapping top portion, draw only the new bottom strip
        const srcY = overlapPx;
        const srcH = img.height - overlapPx;
        const dstY = prevCoverage * scaleFactor;
        ctx.drawImage(
          img,
          0, srcY, img.width, srcH,
          0, dstY, img.width * scaleFactor, srcH * scaleFactor
        );
      } else {
        ctx.drawImage(img, 0, actualScrollYPx * scaleFactor, img.width * scaleFactor, img.height * scaleFactor);
      }
    } else {
      // Normal tile
      const destY = tile.y * devicePixelRatio * scaleFactor;
      ctx.drawImage(img, 0, destY, img.width * scaleFactor, img.height * scaleFactor);
    }
  }

  // Create a Blob to trigger the download directly from the offscreen document
  // This completely bypasses Chrome's size limits for downloading Data URIs.
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob returned null — image may be too large"));
      },
      "image/png"
    );
  });

  const blobUrl = URL.createObjectURL(blob);
  const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `full-page-screenshot-${dateStr}.png`;

  chrome.downloads.download({
    url: blobUrl,
    filename: filename,
    saveAs: false
  }, () => {
    // Revoke object URL after a short delay to free memory
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  });

  // Return data URL to background script for clipboard writing
  return canvas.toDataURL("image/png");
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load tile image"));
    img.src = dataUrl;
  });
}
