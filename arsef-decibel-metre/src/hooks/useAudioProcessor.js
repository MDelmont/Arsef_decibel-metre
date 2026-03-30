import { useState, useEffect, useRef, useCallback } from 'react';
import { useGaugeStore } from '../store/useGaugeStore';
import { emitGaugeUpdate } from '../lib/windowUtils';

const MIN_GAUGE_DB = 40;
const MAX_GAUGE_DB = 110;

export function useAudioProcessor() {
  const [isListening, setIsListening] = useState(false);
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [ballistic, setBallisticState] = useState(1.0); // 1.0 (Lent) par défaut
  const [calibrationOffset, setCalibrationOffsetState] = useState(100);
  const [isClipping, setIsClipping] = useState(false);
  
  // Local state for UI
  const [currentDb, setCurrentDb] = useState(0);
  const [localMaxDb, setLocalMaxDb] = useState(0);

  // Refs for audio processing params that need to be read in rAF loop
  const ballisticRef = useRef(ballistic);
  const calibrationOffsetRef = useRef(calibrationOffset);
  const isListeningRef = useRef(isListening);

  const setBallistic = (val) => {
    setBallisticState(val);
    ballisticRef.current = val;
  };

  const setCalibrationOffset = (val) => {
    setCalibrationOffsetState(val);
    calibrationOffsetRef.current = val;
  };

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // Refs for audio context and nodes
  const audioContextRef = useRef(null);
  const streamRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const lastTimeRef = useRef(0);
  const currentSmoothedRmsRef = useRef(0);
  const clippingTimeoutRef = useRef(null);

  const populateDeviceList = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioDevices = devices.filter(device => device.kind === 'audioinput');
      setMicrophones(audioDevices);
    } catch (err) {
      console.error('Error enumerating devices', err);
    }
  };

  useEffect(() => {
    populateDeviceList();
  }, []);

  const setupAudioNodes = (stream) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const biquadFilter = audioContextRef.current.createBiquadFilter();
    biquadFilter.type = 'highpass';
    biquadFilter.frequency.value = 100;
    biquadFilter.Q.value = 0.5;

    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 4096;
    analyserRef.current = analyser;

    const microphone = audioContextRef.current.createMediaStreamSource(stream);
    microphone.connect(biquadFilter);
    biquadFilter.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    dataArrayRef.current = new Float32Array(bufferLength);
  };

  const handleClipping = (clipping) => {
    if (clipping) {
      setIsClipping(true);
      if (clippingTimeoutRef.current) clearTimeout(clippingTimeoutRef.current);
      clippingTimeoutRef.current = setTimeout(() => {
        setIsClipping(false);
      }, 1000);
    }
  };

  const processAudio = useCallback((now) => {
    if (!isListeningRef.current) return;

    let dt = (now - lastTimeRef.current) / 1000;
    if (dt > 0.1) dt = 0.1;
    lastTimeRef.current = now;

    const timeConstant = ballisticRef.current;
    let alpha = Math.exp(-dt / timeConstant);

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    
    if (analyser && dataArray) {
      analyser.getFloatTimeDomainData(dataArray);

      let sumSquares = 0.0;
      let clipping = false;
      
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i];
        if (val >= 1.0 || val <= -1.0) clipping = true;
        sumSquares += val * val;
      }
      
      handleClipping(clipping);

      const rms = Math.sqrt(sumSquares / dataArray.length);
      currentSmoothedRmsRef.current = currentSmoothedRmsRef.current * alpha + rms * (1 - alpha);

      let dbFs = 20 * Math.log10(Math.max(currentSmoothedRmsRef.current, 0.000001));
      let dbSpl = Math.round(dbFs + calibrationOffsetRef.current);
      
      if (dbSpl < 0) dbSpl = 0;
      
      setCurrentDb(dbSpl);
      
      setLocalMaxDb(prev => {
        if (dbSpl > prev) return dbSpl;
        return prev;
      });

      // Update active gauge in store
      const gauges = useGaugeStore.getState().gauges;
      const activeGauge = gauges.find(g => g.isActive && g.isEnabled);
      if (activeGauge) {
        useGaugeStore.getState().updateGaugeValue(activeGauge.id, dbSpl);
        emitGaugeUpdate(activeGauge.id, dbSpl);
      }
    }

    animationFrameRef.current = requestAnimationFrame(processAudio);
  }, []);

  const startListening = async (deviceId) => {
    try {
      if (!isListening) {
        await populateDeviceList();
      }
      
      const targetDeviceId = deviceId || selectedMicId;

      const baseConstraints = {
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false
      };

      if (streamRef.current && targetDeviceId) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        audio: {
          ...baseConstraints,
          ...(targetDeviceId ? { deviceId: { exact: targetDeviceId } } : {})
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      setupAudioNodes(stream);
      
      setIsListening(true);
      isListeningRef.current = true;
      lastTimeRef.current = performance.now();
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(processAudio);

      if (targetDeviceId && targetDeviceId !== selectedMicId) {
         setSelectedMicId(targetDeviceId);
      }

    } catch (err) {
      console.error('Erreur :', err);
      alert('Impossible d\'accéder au microphone en mode RAW. Vérifiez les permissions.');
    }
  };

  const stopListening = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsListening(false);
    isListeningRef.current = false;
    setCurrentDb(0);
  };
  
  // Calculate percentage for visual gauge
  const getGaugePercentage = () => {
    let percentage = ((currentDb - MIN_GAUGE_DB) / (MAX_GAUGE_DB - MIN_GAUGE_DB)) * 100;
    return Math.min(100, Math.max(0, percentage));
  };

  return {
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
    resetLocalMaxDb: () => setLocalMaxDb(0),
    getGaugePercentage
  };
}

