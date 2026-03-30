import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGaugeStore } from '../store/useGaugeStore';
import { useAudioProcessor } from '../hooks/useAudioProcessor';
import { cn } from '@/lib/utils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import { Monitor, Plus, Trash2, RotateCcw, Mic, MicOff, Settings, Activity, Moon, Sun, MonitorPlay, Maximize, Minimize, LogOut } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Slider } from '../components/ui/slider';
import { openDisplayWindow, toggleDisplayFullscreen, isTauri } from '../lib/windowUtils';
import { Info } from 'lucide-react';

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
  const [isDark, setIsDark] = useState(true); // Default to dark ideally, or read from document class
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
    // Check initial theme class
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
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (e) {
      window.close(); // Fallback
    }
  };

  const [newGaugeName, setNewGaugeName] = useState('');
  const [newGaugeTime, setNewGaugeTime] = useState('');
  
  const { gauges, addGauge, resetGauge, deleteGauge, toggleEnable, setActiveGauge, settings, setPublicFullscreen } = useGaugeStore();

  const handleAddGauge = (e) => {
    e.preventDefault();
    const finalName = newGaugeName.trim() || `Jauge ${gauges.length + 1}`;
    const finalTime = parseInt(newGaugeTime) || 0;
    
    addGauge(finalName, finalTime);
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
        // Reset both local and store gauge for a clean new "record"
        resetGauge(gauge.id);
        resetLocalMaxDb(); 
        
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
      {/* Header */}
      <header className="flex items-center justify-between pb-6 mb-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Administration - Arsef - Décibel mètre</h1>
          <p className="text-muted-foreground">Gérez vos jauges et la captation audio.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={toggleTheme} title="Basculer le thème">
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
            title="Plein écran (Public)"
            className={cn(settings.publicFullscreen && "bg-primary text-primary-foreground")}
          >
            {settings.publicFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </Button>

          <Button variant="default" onClick={() => openDisplayWindow()} className="font-semibold gap-2">
            <MonitorPlay className="h-5 w-5" />
            Affichage Public
          </Button>

          <Button variant="destructive" size="icon" onClick={handleQuit} title="Quitter l'application">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 outline-none">
        {/* Left Column: Gauges Management */}
        <div className="space-y-6">
           <div className="flex items-center justify-between border-b border-border pb-2">
               <h2 className="text-xl font-semibold">Création de jauge</h2>
               <div className="flex items-center gap-2">
                   <Button variant="outline" onClick={handleResetAll}>Reset All</Button>
               </div>
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
               <label className="text-sm font-medium text-muted-foreground">Temps (s, opt.)</label>
               <Input 
                 type="number" 
                 placeholder="∞" 
                 min="0"
                 value={newGaugeTime} 
                 onChange={(e) => setNewGaugeTime(e.target.value)} 
               />
             </div>
             <Button type="submit" variant="default">Ajouter</Button>
           </form>

           <div className="border border-border rounded-md overflow-hidden bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium text-center">Durée</th>
                    <th className="px-4 py-3 font-medium text-center">db - max</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {gauges.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-muted-foreground">
                        Aucune jauge créée.
                      </td>
                    </tr>
                  ) : (
                    gauges.map((gauge) => (
                      <tr key={gauge.id} className="transition-colors hover:bg-muted/30">
                        <td className={cn("px-4 py-3 font-medium", !gauge.isEnabled && "opacity-50 line-through text-muted-foreground")}>
                          {gauge.name}
                        </td>
                        <td className={cn("px-4 py-3 text-center text-muted-foreground", !gauge.isEnabled && "opacity-50")}>
                          {gauge.recordTime > 0 ? `${gauge.recordTime}s` : '∞'}
                        </td>
                        <td className={cn("px-4 py-3 text-center text-lg font-bold", !gauge.isEnabled && "opacity-50")}>
                          {gauge.maxValue > 0 ? gauge.maxValue : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Button 
                              variant={gauge.isActive ? "default" : "outline"} 
                              size="sm"
                              className={cn("h-8", gauge.isActive && "bg-green-600 hover:bg-green-700 text-white")}
                              onClick={() => handleToggleListen(gauge)}
                            >
                              {gauge.isActive ? "En écoute" : "Écouter"}
                            </Button>
                            
                            <Button 
                              variant={gauge.isEnabled ? "secondary" : "outline"} 
                              size="sm"
                              className="h-8"
                              onClick={() => toggleEnable(gauge.id)}
                            >
                              {gauge.isEnabled ? "Désactiver" : "Activer"}
                            </Button>

                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8"
                              onClick={() => resetGauge(gauge.id)}
                              title="Réinitialiser"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>

                            <Button 
                              variant="destructive" 
                              size="sm"
                              className="h-8"
                              onClick={() => deleteGauge(gauge.id)}
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* Right Column: Audio Management */}
        <div className="space-y-6 lg:border-l lg:border-border lg:pl-8">
           <div className="flex items-center justify-between border-b border-border pb-2">
               <h2 className="text-xl font-semibold">Gestion du son</h2>
               <div className="flex items-center gap-2">
                   <span className="text-sm font-medium text-muted-foreground">Saturation</span>
                   <div className={cn("w-4 h-4 rounded-full border border-border transition-colors duration-100", isClipping ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]" : "bg-muted")} />
               </div>
           </div>

           <div className="space-y-4 max-w-sm">
               {/* Activer le micro */}
               <Button 
                   variant={isListening ? "destructive" : "default"} 
                   className="w-full font-bold h-12"
                   onClick={() => isListening ? stopListening() : startListening()}
               >
                   {isListening ? (
                       <><MicOff className="mr-2 h-5 w-5" /> Désactiver le micro</>
                   ) : (
                       <><Mic className="mr-2 h-5 w-5" /> Activer le micro</>
                   )}
               </Button>
               
               {/* Choix du micro */}
               <div className="space-y-1.5">
                   <label className="text-sm font-medium text-muted-foreground">Choix du micro</label>
                   <Select disabled={!isListening && microphones.length === 0} value={selectedMicId} onValueChange={(val) => startListening(val)}>
                     <SelectTrigger>
                       <SelectValue placeholder="Sélectionnez un micro..." />
                     </SelectTrigger>
                     <SelectContent>
                       {microphones.map((mic, idx) => {
                           const val = mic.deviceId || `default-${idx}`;
                           return (
                             <SelectItem key={val} value={val}>
                                 {mic.label || `Microphone ${idx + 1}`}
                             </SelectItem>
                           );
                       })}
                     </SelectContent>
                   </Select>
               </div>

               {/* Ballistique */}
               <div className="space-y-1.5">
                   <label className="text-sm font-medium text-muted-foreground flex items-center">Ballistique (Lissage) <InfoTooltip text="Définit la vitesse de réaction. 'Rapide' capte les pics brefs (cris). 'Lent' lisse les variations pour une ambiance globale (foule)." /></label>
                   <Select value={ballistic.toString()} onValueChange={(val) => setBallistic(parseFloat(val))}>
                     <SelectTrigger>
                       <SelectValue placeholder="Sélection de la ballistique..." />
                     </SelectTrigger>
                     <SelectContent>
                       <SelectItem value="0.125">Rapide (125 ms) - Idéal pour les hurlements secs</SelectItem>
                       <SelectItem value="1">Lent (1 sec) - Idéal pour mesurer une foule entière</SelectItem>
                     </SelectContent>
                   </Select>
               </div>
               
               {/* Calibration */}
               <div className="space-y-3 pt-2">
                   <div className="flex justify-between items-center">
                       <label className="text-sm font-medium text-muted-foreground flex items-center">Calibration (Sensibilité) <InfoTooltip text="Ajuste le niveau de référence. Sans décibelmètre, basez-vous sur l'écoute : une foule qui crie est environ à 100-105 dB. Si vous voyez 20 alors que ça hurle, boostez ce curseur jusqu'à 100." /></label>
                       <div className="px-2 py-1 bg-muted rounded-md text-xs font-mono border border-border">
                           {calibrationOffset > 0 ? '+' : ''}{calibrationOffset} dB
                       </div>
                   </div>
                   <Slider 
                       min={-50} 
                       max={150} 
                       step={1} 
                       value={[calibrationOffset]} 
                       onValueChange={(val) => setCalibrationOffset(val[0])}
                   />
               </div>
           </div>

           <div className="flex gap-8 items-end pt-4">
             {/* Affichage des valeurs */}
             <div className="flex flex-col flex-1 items-center justify-center p-6 bg-card border border-border rounded-lg shadow-sm">
                 <div className="text-sm uppercase tracking-wider text-muted-foreground font-semibold mb-2">Maximum (dB)</div>
                 <div className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-muted-foreground tabular-nums leading-none">
                     {displayMax}
                 </div>
                 <div className="text-2xl font-semibold text-primary mt-4 tabular-nums">
                     {currentDb} dB
                 </div>
             </div>

             {/* Preview Gauge */}
             <div className="h-64 w-32 bg-card border border-border rounded-lg relative overflow-hidden shadow-inner flex items-end ml-auto shrink-0">
                 <div 
                     className="w-full transition-all duration-75 ease-out origin-bottom bg-gradient-to-t from-green-500 via-yellow-400 to-red-500 rounded-t-sm"
                     style={{ height: `${getGaugePercentage()}%` }}
                 />
                 {/* Lignes de repères */}
                 <div className="absolute inset-0 flex flex-col justify-between py-4 pointer-events-none z-10 mix-blend-overlay">
                     {[...Array(10)].map((_, i) => (
                         <div key={i} className="w-6 h-[2px] bg-white opacity-40 ml-2 rounded-full shadow-sm" />
                     ))}
                 </div>
             </div>
           </div>
           
           <div className="flex justify-end pt-2">
               <Button variant="outline" onClick={resetLocalMaxDb}>
                   Réinitialiser le max local
               </Button>
           </div>
        </div>
      </main>
    </div>
  );
}
