import { useCallback, useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';
import { noteFromFrequency } from '../data/piano';
import type { LearningMode, PianoKeyName } from '../types';

type PitchState = {
  detectedNote: PianoKeyName | null;
  clarity: number;
  frequency: number | null;
  isListening: boolean;
  permissionDenied: boolean;
  error: string;
  start: () => Promise<void>;
  stop: () => void;
  resetError: () => void;
};

export const usePitchDetection = (mode: LearningMode, enabled: boolean): PitchState => {
  const [detectedNote, setDetectedNote] = useState<PianoKeyName | null>(null);
  const [clarity, setClarity] = useState(0);
  const [frequency, setFrequency] = useState<number | null>(null);
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
    setClarity(0);
    setFrequency(null);
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
      analyser.fftSize = 2048;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      if (session !== sessionRef.current || mode !== 'listen' || !enabled) {
        source.disconnect();
        stream.getTracks().forEach((track) => track.stop());
        void audioContext.close();
        return;
      }

      const input = new Float32Array(analyser.fftSize);
      const detector = PitchDetector.forFloat32Array(input.length);

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
        const [nextFrequency, nextClarity] = detector.findPitch(input, audioContext.sampleRate);

        if (nextClarity > 0.78 && nextFrequency > 60) {
          setFrequency(nextFrequency);
          setClarity(nextClarity);
          setDetectedNote(noteFromFrequency(nextFrequency));
        } else {
          setClarity(nextClarity);
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

  return { detectedNote, clarity, frequency, isListening, permissionDenied, error, start, stop, resetError };
};
