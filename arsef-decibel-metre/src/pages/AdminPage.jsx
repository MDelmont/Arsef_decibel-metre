import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGaugeStore } from '../store/useGaugeStore';
import { useAudioProcessor } from '../hooks/useAudioProcessor';
import { cn } from '@/lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { 
  Monitor, Plus, Trash2, RotateCcw, Mic, MicOff, Settings, Activity, 
  Moon, Sun, MonitorPlay, Maximize, Minimize, LogOut, Download, Upload,
  ChevronUp, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { openDisplayWindow, toggleDisplayFullscreen, isTauri, quitApp } from '../lib/windowUtils';
import { Info } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

const InfoTooltip = ({ text }) => (
  <span className="group relative inline-block ml-1.5 cursor-help align-middle">
    <Info className="h-4 w-4 text-muted-foreground/60 hover:text-primary transition-colors" />
    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 w-56 bg-popover text-popover-foreground text-[11px] font-normal rounded-lg border border-border shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 leading-normal normal-case tracking-normal">
      {text}
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-border" />
      <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-popover translate-y-[-1px]" />
    </span>
  </span>
);

export default function AdminPage() {
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(true);
  const activeTimerRef = useRef(null);

  const {
    isListening,
    microphones,
    selectedMicId,
    startListening,
    stopListening,
    ballistic,
    setBallistic,
    calibrationOffset,
    setCalibrationOffset,
    isClipping,
    currentDb,
    localMaxDb,
    resetLocalMaxDb,
    getGaugePercentage
  } = useAudioProcessor();

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    if (isDark) {
      html.classList.remove('dark');
      setIsDark(false);
    } else {
      html.classList.add('dark');
      setIsDark(true);
    }
  };

  const handleQuit = async () => {
    await quitApp();
  };

  const [newGaugeName, setNewGaugeName] = useState('');
  const [newGaugeTime, setNewGaugeTime] = useState('');
  
  const { 
    gauges, addGauge, resetGauge, deleteGauge, toggleEnable, 
    setActiveGauge, settings, setPublicFullscreen, 
    exportSnapshot, importSnapshot, updateGauge, moveGauge 
  } = useGaugeStore();

  const handleExport = () => {
    try {
      const data = exportSnapshot();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const date = new Date().toISOString().split('T')[0];
      anchor.href = url;
      anchor.download = `applaudimetre-preset-${date}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed", error);
      alert("Erreur lors de l'exportation.");
    }
  };

  const fileInputRef = useRef(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      importSnapshot(payload);
      alert("Importation réussie !");
      // Reset input
      e.target.value = '';
    } catch (error) {
      console.error("Import failed", error);
      alert(`Erreur lors de l'importation : ${error.message}`);
    }
  };

  const handleAddGauge = (e) => {
    e.preventDefault();
    addGauge(newGaugeName.trim(), parseInt(newGaugeTime) || 0);
    setNewGaugeName('');
    setNewGaugeTime('');
  };

  const handleResetAll = () => {
    gauges.forEach(g => resetGauge(g.id));
  };
  
  const handleToggleListen = (gauge) => {
    if (activeTimerRef.current) {
        clearTimeout(activeTimerRef.current);
        activeTimerRef.current = null;
    }
    
    if (gauge.isActive) {
        setActiveGauge(null);
    } else {
        setActiveGauge(gauge.id);
        if (gauge.recordTime > 0) {
            activeTimerRef.current = setTimeout(() => {
                setActiveGauge(null);
                activeTimerRef.current = null;
            }, gauge.recordTime * 1000);
        }
    }
  };

  const activeGauge = gauges.find(g => g.isActive);
  const displayMax = activeGauge ? activeGauge.maxValue : localMaxDb;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans transition-colors duration-200 p-6">
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration - Applaudimètre</h1>
          <p className="text-muted-foreground">Paramètres et gestion des jauges.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={toggleTheme} title="Thème">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          <Button 
            variant={settings.publicFullscreen ? "default" : "outline"} 
            size="icon" 
            onClick={() => {
                const newState = !settings.publicFullscreen;
                setPublicFullscreen(newState);
                toggleDisplayFullscreen(newState);
            }} 
            className={cn(settings.publicFullscreen && "bg-primary text-primary-foreground")}
          >
            {settings.publicFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

          <Button variant="default" onClick={() => openDisplayWindow()} className="font-semibold gap-2">
            <MonitorPlay className="h-5 w-5" />
            Affichage Public
          </Button>

          <Button variant="outline" size="icon" onClick={handleImportClick} title="Importer les paramètres">
            <Download className="h-5 w-5" />
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json" 
              onChange={handleImportFile} 
            />
          </Button>

          <Button variant="outline" size="icon" onClick={handleExport} title="Exporter les paramètres">
            <Upload className="h-5 w-5" />
          </Button>

          <Button 
            variant={settings.showGauges ? "outline" : "default"} 
            size="icon" 
            onClick={() => useGaugeStore.getState().setSettings({ ...settings, showGauges: !settings.showGauges })} 
            title={settings.showGauges ? "Masquer l'écran public" : "Afficher la page public"}
          >
            {settings.showGauges ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          </Button>

          <Button variant="destructive" size="icon" onClick={handleQuit}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 outline-none">
        <div className="space-y-6">
           <div className="flex items-center justify-between border-b border-border pb-2">
               <h2 className="text-xl font-semibold">Création de jauge</h2>
               <Button variant="outline" onClick={handleResetAll}>Reset All</Button>
           </div>

           <form onSubmit={handleAddGauge} className="flex items-end gap-3">
             <div className="flex-1 space-y-1">
               <label className="text-sm font-medium text-muted-foreground">Nom (Optionnel)</label>
               <Input 
                 placeholder={`Ex: Jauge ${gauges.length + 1}`} 
                 value={newGaugeName} 
                 onChange={(e) => setNewGaugeName(e.target.value)} 
               />
             </div>
             <div className="w-24 space-y-1">
               <label className="text-sm font-medium text-muted-foreground">Temps (s)</label>
               <Input 
                 type="number" 
                 placeholder="∞" 
                 value={newGaugeTime} 
                 onChange={(e) => setNewGaugeTime(e.target.value)} 
               />
             </div>
             <Button type="submit">Ajouter</Button>
           </form>

           <div className="border border-border rounded-md overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                   <tr>
                    <th className="px-2 py-3 w-10"></th>
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium text-center w-24">Durée</th>
                    <th className="px-4 py-3 font-medium text-center w-24 text-nowrap">Db Max</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gauges.length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-muted-foreground">Aucune jauge.</td></tr>
                  ) : (
                    gauges.map((gauge, index) => (
                      <tr key={gauge.id} className="transition-colors hover:bg-muted/30 group">
                        <td className="px-2 py-3">
                          <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              disabled={index === 0} 
                              onClick={() => moveGauge(gauge.id, 'up')}
                              className="text-muted-foreground hover:text-primary disabled:opacity-20"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button 
                              disabled={index === gauges.length - 1} 
                              onClick={() => moveGauge(gauge.id, 'down')}
                              className="text-muted-foreground hover:text-primary disabled:opacity-20"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className={cn("px-4 py-2 font-medium", !gauge.isEnabled && "opacity-50 text-muted-foreground")}>
                          <Input 
                            value={gauge.name} 
                            onChange={(e) => updateGauge(gauge.id, { name: e.target.value })}
                            placeholder={`Jauge ${index + 1}`}
                            className="bg-transparent border-transparent hover:border-border focus:bg-background h-8 px-2 -ml-2"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Input 
                              type="number"
                              value={gauge.recordTime || ''} 
                              onChange={(e) => updateGauge(gauge.id, { recordTime: parseInt(e.target.value) || 0 })}
                              placeholder="∞"
                              className="bg-transparent border-transparent hover:border-border focus:bg-background h-8 w-16 text-center px-1"
                            />
                            <span className="text-[10px] text-muted-foreground">s</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-bold">{gauge.maxValue || '-'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 whitespace-nowrap">
                            <Button 
                              variant={gauge.isActive ? "default" : "outline"} 
                              size="sm" 
                              className={cn("h-8 min-w-[95px] text-xs font-bold", gauge.isActive && "bg-green-600 text-white")} 
                              onClick={() => handleToggleListen(gauge)}
                            >
                              {gauge.isActive ? "En écoute" : "Écouter"}
                            </Button>
                            
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs min-w-[80px]" 
                              onClick={() => toggleEnable(gauge.id)}
                            >
                              {gauge.isEnabled ? "Désactiver" : "Activer"}
                            </Button>

                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 px-2" 
                              onClick={() => resetGauge(gauge.id)} 
                              title="Remise à zéro"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>

                            <Button 
                              variant="destructive" 
                              size="sm" 
                              className="h-8 px-2" 
                              onClick={() => deleteGauge(gauge.id)} 
                              title="Supprimer"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
           </div>
        </div>
             <div className="space-y-4 lg:border-l lg:border-border lg:pl-8">
           {/* Section 1: Gestion Page Public */}
           <div className="bg-muted/10 p-4 rounded-xl border border-border/40 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-1">
                  <h2 className="text-sm font-black uppercase tracking-widest text-primary/80">Page Public</h2>
                  <Monitor className="h-4 w-4 text-muted-foreground/50" />
              </div>

              <div className="space-y-3">
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Titre de l'application</label>
                      <Input 
                          className="h-8 text-xs bg-background"
                          placeholder="Ex: Compteur de Performance" 
                          value={settings.pageTitle} 
                          onChange={(e) => useGaugeStore.getState().setSettings({ ...settings, pageTitle: e.target.value })} 
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Taille Jauges <span>{settings.gaugeScale}%</span>
                          </label>
                          <Slider min={50} max={250} step={5} value={[settings.gaugeScale]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, gaugeScale: val[0] })} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Taille Titre <span>{settings.titleSize}%</span>
                          </label>
                          <Slider min={50} max={250} step={5} value={[settings.titleSize]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, titleSize: val[0] })} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Taille dB Max <span>{settings.maxDbSize}%</span>
                          </label>
                          <Slider min={50} max={300} step={5} value={[settings.maxDbSize]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, maxDbSize: val[0] })} />
                      </div>
                      <div className="space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Taille Valeurs <span>{settings.valueSize}%</span>
                          </label>
                          <Slider min={50} max={300} step={5} value={[settings.valueSize]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, valueSize: val[0] })} />
                      </div>
                      <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Taille Noms des jauges <span>{settings.nameSize}%</span>
                          </label>
                          <Slider min={50} max={200} step={5} value={[settings.nameSize]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, nameSize: val[0] })} />
                      </div>
                      <div className="col-span-2 space-y-1">
                          <label className="text-[9px] font-bold uppercase tracking-tighter text-muted-foreground flex justify-between">
                            Espacement Jauges <span>{settings.gaugeGap}%</span>
                          </label>
                          <Slider min={0} max={100} step={0.5} value={[settings.gaugeGap]} onValueChange={(val) => useGaugeStore.getState().setSettings({ ...settings, gaugeGap: val[0] })} />
                      </div>
                  </div>
              </div>
           </div>

           {/* Section 2: Gestion du son */}
           <div className="space-y-3">
               <div className="flex items-center justify-between border-b border-border pb-1">
                   <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Captation Audio</h2>
                   <div className={cn("w-3 h-3 rounded-full border border-border", isClipping ? "bg-red-500 shadow-[0_0_10px_red]" : "bg-muted")} />
               </div>

               <div className="space-y-3">
                   <Button variant={isListening ? "destructive" : "default"} className="w-full font-bold h-9 text-xs" onClick={() => isListening ? stopListening() : startListening()}>
                       {isListening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
                       {isListening ? "Désactiver le micro" : "Activer le micro"}
                   </Button>
                   
                   <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Microphone</label>
                            <Select value={selectedMicId} onValueChange={(val) => startListening(val)}>
                              <SelectTrigger className="h-8 text-[11px] truncate"><SelectValue placeholder="Choix.." /></SelectTrigger>
                              <SelectContent>
                                {microphones.map((mic, idx) => (
                                  <SelectItem key={mic.deviceId || idx} value={mic.deviceId || idx.toString()}>{mic.label || `Micro ${idx + 1}`}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lissage</label>
                            <Slider min={0.1} max={1.5} step={0.1} value={[ballistic]} onValueChange={(val) => setBallistic(val[0])} className="pt-2" />
                        </div>
                   </div>

                   <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">dB Min</label>
                            <Input className="h-8 text-xs" type="number" value={settings.minDb} onChange={(e) => useGaugeStore.getState().setSettings({ ...settings, minDb: parseInt(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">dB Max</label>
                            <Input className="h-8 text-xs" type="number" value={settings.maxDb} onChange={(e) => useGaugeStore.getState().setSettings({ ...settings, maxDb: parseInt(e.target.value) || 0 })} />
                        </div>
                   </div>
                   
                   <div className="bg-muted/30 p-2 rounded-lg border border-border/50">
                       <div className="flex justify-between items-center mb-1">
                           <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Calibration</label>
                           <div className="px-1.5 py-0.5 bg-background border border-border rounded text-[10px] font-mono font-bold tracking-tighter">
                             {calibrationOffset > 0 ? '+' : ''}{calibrationOffset} dB
                           </div>
                       </div>
                        <Slider min={-50} max={150} step={1} value={[calibrationOffset]} onValueChange={(val) => setCalibrationOffset(val[0])} />
                    </div>
                </div>
            </div>

            {/* Section 3: Preview */}
            <div className="flex gap-4 items-stretch pt-2 h-36">
              <div className="flex flex-col flex-1 items-center justify-center p-3 bg-card border border-border rounded-xl shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-1.5 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Activity className="h-8 w-8" />
                  </div>
                  <div className="text-[9px] uppercase text-muted-foreground font-black tracking-widest mb-0.5">Peak</div>
                  <div className={cn(
                      "text-4xl font-black tabular-nums transition-colors duration-300 drop-shadow-sm leading-none",
                      (() => {
                          const range = (settings.maxDb || 110) - (settings.minDb || 40);
                          const p = (displayMax - (settings.minDb || 40)) / range;
                          if (p < 0.3) return "text-green-500";
                          if (p < 0.75) return "text-yellow-500";
                          return "text-red-500";
                      })()
                  )}>{displayMax}</div>
                  <div className={cn(
                      "text-sm font-bold mt-1 tabular-nums transition-colors flex items-center gap-1.5 leading-none",
                      (() => {
                          const range = (settings.maxDb || 110) - (settings.minDb || 40);
                          const p = (currentDb - (settings.minDb || 40)) / range;
                          if (p < 0.3) return "text-green-500/80";
                          if (p < 0.75) return "text-yellow-500/80";
                          return "text-red-500/80";
                      })()
                  )}>
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
                    {currentDb} dB
                  </div>
              </div>

              <div className={cn(
                  "h-36 w-16 bg-black/40 border-2 rounded-xl relative overflow-hidden flex items-end shrink-0 transition-all duration-500",
                  isListening ? "border-white/80 shadow-primary/10" : "border-white/20"
              )}>
                  <div className="w-full transition-all duration-75 relative overflow-hidden" style={{ height: `${getGaugePercentage()}%` }}>
                      <div className="absolute bottom-0 left-0 w-full h-36 bg-gradient-to-t from-green-500 via-yellow-400 to-red-500">
                           {isListening && <div className="absolute top-0 left-0 right-0 h-1.5 bg-white blur-[1px] z-10" />}
                      </div>
                  </div>
                  <div className="absolute inset-0 flex flex-col justify-between py-4 px-1 pointer-events-none opacity-30">
                      {[...Array(7)].map((_, i) => (
                          <div key={i} className="w-full h-[1px] bg-white/50 rounded-full" />
                      ))}
                  </div>
              </div>
            </div>
            
            <div className="flex justify-end">
                <Button variant="outline" size="sm" className="h-6 text-[9px] uppercase font-bold px-3" onClick={resetLocalMaxDb}>Reset</Button>
            </div>
         </div>       </main>
    </div>
  );
}
