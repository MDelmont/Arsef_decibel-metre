import React, { useState, useEffect } from 'react';
import { useGaugeStore } from '../store/useGaugeStore';
import { cn } from '@/lib/utils';
import { Maximize, Minimize, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri } from '../lib/windowUtils';

export default function DisplayPage() {
  const { gauges, setGauges, settings, setSettings } = useGaugeStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Sync logic between tabs/windows
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'gauge-store') {
        try {
          const newState = JSON.parse(e.newValue);
          if (newState && newState.state) {
            if (newState.state.gauges) setGauges(newState.state.gauges);
            if (newState.state.settings) setSettings(newState.state.settings);
          }
        } catch (err) {
          console.error("Failed to sync store from storage event", err);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setGauges, setSettings]);

  // Handle Fullscreen request from Admin (Store)
  useEffect(() => {
    const syncFullscreen = async () => {
        try {
          // In Tauri v2, the windowUtils handles it via direct API handle from Admin
          // But we can also check the synced settings.publicFullscreen for other cases.
          // In browser, this useEffect will trigger when store syncs, but it's not a user gesture.
          
          if (!isTauri() && settings.publicFullscreen && !document.fullscreenElement) {
              setShowFullscreenPrompt(true);
          } else if (!isTauri() && !settings.publicFullscreen && document.fullscreenElement) {
              document.exitFullscreen().catch(() => {});
          }
        } catch (e) {
          console.error("Store sync fullscreen failed", e);
        }
    };
    syncFullscreen();
  }, [settings.publicFullscreen]);

  // Browser Message Listener for TOGGLE_FULLSCREEN
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data && e.data.type === "TOGGLE_FULLSCREEN") {
        if (!document.fullscreenElement) {
          // If browser mode, we need a gesture, so show the prompt
          if (!isTauri()) {
            setShowFullscreenPrompt(true);
          } else {
            // In Tauri, we'll let the direct API handle it, 
            // but just in case we are in a webview without direct handle access:
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Filter only enabled gauges for the public display
  const enabledGauges = gauges.filter(g => g.isEnabled);

  const toggleFullscreen = async () => {
    try {
      const appWindow = getCurrentWindow();
      const current = await appWindow.isFullscreen();
      await appWindow.setFullscreen(!current);
      setIsFullscreen(!current);
    } catch (e) {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error(err));
        setIsFullscreen(true);
      } else {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 overflow-hidden font-sans relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a2e_0%,#000000_100%)] opacity-50 z-0" />
      
      {/* Animated subtle grid */}
      <div className="absolute inset-0 z-0 opacity-10" 
           style={{ 
             backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
             backgroundSize: '40px 40px' 
           }} 
      />

      <div className="absolute top-6 right-6 z-20 flex gap-4 items-center">
      </div>

      {showFullscreenPrompt && (
        <div className="absolute inset-0 bg-black/80 grid place-items-center z-50 p-6 backdrop-blur-sm">
          <div className="p-8 rounded-2xl bg-card border border-border text-card-foreground max-w-sm text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="space-y-2">
              <div className="font-bold text-2xl tracking-tight">Activer le plein écran</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                L'administration a demandé le passage en plein écran. Cliquez ci-dessous pour confirmer.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button 
                onClick={() => {
                  document.documentElement.requestFullscreen().catch(() => {});
                  setShowFullscreenPrompt(false);
                }}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-6 rounded-xl transition-all"
              >
                Passer en plein écran
              </Button>
              <Button 
                variant="ghost"
                onClick={() => setShowFullscreenPrompt(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="z-10 w-full max-w-7xl flex flex-col items-center gap-12">
        <div className="flex flex-col items-center gap-2">
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter uppercase text-white/90">
                Performance Audio
            </h1>
            <div className="h-1 w-32 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
        </div>

        <div className={cn(
            "grid w-full gap-8",
            enabledGauges.length <= 1 ? "grid-cols-1 max-w-xl" : 
            enabledGauges.length === 2 ? "grid-cols-2" : 
            "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        )}>
          {enabledGauges.map((gauge) => (
            <PublicGaugeCard key={gauge.id} gauge={gauge} />
          ))}

          {enabledGauges.length === 0 && (
             <div className="col-span-full py-20 text-center">
                <p className="text-muted-foreground text-xl">Aucune jauge active pour le moment...</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicGaugeCard({ gauge }) {
  // We use MIN/MAX constants for relative movement
  const MIN_DB = 40;
  const MAX_DB = 110;
  
  const percentage = ((gauge.currentValue - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
  const safePercentage = Math.min(100, Math.max(0, percentage));
  
  return (
    <div className={cn(
        "relative rounded-3xl p-8 flex flex-col items-center gap-6 transition-all duration-500",
        gauge.isActive 
            ? "bg-white/10 border-2 border-primary/50 shadow-[0_0_40px_rgba(var(--primary),0.2)] scale-105" 
            : "bg-white/5 border border-white/10 opacity-80"
    )}>
      {/* Active Indicator */}
      {gauge.isActive && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-full animate-pulse uppercase tracking-widest shadow-lg">
            En direct
          </div>
      )}

      <h2 className="text-2xl md:text-3xl font-bold text-center truncate w-full">
          {gauge.name}
      </h2>

      <div className="flex items-end gap-6 w-full h-[400px]">
          {/* Vertical Thermometer */}
          <div className="w-24 flex-shrink-0 h-full bg-black/40 rounded-full border border-white/10 relative overflow-hidden flex items-end shadow-inner">
             <div 
                className="w-full transition-all duration-75 ease-out rounded-b-full bg-gradient-to-t from-green-500 via-yellow-400 to-red-500"
                style={{ height: `${safePercentage}%` }}
             >
                {/* Glow on top of liquid */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/40 blur-[2px]" />
             </div>

             {/* Ticks */}
             <div className="absolute inset-0 flex flex-col justify-between py-8 px-4 pointer-events-none opacity-20">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="w-full h-[1px] bg-white" />
                ))}
             </div>
          </div>

          <div className="flex-1 flex flex-col justify-end gap-8 h-full pb-4">
              <div className="space-y-1">
                  <div className="text-sm font-medium uppercase tracking-widest text-white/50">Current</div>
                  <div className="text-5xl font-black tabular-nums tracking-tighter">
                      {gauge.currentValue}<span className="text-xl text-white/30 ml-1">dB</span>
                  </div>
              </div>

              <div className="space-y-1">
                  <div className="text-sm font-medium uppercase tracking-widest text-primary/70">Peak Record</div>
                  <div className="text-7xl font-black tabular-nums tracking-tighter text-primary shadow-primary/20 drop-shadow-lg">
                      {gauge.maxValue}
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
}
