import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Gauges format: { id, name, maxValue, isEnabled, isActive, currentValue, recordTime }
// isActive and currentValue are NEVER persisted — they reset to defaults on app start.

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
        nameSize: 100,
        gaugeGap: 4,
        showGauges: true,
      },

      // ── Settings ─────────────────────────────────────────────
      setPublicFullscreen: (val) =>
        set((state) => ({ settings: { ...state.settings, publicFullscreen: val } })),

      setSettings: (settings) => set({ settings }),

      // ── Gauge CRUD ────────────────────────────────────────────
      addGauge: (name, recordTime = 0) =>
        set((state) => ({
          gauges: [
            ...state.gauges,
            {
              id: crypto.randomUUID(),
              name,
              recordTime,
              currentValue: 0,
              maxValue: 0,
              isEnabled: true,
              isActive: false,
            },
          ],
        })),

      updateGaugeValue: (id, value) =>
        set((state) => ({
          gauges: state.gauges.map((g) => {
            if (g.id !== id) return g;
            return { ...g, currentValue: value, maxValue: Math.max(g.maxValue, value) };
          }),
        })),

      resetGauge: (id) =>
        set((state) => ({
          gauges: state.gauges.map((g) =>
            g.id === id ? { ...g, maxValue: 0, currentValue: 0 } : g
          ),
        })),

      deleteGauge: (id) =>
        set((state) => ({ gauges: state.gauges.filter((g) => g.id !== id) })),

      updateGauge: (id, updates) =>
        set((state) => ({
          gauges: state.gauges.map((g) => (g.id === id ? { ...g, ...updates } : g)),
        })),

      moveGauge: (id, direction) =>
        set((state) => {
          const index = state.gauges.findIndex((g) => g.id === id);
          if (index === -1) return state;
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= state.gauges.length) return state;
          const nextGauges = [...state.gauges];
          const [moved] = nextGauges.splice(index, 1);
          nextGauges.splice(newIndex, 0, moved);
          return { gauges: nextGauges };
        }),

      toggleEnable: (id) =>
        set((state) => ({
          gauges: state.gauges.map((g) =>
            g.id === id ? { ...g, isEnabled: !g.isEnabled } : g
          ),
        })),

      // Only one gauge active at a time; pass null to deactivate all
      setActiveGauge: (id) =>
        set((state) => ({
          gauges: state.gauges.map((g) => ({ ...g, isActive: g.id === id })),
        })),

      stopAll: () =>
        set((state) => ({
          gauges: state.gauges.map((g) => ({ ...g, isActive: false, currentValue: 0 })),
        })),

      // Used by DisplayPage to sync from localStorage
      setGauges: (gauges) => set({ gauges }),

      // ── Export / Import ───────────────────────────────────────
      exportSnapshot: () => {
        const { gauges, settings } = get();
        return {
          version: 1,
          exportedAt: new Date().toISOString(),
          gauges: gauges.map((g) => ({ ...g, isActive: false, currentValue: 0 })),
          settings,
        };
      },

      importSnapshot: (snapshot = {}) => {
        const { gauges: nextGauges, settings: nextSettings } = snapshot;
        set((state) => ({
          gauges: Array.isArray(nextGauges)
            ? nextGauges.map((g) => ({ ...g, isActive: false, currentValue: 0 }))
            : state.gauges,
          settings:
            nextSettings && typeof nextSettings === 'object'
              ? { ...state.settings, ...nextSettings }
              : state.settings,
        }));
      },
    }),
    {
      name: 'gauge-store',
      partialize: (state) => ({
        // currentValue is intentionally excluded from persistence (high-frequency)
        // isActive is now included to allow sync between Admin and Public windows
        gauges: state.gauges.map((g) => ({ ...g, currentValue: 0 })),
        settings: state.settings,
      }),
    }
  )
);
