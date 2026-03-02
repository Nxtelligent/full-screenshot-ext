# Full Page Screenshot to Clipboard

One-click Chrome extension that captures a **full-page screenshot** and copies it to your clipboard as a PNG. Paste directly into Claude, ChatGPT, Gemini, or any app that accepts image paste.

## Installation

1. Unzip `full-screenshot-ext.zip`
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `full-screenshot-ext` folder
6. The icon appears in your toolbar — pin it for easy access

## Usage

1. Navigate to any webpage
2. Click the extension icon in the toolbar
3. Wait for the badge to show **✓** (usually 1-3 seconds)
4. **Ctrl+V** (or **Cmd+V** on Mac) to paste the screenshot anywhere

Works with: Claude, ChatGPT, Gemini, Slack, Discord, Google Docs, email, Paint, Photoshop, etc.

## How It Works

- Scrolls through the entire page capturing viewport-sized tiles
- Temporarily neutralizes fixed/sticky headers so they don't repeat
- Stitches tiles together on a hidden canvas
- Copies the final PNG to your clipboard via the Clipboard API

## Badge Indicators

- `...` = Capturing in progress
- `✓` = Success — screenshot on your clipboard
- `✗` = Failed (page not capturable, e.g. `chrome://` pages)

## Known Limitations

- **Very tall pages** (>16,384px device pixels) will be scaled down to fit browser canvas limits
- **Cross-origin iframes** will show whatever was visible but can't be independently scrolled
- Cannot capture `chrome://`, `edge://`, or Chrome Web Store pages (browser restriction)
- Pages with complex scroll containers (e.g., Google Maps) may not capture fully
- Lazy-loaded images below the fold may not appear if they haven't rendered yet

## Troubleshooting

- **Badge shows ✗**: You're likely on a restricted page. Try a regular website.
- **Sticky header appears multiple times**: The extension tries to neutralize sticky elements, but some heavily-styled sites may resist. Scrolling manually first can help.
- **Image is blank or cut off**: Try refreshing the page and capturing again. Some SPAs need a moment after navigation.
