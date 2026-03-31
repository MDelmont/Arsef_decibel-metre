import React, { useState, useEffect, useRef } from 'react';
import { useGaugeStore } from '../store/useGaugeStore';
import { cn } from '@/lib/utils';
import { isTauri, listenGaugeUpdate } from '../lib/windowUtils';

export default function DisplayPage() {
  const { gauges, setGauges, settings, setSettings } = useGaugeStore();
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);

  // Sync logic between tabs/windows via store
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
          console.error("Failed to sync store", err);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setGauges, setSettings]);

  // Handle Fullscreen request
  useEffect(() => {
    if (!isTauri() && settings.publicFullscreen && !document.fullscreenElement) {
        setShowFullscreenPrompt(true);
    } else if (!isTauri() && !settings.publicFullscreen && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
    }
  }, [settings.publicFullscreen]);

  const enabledGauges = gauges.filter(g => g.isEnabled);
  const titleScale = (settings.titleSize || 100) / 100;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-8 overflow-hidden font-sans relative">
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,#1a1a2e_0%,#000000_100%)] opacity-50 z-0" />
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {showFullscreenPrompt && (
        <div className="absolute inset-0 bg-black/80 grid place-items-center z-50 p-6 backdrop-blur-sm">
          <div className="p-8 rounded-2xl bg-card border border-border text-card-foreground max-w-sm text-center space-y-6 shadow-2xl">
            <h2 className="font-bold text-2xl tracking-tight">Plein écran requis</h2>
            <button onClick={() => { document.documentElement.requestFullscreen(); setShowFullscreenPrompt(false); }} className="w-full bg-primary py-4 rounded-xl font-bold">Activer</button>
          </div>
        </div>
      )}

      <div className="z-10 w-full max-w-[95vw] flex flex-col items-center gap-12">
        {/* Title Header */}
        <div className="flex flex-col items-center gap-2 transition-all duration-500">
            <h1 
                className="font-black italic tracking-tighter uppercase text-white/100 drop-shadow-sm text-center px-4"
                style={{ fontSize: `${3 * titleScale}rem`, lineHeight: 1 }}
            >
                {settings.pageTitle || ""}
            </h1>
            {settings.pageTitle && <div className="h-1 bg-primary rounded-full transition-all duration-500" style={{ width: `${8 * titleScale}rem` }} />}
        </div>

        {/* Gauges Row */}
        <div 
          className="flex flex-wrap justify-center items-start w-full"
          style={{ 
            columnGap: `${settings.gaugeGap}vw`, 
            rowGap: '4rem' 
          }}
        >
          {enabledGauges.map((gauge) => (
            <PublicGaugeCard key={gauge.id} gauge={gauge} settings={settings} />
          ))}
          {enabledGauges.length === 0 && <p className="text-muted-foreground text-xl">Aucune jauge active...</p>}
        </div>
      </div>
    </div>
  );
}

const PublicGaugeCard = React.memo(({ gauge, settings }) => {
  const liquidRef = useRef(null);
  const peakLiquidRef = useRef(null);
  const peakValueRef = useRef(0);
  const valueTextRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  const scale = (settings.gaugeScale || 100) / 100;
  const maxDbRatio = (settings.maxDbSize || 100) / 100;
  const valueRatio = (settings.valueSize || 100) / 100;
  const nameRatio = (settings.nameSize || 100) / 100;

  useEffect(() => {
    const handleUpdate = (data) => {
        // data from listenGaugeUpdate is already the payload: { type, id, value }
        if (data && data.type === 'GAUGE_UPDATE' && data.id === gauge.id) {
            const val = data.value;
            const min = settings.minDb || 40;
            const max = settings.maxDb || 110;
            const p = Math.min(Math.max(((val - min) / (max - min)) * 100, 0), 100);

            // 1. Direct DOM update for liquid (60fps)
            if (liquidRef.current) {
                liquidRef.current.style.height = `${p}%`;
                // Avoid sub-pixel bleeding at zero height
                liquidRef.current.style.opacity = p > 0 ? '1' : '0.001';
            }

            // 1b. Direct DOM update for peak-hold
            if (p > peakValueRef.current) {
                peakValueRef.current = p;
                if (peakLiquidRef.current) {
                    peakLiquidRef.current.style.height = `${p}%`;
                    peakLiquidRef.current.style.opacity = p > 0 ? '1' : '0';
                }
            }

            // 2. Direct DOM update for text
            if (valueTextRef.current) {
                valueTextRef.current.textContent = Math.round(val) || "";
            }

            // 3. Sync Timeout to clear display if signal lost
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
            syncTimeoutRef.current = setTimeout(() => {
                if (liquidRef.current) {
                    liquidRef.current.style.height = '0%';
                    liquidRef.current.style.opacity = '0';
                }
                if (valueTextRef.current) valueTextRef.current.textContent = '';
            }, 1000);
        }
    };
    return listenGaugeUpdate(handleUpdate);
  }, [gauge.id, settings.minDb, settings.maxDb]);

  // Handle manual peak reset
  useEffect(() => {
    if (gauge.maxValue === 0) {
        peakValueRef.current = 0;
        if (peakLiquidRef.current) {
            peakLiquidRef.current.style.height = '0%';
            peakLiquidRef.current.style.opacity = '0';
        }
    }
  }, [gauge.maxValue]);

  const getIntensityColor = (val) => {
    const min = settings.minDb || 40;
    const max = settings.maxDb || 110;
    const p = (val - min) / (max - min);
    if (p < 0.3) return "text-green-500";
    if (p < 0.75) return "text-yellow-400";
    return "text-red-500";
  };

  return (
    <div className={cn("flex flex-col items-center transition-all duration-500", !gauge.isEnabled && "opacity-20")} style={{ width: `${180 * scale}px` }}>
        {/* Peak dB Value */}
        <div 
            className={cn("font-black tabular-nums tracking-tighter drop-shadow-md mb-2", gauge.isActive ? getIntensityColor(gauge.maxValue) : "text-white/60")}
            style={{ fontSize: `${2.25 * maxDbRatio * scale}rem`, lineHeight: 1 }}
        >
            {gauge.maxValue > 0 ? gauge.maxValue : "--"}
        </div>

        {/* Gauge Container */}
        <div 
            className={cn("w-full border-4 rounded-3xl relative overflow-hidden flex items-end shadow-2xl transition-all duration-500 bg-black/40", gauge.isActive ? "border-white/100 scale-[1.02]" : "border-white/60")}
            style={{ height: `${420 * scale}px` }}
        >
            {/* Peak Level (Sub-gauge) - Pale version */}
            <div 
                ref={peakLiquidRef}
                className="absolute left-0 right-0 bottom-0 overflow-hidden rounded-b-xl" 
                style={{ 
                    height: '0%', 
                    opacity: 0,
                    background: `linear-gradient(to top, #22c55e, #facc15, #ef4444) bottom / 100% ${420 * scale}px no-repeat`,
                    filter: 'saturate(0.4) brightness(0.5)'
                }}
            />

            {/* Liquid Level - Simplified background-based gradient to fix all edge-bleed artifacts */}
            <div 
                ref={liquidRef}
                className="w-full relative overflow-hidden rounded-b-xl z-10" 
                style={{ 
                    height: '0%', 
                    opacity: 0,
                    background: `linear-gradient(to top, #22c55e, #facc15, #ef4444) bottom / 100% ${420 * scale}px no-repeat`
                }}
            >
                {/* Cap line - dynamic thickness */}
                {gauge.isActive && <div className="absolute top-0 left-0 right-0 z-10 bg-white/50" style={{ height: `${Math.max(1, 2 * scale)}px` }} />}
            </div>

            {/* Ticks - Dynamic scaling */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-30" style={{ padding: `${40 * scale}px ${16 * scale}px` }}>
                {[...Array(11)].map((_, i) => (
                    <div 
                        key={i} 
                        className="bg-white rounded-full transition-all duration-500" 
                        style={{ 
                            width: `${(i % 5 === 0 ? 32 : 20) * scale}px`, 
                            height: `${Math.max(1, 2 * scale)}px` 
                        }} 
                    />
                ))}
            </div>

            {/* Current Value Overlay */}
            <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center pointer-events-none z-20">
                <div 
                    ref={valueTextRef}
                    className={cn("font-black tracking-tighter tabular-nums drop-shadow-lg transition-all", gauge.isActive ? "text-white scale-110" : "text-white/60")}
                    style={{ fontSize: `${2.5 * valueRatio * scale}rem`, lineHeight: 0.8 }}
                >
                </div>
            </div>
        </div>

        {/* Gauge Name */}
        {gauge.name && (
            <div 
                className={cn(
                    "mt-6 font-black uppercase italic tracking-widest text-center px-4 transition-all duration-500 break-all leading-tight w-full",
                    gauge.isActive ? "text-primary scale-105" : "text-white/60"
                )}
                style={{ fontSize: `${1.25 * nameRatio * scale}rem` }}
            >
                {gauge.name}
            </div>
        )}
    </div>
  );
});
