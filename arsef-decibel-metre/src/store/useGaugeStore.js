import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Gauges format: { id: string, name: string, maxValue: number, isEnabled: boolean, isActive: boolean (local only) }
// Note: isActive (which microphone is listening) is local to Admin so we don't necessarily sync it, but
// we do sync it so Display knows which one to highlight.
// We'll manage syncing manually via localStorage polling.

export const useGaugeStore = create(
  persist(
    (set, get) => ({
      gauges: [],
      settings: {
        publicFullscreen: false,
        minDb: 40,
        maxDb: 110,
        pageTitle: '',
        gaugeScale: 100,
        titleSize: 100,
        maxDbSize: 100,
        valueSize: 100,
        nameSize: 100
      },
      
      // Actions
      setPublicFullscreen: (val) => set((state) => ({
        settings: { ...state.settings, publicFullscreen: val }
      })),
      
      setSettings: (settings) => set({ settings }),
      
      addGauge: (name, recordTime = 0) => set((state) => {
        const newGauge = {
          id: crypto.randomUUID(),
          name,
          recordTime,
          currentValue: 0, // Not synced (real-time visual only)
          maxValue: 0,
          isEnabled: true,
          isActive: false
        };
        return { gauges: [...state.gauges, newGauge] };
      }),
      
      updateGaugeValue: (id, value) => set((state) => ({
        gauges: state.gauges.map(g => {
          if (g.id === id) {
            const newMax = Math.max(g.maxValue, value);
            return { ...g, currentValue: value, maxValue: newMax };
          }
          return g;
        })
      })),

      resetGauge: (id) => set((state) => ({
        gauges: state.gauges.map(g => g.id === id ? { ...g, maxValue: 0, currentValue: 0 } : g)
      })),

      deleteGauge: (id) => set((state) => ({
        gauges: state.gauges.filter(g => g.id !== id)
      })),

      toggleEnable: (id) => set((state) => ({
        gauges: state.gauges.map(g => g.id === id ? { ...g, isEnabled: !g.isEnabled } : g)
      })),

      setActiveGauge: (id) => set((state) => ({
        // Only one gauge active at a time
        gauges: state.gauges.map(g => ({ ...g, isActive: g.id === id }))
      })),

      stopAll: () => set((state) => ({
        gauges: state.gauges.map(g => ({ ...g, isActive: false, currentValue: 0 }))
      })),

      // For syncing
      setGauges: (gauges) => set({ gauges })
    }),
    {
      name: 'gauge-store',
      // We only want to persist certain fields ideally, but the whole array is fine for MVP.
      // We could use `partialize` to exclude currentValue.
      partialize: (state) => ({
        gauges: state.gauges.map(g => ({ ...g, currentValue: 0 })), // Don't persist live mic data
        settings: state.settings
      })
    }
  )
);
