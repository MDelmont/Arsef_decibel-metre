import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window';

/**
 * Detects if the app is running in Tauri
 */
export function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI__;
}

// High-frequency sync channel for gauges
const GAUGE_SYNC_CHANNEL = 'arsef-gauge-sync';
const broadcastChannel = typeof window !== 'undefined' ? new BroadcastChannel(GAUGE_SYNC_CHANNEL) : null;

/**
 * Emits a high-frequency update for a gauge's current value.
 * Uses BroadcastChannel for browsers and Tauri Events for desktop.
 */
export async function emitGaugeUpdate(id, value) {
  const payload = { type: 'GAUGE_UPDATE', id, value };
  
  // 1. Browser/BroadcastChannel
  if (broadcastChannel) {
    broadcastChannel.postMessage(payload);
  }
  
  // 2. Tauri Events
  if (isTauri()) {
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('gauge-update', payload);
    } catch (e) {
      // Ignore if Tauri API not ready
    }
  }
}

/**
 * Listens for high-frequency gauge updates.
 * Returns an unlisten function.
 */
export function listenGaugeUpdate(callback) {
  // 1. Listen to BroadcastChannel
  const handleBroadcast = (event) => {
    if (event.data && event.data.id) {
      callback(event.data);
    }
  };
  
  if (broadcastChannel) {
    broadcastChannel.addEventListener('message', handleBroadcast);
  }
  
  // 2. Listen to Tauri Events (async setup)
  let unlistenTauri = null;
  if (isTauri()) {
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('gauge-update', (event) => {
        callback(event.payload);
      }).then(unsub => {
        unlistenTauri = unsub;
      });
    });
  }

  return () => {
    if (broadcastChannel) {
      broadcastChannel.removeEventListener('message', handleBroadcast);
    }
    if (unlistenTauri) {
      unlistenTauri();
    }
  };
}

/**
 * Loads the WebviewWindow class dynamically in Tauri (v2 preferred)
 */
async function getWebviewWindow() {
    if (!isTauri()) return null;
    try {
        const m = await import('@tauri-apps/api/webviewWindow');
        return m;
    } catch (e) {
        console.error("Tauri v2 webviewWindow import failed:", e);
        try {
            const m = await import('@tauri-apps/api/window');
            return m;
        } catch (e2) {
            console.error("Tauri v1 window import failed:", e2);
        }
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
      const tauri = await getWebviewWindow();
      if (!tauri) throw new Error("Tauri API not found");
      
      const { WebviewWindow } = tauri;
      
      // Use getByLabel if available (Tauri v2)
      const existing = WebviewWindow.getByLabel 
        ? await WebviewWindow.getByLabel(windowLabel) 
        : null;

      if (existing) {
        await existing.setFocus();
        return existing;
      }

      // Create a new Tauri WebviewWindow
      const webview = new WebviewWindow(windowLabel, {
        url: displayUrl,
        title: "Applaudimètre - Affichage Public",
        width: 1280,
        height: 720,
        resizable: true,
      });

      return webview;
    } catch (e) {
      console.error("Failed to open Tauri window:", e);
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
      const tauri = await getWebviewWindow();
      if (!tauri) return;
      
      const { WebviewWindow } = tauri;
      const target = WebviewWindow.getByLabel 
        ? await WebviewWindow.getByLabel(windowLabel) 
        : null;
      
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

/**
 * Quits the application and closes all windows
 */
export async function quitApp() {
  if (isTauri()) {
    try {
      const tauri = await getWebviewWindow();
      if (tauri && tauri.getAllWebviewWindows) {
        const windows = await tauri.getAllWebviewWindows();
        if (Array.isArray(windows)) {
          for (const win of windows) {
             await win.close();
          }
          return;
        }
      }
      // Fallback for current window
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (e) {
      console.error("Tauri quitApp failed:", e);
    }
  }

  // Browser fallback
  window.close();
}
