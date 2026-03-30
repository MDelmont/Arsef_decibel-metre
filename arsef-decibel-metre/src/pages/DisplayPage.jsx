import React, { useState, useEffect } from 'react';
import { useGaugeStore } from '../store/useGaugeStore';
import { cn } from '@/lib/utils';
import { Maximize, Minimize, Activity } from 'lucide-react';
import { Button } from '../components/ui/button';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauri, listenGaugeUpdate } from '../lib/windowUtils';

export default function DisplayPage() {
  const { gauges, setGauges, settings, setSettings } = useGaugeStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [liveValues, setLiveValues] = useState({});

  // Sync logic between tabs/windows
  useEffect(() => {
    const unlisten = listenGaugeUpdate(({ id, value }) => {
      setLiveValues(prev => ({ ...prev, [id]: value }));
    });
    return unlisten;
  }, []);

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

      <div className="z-10 w-full max-w-[95vw] flex flex-col items-center gap-16">
        {/* Title Header */}
        <div className="flex flex-col items-center gap-2">
            <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-white/90 drop-shadow-sm text-center px-4">
                {settings.pageTitle || "Compteur de Performance"}
            </h1>
            <div className="h-1 w-32 bg-primary rounded-full shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
        </div>

        {/* Gauges Row (Wrapping) */}
        <div className="flex flex-wrap justify-center items-start gap-x-12 gap-y-16 w-full">
          {enabledGauges.map((gauge) => (
            <PublicGaugeCard 
                key={gauge.id} 
                gauge={gauge} 
                liveValue={liveValues[gauge.id]} 
                minDb={settings.minDb} 
                maxDb={settings.maxDb} 
            />
          ))}

          {enabledGauges.length === 0 && (
             <div className="w-full py-20 text-center">
                <p className="text-muted-foreground text-xl">Aucune jauge active pour le moment...</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PublicGaugeCard({ gauge, liveValue, minDb, maxDb }) {
  // Use settings or fallbacks
  const MIN_DB = minDb || 40;
  const MAX_DB = maxDb || 110;
  
  // Only show live movement if the gauge is active
  const currentVal = gauge.isActive ? (liveValue !== undefined ? liveValue : gauge.currentValue) : 0;
  const percentage = ((currentVal - MIN_DB) / (MAX_DB - MIN_DB)) * 100;
  const safePercentage = Math.min(100, Math.max(0, percentage));

  // Determine color based on intensity for the Max DB text
  const getIntensityColor = (val) => {
    const range = MAX_DB - MIN_DB;
    const p = (val - MIN_DB) / range;
    if (p < 0.3) return "text-green-400";
    if (p < 0.75) return "text-yellow-400";
    return "text-red-500";
  };
  
  return (
    <div className={cn(
        "flex flex-col items-center gap-8 min-w-[200px] transition-all duration-500",
        gauge.isActive ? "scale-110" : "opacity-70"
    )}>
      
      {/* 1. TOP: Max DB Value */}
      <div className="flex flex-col items-center gap-0">
          <div className={cn(
              "text-7xl font-black tabular-nums tracking-tighter transition-all duration-300 drop-shadow-md",
              gauge.isActive ? getIntensityColor(currentVal) : "text-white"
          )}>
              {gauge.maxValue || 0}
          </div>
          <div className="text-sm font-bold uppercase tracking-widest text-muted-foreground/80">
              Db max
          </div>
      </div>

      {/* 2. MIDDLE: Vertical Gauge */}
      <div className="relative flex items-center justify-center">
          {/* Active Indicator Pulse */}
          {gauge.isActive && (
              <div className="absolute -inset-4 bg-primary/10 rounded-3xl blur-2xl animate-pulse -z-10" />
          )}

          <div className={cn(
              "w-28 h-[420px] rounded-2xl bg-black/40 border-2 overflow-hidden flex items-end shadow-2xl transition-all duration-500 relative",
              gauge.isActive ? "border-white/80 shadow-primary/10" : "border-white/60"
          )}>
              {/* Liquid Level (Clipping Mask) */}
              <div 
                className="w-full transition-all duration-75 ease-out rounded-b-lg relative overflow-hidden"
                style={{ height: `${safePercentage}%` }}
              >
                {/* The actual gradient (Absolute Positioned at the bottom of the gauge) */}
                <div className="absolute bottom-0 left-0 w-full h-[420px] bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 shadow-[inset_0_0_20px_rgba(0,0,0,0.3)]">
                    {/* Glow on top of liquid */}
                    {currentVal > 0 && <div className="absolute top-0 left-0 right-0 h-2 bg-white/100 blur-[2px] z-10" />}
                </div>
                
                {/* Internal Current Value Overlay (Small) */}
                {gauge.isActive && currentVal > 0 && (
                    <div className="absolute top-2 left-0 right-0 text-center font-bold text-xs text-white/100 mix-blend-overlay z-20">
                        {currentVal}
                    </div>
                )}
              </div>

              {/* Graduation Ticks (Side side) */}
              <div className="absolute inset-0 flex flex-col justify-between py-10 px-2 pointer-events-none opacity-100">
                {[...Array(11)].map((_, i) => (
                    <div key={i} className="flex items-center gap-1">
                        <div className={cn("w-3 h-[1.5px] ", gauge.isActive ? "bg-white" : "bg-white/60")} />
                    </div>
                ))}
              </div>
          </div>
      </div>

      <div className="w-full flex-1 flex flex-col items-center pt-2">
          <p className={cn(
              "text-2xl md:text-3xl font-black text-center tracking-tight max-w-[220px] leading-[1.1] transition-all italic break-words",
              gauge.isActive ? "text-white scale-105" : "text-white/80"
          )}>
              {gauge.name || ""}
          </p>
      </div>

    </div>
  );
}
