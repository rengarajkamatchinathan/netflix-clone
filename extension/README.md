# Streamflix Channel Logo (Chrome / Edge / Brave extension)

While a Streamflix channel page is open, shows that channel's logo on every other tab: transparent,
no window around it, like a TV station's corner logo.

## Install (unpacked)

1. Open `chrome://extensions` (`edge://extensions`, `brave://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and pick this `extension/` folder.
3. Reload any open Streamflix tab.

## Use

- Open a channel page. Every other tab (YouTube or any site) shows its logo.
- Change channel and the logo changes everywhere. Leave or close the channel page and it goes away.
- Drag the logo anywhere. Right-click it (or Shift+F10) for size, free resize, opacity, corners,
  reset and hide. Position and size are shared by all tabs.
- After **Hide logo**, click the extension's toolbar button to bring it back.

## How it works

- `bridge.js` runs on Streamflix. The page posts the current channel (stored with its logo as a data
  URL) and whether a channel page is open. While one is, it holds a port to `background.js`.
- `background.js` sets `active` while any channel page holds a port, so closing the tab clears it.
- `overlay.js` runs on every other http(s) page, in every frame, and draws the logo in a closed
  shadow root while `active` is set, following storage changes live.
- Fullscreen: the logo is a popover, so it sits in the same top layer as fullscreen content and
  re-enters it on every fullscreen change. The frame holding the fullscreen content draws it,
  inside the fullscreen element, so it stays draggable; that frame tells the frames above it to
  stand down. Embedded players (cinehd → stellarconductornexus) work this way.

Limits:

- Browsers don't run extensions on their own pages (`chrome://`, the Web Store, new tab page), so
  the logo can't appear there.
- When a site puts a bare `<video>` into fullscreen, or its player is in a frame the extension
  can't run in, the logo still shows but can't be dragged until fullscreen ends.
- Some sites' security rules may block the logo image.
- After reloading the extension, refresh open tabs: they keep running the old copy until then.

Streamflix only runs on `localhost` today. When it's deployed, add its domain to the `bridge.js`
`matches` and the overlay's `exclude_matches` in `manifest.json`.
