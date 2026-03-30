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
  const payload = { id, value };
  
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
