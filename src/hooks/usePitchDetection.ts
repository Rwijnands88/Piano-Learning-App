import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import { noteFromFrequency, pianoKeys } from '../data/piano';
import type { LearningMode, PianoKeyName } from '../types';

type TargetNoteAnalysis = {
  key: PianoKeyName;
  confidence: number;
  volume: number;
  present: boolean;
};

type PitchState = {
  detectedNote: PianoKeyName | null;
  heardKeys: PianoKeyName[];
  targetAnalysis: TargetNoteAnalysis[];
  strongestTargetNote: PianoKeyName | null;
  targetConfidence: number;
  clarity: number;
  frequency: number | null;
  confidence: number;
  volume: number;
  isListening: boolean;
  permissionDenied: boolean;
  error: string;
  start: () => Promise<void>;
  stop: () => void;
  resetError: () => void;
};

type PublishedState = {
  note: PianoKeyName | null;
  heardKeys: PianoKeyName[];
  targetAnalysis: TargetNoteAnalysis[];
  strongestTargetNote: PianoKeyName | null;
  targetConfidence: number;
  clarity: number;
  frequency: number | null;
  confidence: number;
  volume: number;
};

type TargetPresenceState = {
  present: boolean;
  lastPresentAt: number;
};

const frequencyByNote = new Map(pianoKeys.map((key) => [key.note, key.frequency]));
const minimumTargetRms = 0.0062;
const minimumTargetAttackRms = 0.0076;

const emptyPublishedState: PublishedState = {
  note: null,
  heardKeys: [],
  targetAnalysis: [],
  strongestTargetNote: null,
  targetConfidence: 0,
  clarity: 0,
  frequency: null,
  confidence: 0,
  volume: 0,
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const uniqueKeys = (keys: PianoKeyName[]) => Array.from(new Set(keys));

const sameKeys = (left: PianoKeyName[], right: PianoKeyName[]) => (
  left.length === right.length && left.every((key, index) => key === right[index])
);

const targetAnalysisChanged = (left: TargetNoteAnalysis[], right: TargetNoteAnalysis[]) => {
  if (left.length !== right.length) {
    return true;
  }

  return left.some((item, index) => {
    const next = right[index];
    return (
      item.key !== next.key ||
      item.present !== next.present ||
      Math.abs(item.confidence - next.confidence) > 0.04 ||
      Math.abs(item.volume - next.volume) > 0.0025
    );
  });
};

const dbToMagnitude = (value: number) => {
  if (!Number.isFinite(value) || value < -145) {
    return 0;
  }

  return 10 ** (value / 20);
};

const peakAround = (
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  frequency: number,
  ratio: number,
) => {
  const nyquist = sampleRate / 2;

  if (frequency <= 0 || frequency >= nyquist) {
    return 0;
  }

  const binHz = sampleRate / fftSize;
  const center = Math.round(frequency / binHz);
  const radius = Math.max(1, Math.ceil((frequency * ratio) / binHz));
  const start = Math.max(0, center - radius);
  const end = Math.min(frequencyData.length - 1, center + radius);
  let peak = 0;

  for (let index = start; index <= end; index += 1) {
    peak = Math.max(peak, dbToMagnitude(frequencyData[index]));
  }

  return peak;
};

const averageBand = (
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  fromFrequency: number,
  toFrequency: number,
) => {
  const nyquist = sampleRate / 2;
  const from = Math.max(0, Math.min(fromFrequency, nyquist));
  const to = Math.max(0, Math.min(toFrequency, nyquist));

  if (to <= from) {
    return 0;
  }

  const binHz = sampleRate / fftSize;
  const start = Math.max(0, Math.floor(from / binHz));
  const end = Math.min(frequencyData.length - 1, Math.ceil(to / binHz));
  let sum = 0;
  let count = 0;

  for (let index = start; index <= end; index += 1) {
    sum += dbToMagnitude(frequencyData[index]);
    count += 1;
  }

  return count > 0 ? sum / count : 0;
};

const targetConfidenceFromSpectrum = (
  key: PianoKeyName,
  frequencyData: Float32Array,
  sampleRate: number,
  fftSize: number,
  rms: number,
  monoNote: PianoKeyName | null,
  ambientRms: number,
) => {
  const baseFrequency = frequencyByNote.get(key);

  const aboveAmbient = rms - ambientRms;

  if (!baseFrequency || rms < minimumTargetRms || aboveAmbient < 0.0022) {
    return 0;
  }

  const fundamental = peakAround(frequencyData, sampleRate, fftSize, baseFrequency, 0.026);
  const secondHarmonic = peakAround(frequencyData, sampleRate, fftSize, baseFrequency * 2, 0.018);
  const thirdHarmonic = peakAround(frequencyData, sampleRate, fftSize, baseFrequency * 3, 0.014);
  const fourthHarmonic = peakAround(frequencyData, sampleRate, fftSize, baseFrequency * 4, 0.012);
  const harmonicEnergy = fundamental + secondHarmonic * 0.54 + thirdHarmonic * 0.34 + fourthHarmonic * 0.18;
  const lowerFloor = averageBand(frequencyData, sampleRate, fftSize, baseFrequency * 0.68, baseFrequency * 0.88);
  const upperFloor = averageBand(frequencyData, sampleRate, fftSize, baseFrequency * 1.12, baseFrequency * 1.36);
  const wideFloor = averageBand(frequencyData, sampleRate, fftSize, Math.max(45, baseFrequency * 0.42), baseFrequency * 1.85);
  const localFloor = lowerFloor * 0.36 + upperFloor * 0.36 + wideFloor * 0.28;
  const contrast = harmonicEnergy / (localFloor + 0.000004);
  const contrastScore = clamp01((contrast - 1.62) / 5.8);
  const absoluteScore = clamp01((harmonicEnergy - 0.0045) / 0.07);
  const volumeGate = clamp01((rms - minimumTargetRms) / 0.025);
  const attackGate = clamp01((aboveAmbient - 0.0022) / 0.016);
  const pitchBoost = monoNote === key && rms >= minimumTargetAttackRms ? 0.12 : 0;

  return clamp01((contrastScore * 0.72 + absoluteScore * 0.28) * volumeGate * attackGate + pitchBoost);
};

export const usePitchDetection = (mode: LearningMode, enabled: boolean, targetKeys: PianoKeyName[] = []): PitchState => {
  const [detectedNote, setDetectedNote] = useState<PianoKeyName | null>(null);
  const [heardKeys, setHeardKeys] = useState<PianoKeyName[]>([]);
  const [targetAnalysis, setTargetAnalysis] = useState<TargetNoteAnalysis[]>([]);
  const [strongestTargetNote, setStrongestTargetNote] = useState<PianoKeyName | null>(null);
  const [targetConfidence, setTargetConfidence] = useState(0);
  const [clarity, setClarity] = useState(0);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [volume, setVolume] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [error, setError] = useState('');

  const resetError = useCallback(() => {
    setPermissionDenied(false);
    setError('');
  }, []);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);
  const sessionRef = useRef(0);
  const targetKeysRef = useRef<PianoKeyName[]>([]);
  const targetSmoothingRef = useRef<Record<string, number>>({});
  const targetPresenceRef = useRef<Record<string, TargetPresenceState>>({});
  const ambientRmsRef = useRef(0.004);
  const candidateRef = useRef<{ note: PianoKeyName | null; since: number; frames: number }>({ note: null, since: 0, frames: 0 });
  const lastPublishedRef = useRef<PublishedState>(emptyPublishedState);

  const targetSignature = targetKeys.join('|');
  useEffect(() => {
    targetKeysRef.current = uniqueKeys(targetKeys);
    targetSmoothingRef.current = {};
    targetPresenceRef.current = {};
    ambientRmsRef.current = 0.004;
  }, [targetSignature]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    isStartingRef.current = false;
    isListeningRef.current = false;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    sourceRef.current?.disconnect();
    analyserRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close();

    audioContextRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    setIsListening(false);
    setDetectedNote(null);
    setHeardKeys([]);
    setTargetAnalysis([]);
    setStrongestTargetNote(null);
    setTargetConfidence(0);
    setClarity(0);
    setFrequency(null);
    setConfidence(0);
    setVolume(0);
    candidateRef.current = { note: null, since: 0, frames: 0 };
    targetSmoothingRef.current = {};
    targetPresenceRef.current = {};
    ambientRmsRef.current = 0.004;
    lastPublishedRef.current = emptyPublishedState;
  }, []);

  const start = useCallback(async () => {
    if (isListeningRef.current || isStartingRef.current || mode !== 'listen' || !enabled) {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Deze browser ondersteunt geen microfoon-toegang.');
      return;
    }

    const session = sessionRef.current + 1;
    sessionRef.current = session;
    isStartingRef.current = true;

    try {
      resetError();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 8192;
      analyser.smoothingTimeConstant = 0.12;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      if (session !== sessionRef.current || mode !== 'listen' || !enabled) {
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        void audioContext.close();
        return;
      }

      const input = new Float32Array(analyser.fftSize);
      const frequencyInput = new Float32Array(analyser.frequencyBinCount);
      const detector = PitchDetector.forFloat32Array(input.length);
      const publish = (
        note: PianoKeyName | null,
        nextFrequency: number | null,
        nextClarity: number,
        nextConfidence: number,
        nextVolume: number,
        nextHeardKeys: PianoKeyName[],
        nextTargetAnalysis: TargetNoteAnalysis[],
        nextStrongestTargetNote: PianoKeyName | null,
        nextTargetConfidence: number,
      ) => {
        const previous = lastPublishedRef.current;
        const frequencyChanged =
          nextFrequency === null || previous.frequency === null
            ? nextFrequency !== previous.frequency
            : Math.abs(nextFrequency - previous.frequency) > 0.7;
        const clarityChanged = Math.abs(nextClarity - previous.clarity) > 0.035;
        const confidenceChanged = Math.abs(nextConfidence - previous.confidence) > 0.035;
        const volumeChanged = Math.abs(nextVolume - previous.volume) > 0.0025;
        const heardKeysChanged = !sameKeys(previous.heardKeys, nextHeardKeys);
        const targetChanged =
          previous.strongestTargetNote !== nextStrongestTargetNote ||
          Math.abs(previous.targetConfidence - nextTargetConfidence) > 0.04 ||
          targetAnalysisChanged(previous.targetAnalysis, nextTargetAnalysis);

        if (
          previous.note !== note ||
          frequencyChanged ||
          clarityChanged ||
          confidenceChanged ||
          volumeChanged ||
          heardKeysChanged ||
          targetChanged
        ) {
          lastPublishedRef.current = {
            note,
            heardKeys: nextHeardKeys,
            targetAnalysis: nextTargetAnalysis,
            strongestTargetNote: nextStrongestTargetNote,
            targetConfidence: nextTargetConfidence,
            clarity: nextClarity,
            frequency: nextFrequency,
            confidence: nextConfidence,
            volume: nextVolume,
          };
          setDetectedNote(note);
          setHeardKeys(nextHeardKeys);
          setTargetAnalysis(nextTargetAnalysis);
          setStrongestTargetNote(nextStrongestTargetNote);
          setTargetConfidence(nextTargetConfidence);
          setFrequency(nextFrequency);
          setClarity(nextClarity);
          setConfidence(nextConfidence);
          setVolume(nextVolume);
        }
      };

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      sourceRef.current = source;
      streamRef.current = stream;
      setPermissionDenied(false);
      setError('');
      isStartingRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);

      const tick = () => {
        if (session !== sessionRef.current) {
          return;
        }

        analyser.getFloatTimeDomainData(input);
        analyser.getFloatFrequencyData(frequencyInput);
        const [nextFrequency, nextClarity] = detector.findPitch(input, audioContext.sampleRate);

        let sumSquares = 0;
        for (let index = 0; index < input.length; index += 1) {
          sumSquares += input[index] * input[index];
        }

        const rms = Math.sqrt(sumSquares / input.length);
        const previousAmbientRms = ambientRmsRef.current;
        const likelyAttack = rms >= minimumTargetAttackRms && rms > previousAmbientRms * 1.75;

        if (!likelyAttack && rms < previousAmbientRms * 1.28) {
          ambientRmsRef.current = previousAmbientRms * 0.965 + rms * 0.035;
        } else {
          ambientRmsRef.current = previousAmbientRms * 0.995 + Math.min(rms, previousAmbientRms * 1.15) * 0.005;
        }

        const ambientRms = ambientRmsRef.current;
        const nextNote = nextClarity > 0.76 && rms > minimumTargetAttackRms && rms > ambientRms * 1.55 && nextFrequency > 45
          ? noteFromFrequency(nextFrequency)
          : null;
        const targets = targetKeysRef.current;
        const now = performance.now();
        const rawTargetAnalysis = targets.map((key) => ({
          key,
          confidence: targetConfidenceFromSpectrum(key, frequencyInput, audioContext.sampleRate, analyser.fftSize, rms, nextNote, ambientRms),
          volume: rms,
          present: false,
        }));
        const targetThreshold = targets.length > 1 ? 0.5 : 0.52;
        const nextSmoothing: Record<string, number> = {};
        const nextPresence: Record<string, TargetPresenceState> = {};
        const nextTargetAnalysis = rawTargetAnalysis.map((item) => {
          const previousConfidence = targetSmoothingRef.current[item.key] ?? 0;
          const previousPresence = targetPresenceRef.current[item.key];
          const smoothedConfidence = clamp01(previousConfidence * 0.64 + item.confidence * 0.36);
          const hasAttack = rms >= minimumTargetAttackRms && rms > ambientRms * 1.45;
          const attackPresent = hasAttack && (smoothedConfidence >= targetThreshold || item.confidence >= targetThreshold + 0.18);
          const heldPresent =
            Boolean(previousPresence?.present) &&
            smoothedConfidence >= targetThreshold - 0.18 &&
            now - previousPresence.lastPresentAt < 360;
          const present = attackPresent || heldPresent;
          nextSmoothing[item.key] = smoothedConfidence;
          nextPresence[item.key] = {
            present,
            lastPresentAt: present ? now : previousPresence?.lastPresentAt ?? 0,
          };

          return {
            ...item,
            confidence: smoothedConfidence,
            present,
          };
        });
        targetSmoothingRef.current = nextSmoothing;
        targetPresenceRef.current = nextPresence;

        const nextHeardKeys = nextTargetAnalysis.filter((item) => item.present).map((item) => item.key);
        const strongestTarget = nextTargetAnalysis.reduce<TargetNoteAnalysis | null>(
          (strongest, item) => (!strongest || item.confidence > strongest.confidence ? item : strongest),
          null,
        );

        if (nextNote) {
          const candidate = candidateRef.current;

          if (candidate.note === nextNote) {
            candidate.frames += 1;
          } else {
            candidateRef.current = { note: nextNote, since: now, frames: 1 };
          }

          const stableForMs = now - candidateRef.current.since;
          const stableEnough = candidateRef.current.frames >= 4 || stableForMs >= 85;
          const nextConfidence = Math.min(1, nextClarity * Math.min(1, rms / 0.035));

          if (stableEnough) {
            publish(
              nextNote,
              nextFrequency,
              nextClarity,
              nextConfidence,
              rms,
              nextHeardKeys,
              nextTargetAnalysis,
              strongestTarget?.key ?? null,
              strongestTarget?.confidence ?? 0,
            );
          } else {
            publish(
              lastPublishedRef.current.note,
              nextFrequency,
              nextClarity,
              nextConfidence * 0.75,
              rms,
              nextHeardKeys,
              nextTargetAnalysis,
              strongestTarget?.key ?? null,
              strongestTarget?.confidence ?? 0,
            );
          }
        } else {
          candidateRef.current = { note: null, since: now, frames: 0 };
          publish(
            null,
            null,
            nextClarity,
            0,
            rms,
            nextHeardKeys,
            nextTargetAnalysis,
            strongestTarget?.key ?? null,
            strongestTarget?.confidence ?? 0,
          );
        }

        frameRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (caught) {
      if (session !== sessionRef.current) {
        return;
      }

      const name = typeof caught === 'object' && caught && 'name' in caught ? String(caught.name) : '';
      const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
      setPermissionDenied(denied);
      setError(
        denied
          ? 'Microfoontoestemming is geweigerd. Handmatige modus is actief.'
          : 'De microfoon kon niet gestart worden. Handmatige modus is actief.',
      );
      stop();
    } finally {
      if (session === sessionRef.current) {
        isStartingRef.current = false;
      }
    }
  }, [enabled, mode, resetError, stop]);

  useEffect(() => {
    if (mode === 'listen' && enabled) {
      void start();
    } else {
      stop();
    }

    return () => stop();
  }, [enabled, mode, start, stop]);

  return {
    detectedNote,
    heardKeys,
    targetAnalysis,
    strongestTargetNote,
    targetConfidence,
    clarity,
    frequency,
    confidence,
    volume,
    isListening,
    permissionDenied,
    error,
    start,
    stop,
    resetError,
  };
};
