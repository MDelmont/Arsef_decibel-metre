import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';

/**
 * Detects if the app is running in Tauri
 */
export function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

/**
 * Loads the WebviewWindow class dynamically in Tauri
 */
async function getWebviewWindow() {
    if (isTauri()) {
        const { WebviewWindow, getAllWebviewWindows } = await import('@tauri-apps/api/webviewWindow');
        return { WebviewWindow, getAllWebviewWindows };
    }
    return null;
}

/**
 * Opens the public display window
 */
export async function openDisplayWindow() {
  const displayUrl = "/display";
  const windowLabel = "public-display";

  if (isTauri()) {
    try {
      const { WebviewWindow, getAllWebviewWindows } = await getWebviewWindow();
      const windows = await getAllWebviewWindows();
      const existing = windows.find(w => w.label === windowLabel);

      if (existing) {
        await existing.setFocus();
        return existing;
      }

      // Create a new Tauri v2 WebviewWindow with the specific label
      const webview = new WebviewWindow(windowLabel, {
        url: displayUrl,
        title: "Arsef - Affichage Public",
        width: 1280,
        height: 720,
        resizable: true,
      });

      return webview;
    } catch (e) {
      console.error("Failed to open Tauri window", e);
    }
  }

  // Browser fallback
  const win = window.open(displayUrl, windowLabel, "width=1280,height=720");
  if (win) {
    window.publicDisplayWindow = win;
    win.focus();
  }
  return win;
}

/**
 * Toggles fullscreen for the public display window
 */
export async function toggleDisplayFullscreen(forceState) {
  const windowLabel = "public-display";

  if (isTauri()) {
    try {
      const { getAllWebviewWindows } = await getWebviewWindow();
      const windows = await getAllWebviewWindows();
      const target = windows.find(w => w.label === windowLabel);
      
      if (target) {
        const isFullscreen = forceState !== undefined ? !forceState : await target.isFullscreen();
        await target.setFullscreen(!isFullscreen);
        await target.setFocus();
        return;
      }
    } catch (e) {
      console.error("Tauri toggle fullscreen failed", e);
    }
  }

  // Browser fallback using postMessage
  const win = window.publicDisplayWindow;
  if (win && !win.closed) {
    win.postMessage({ type: "TOGGLE_FULLSCREEN", state: forceState }, window.location.origin);
    win.focus();
  }
}
