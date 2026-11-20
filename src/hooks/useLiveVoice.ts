import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from '../config';
import { ChatOrderPreview, ChatProductOffer, Language, Order } from '../types';
import { safeStorage } from '../utils/storage';

export type LiveVoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface LiveVoiceLocation {
  latitude: number;
  longitude: number;
  area: string;
  street: string;
  city: string;
  addressId?: string;
}

interface UseLiveVoiceOptions {
  language: Language;
  location: LiveVoiceLocation;
  onOffers: (offers: ChatProductOffer[]) => void;
  onOrderPreview: (preview: ChatOrderPreview) => void;
  onPlacedOrder: (order: Order) => void;
  onCartUpdated: () => void;
  onTurnTranscripts: (userText: string, assistantText: string) => void;
}

function downsampleFloat32To16k(input: Float32Array, sourceRate: number): Float32Array {
  if (!sourceRate || sourceRate === 16000) {
    return input;
  }
  const ratio = sourceRate / 16000;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    output[i] = count > 0 ? sum / count : input[Math.min(input.length - 1, start)];
  }
  return output;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function pcm24kBase64ToFloat32(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const byteLength = binary.length;
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(byteLength / 2);
  const float32 = new Float32Array(new ArrayBuffer(sampleCount * 4));
  for (let i = 0; i < sampleCount; i++) {
    float32[i] = view.getInt16(i * 2, true) / 0x8000;
  }
  return float32;
}

export function useLiveVoice({
  language,
  location,
  onOffers,
  onOrderPreview,
  onPlacedOrder,
  onCartUpdated,
  onTurnTranscripts,
}: UseLiveVoiceOptions) {
  const [voiceStatus, setVoiceStatus] = useState<LiveVoiceStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveModelTranscript, setLiveModelTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const isMutedRef = useRef<boolean>(false);
  const userTranscriptRef = useRef<string>('');
  const modelTranscriptRef = useRef<string>('');
  const callbacksRef = useRef({
    onOffers,
    onOrderPreview,
    onPlacedOrder,
    onCartUpdated,
    onTurnTranscripts,
  });

  useEffect(() => {
    callbacksRef.current = {
      onOffers,
      onOrderPreview,
      onPlacedOrder,
      onCartUpdated,
      onTurnTranscripts,
    };
  }, [onOffers, onOrderPreview, onPlacedOrder, onCartUpdated, onTurnTranscripts]);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  const clearAudioPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore stopped source errors
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  }, []);

  const stopVoice = useCallback(
    (preserveError = false) => {
      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
          processorRef.current.onaudioprocess = null;
        } catch {
          // ignore
        }
        processorRef.current = null;
      }
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceNodeRef.current = null;
      }
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (inputAudioCtxRef.current) {
        inputAudioCtxRef.current.close().catch(() => {});
        inputAudioCtxRef.current = null;
      }
      clearAudioPlaybackQueue();
      if (outputAudioCtxRef.current) {
        outputAudioCtxRef.current.close().catch(() => {});
        outputAudioCtxRef.current = null;
      }
      if (wsRef.current) {
        try {
          const ws = wsRef.current;
          ws.onopen = null;
          ws.onmessage = null;
          ws.onerror = null;
          ws.onclose = null;
          if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
          }
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
      userTranscriptRef.current = '';
      modelTranscriptRef.current = '';
      setLiveUserTranscript('');
      setLiveModelTranscript('');
      setIsMuted(false);
      if (!preserveError) {
        setVoiceError(null);
        setVoiceStatus('idle');
      }
    },
    [clearAudioPlaybackQueue]
  );

  useEffect(() => {
    return () => {
      stopVoice(false);
    };
  }, [stopVoice]);

  const scheduleOutputAudio = useCallback((base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    const samples = pcm24kBase64ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.copyToChannel(samples, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.02, nextStartTimeRef.current);
    nextStartTimeRef.current = startAt + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    setIsSpeaking(true);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
      if (activeSourcesRef.current.size === 0) {
        setIsSpeaking(false);
      }
    };
    source.start(startAt);
  }, []);

  const startVoice = useCallback(async () => {
    if (voiceStatus === 'connecting' || voiceStatus === 'connected') {
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone access is not supported in this browser.');
      setVoiceStatus('error');
      return;
    }

    setVoiceError(null);
    setVoiceStatus('connecting');
    userTranscriptRef.current = '';
    modelTranscriptRef.current = '';
    setLiveUserTranscript('');
    setLiveModelTranscript('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/api/v1/live`);
      wsRef.current = ws;

      let connectTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.close();
          } catch {
            // ignore
          }
          setVoiceError(
            language === 'ne'
              ? 'लाइभ भ्वाइस सर्भर उपलब्ध छैन। कृपया टेक्स्ट च्याट प्रयोग गर्नुहोस्।'
              : 'Live voice service is temporarily offline. Please use text chat to order directly.'
          );
          setVoiceStatus('error');
          stopVoice(true);
        }
      }, 4000);

      ws.onopen = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        const token = safeStorage.get(APP_CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        const sessionKey = safeStorage.get(APP_CONFIG.STORAGE_KEYS.SESSION_KEY);
        ws.send(
          JSON.stringify({
            type: 'start',
            token: token && !token.startsWith('drf-token-') ? token : undefined,
            sessionKey: sessionKey || undefined,
            userLocation: location,
            language,
          })
        );
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(String(event.data)) as {
            type: string;
            audio?: string;
            text?: string;
            message?: string;
            offers?: ChatProductOffer[];
            orderPreview?: ChatOrderPreview;
            order?: Order;
          };

          if (msg.type === 'ready') {
            setVoiceStatus('connected');

            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            sourceNodeRef.current = source;
            processorRef.current = processor;

            processor.onaudioprocess = (audioEvent: AudioProcessingEvent) => {
              if (isMutedRef.current || ws.readyState !== WebSocket.OPEN) return;
              const rawChannelData = audioEvent.inputBuffer.getChannelData(0);
              const pcm16k = downsampleFloat32To16k(rawChannelData, inputCtx.sampleRate);
              const base64 = float32ToPcm16Base64(pcm16k);
              ws.send(JSON.stringify({ type: 'audio', audio: base64 }));
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
            return;
          }

          if (msg.type === 'audio' && msg.audio) {
            scheduleOutputAudio(msg.audio);
            return;
          }

          if (msg.type === 'interrupted') {
            clearAudioPlaybackQueue();
            return;
          }

          if (msg.type === 'inputTranscript' && msg.text) {
            userTranscriptRef.current = `${userTranscriptRef.current} ${msg.text}`.trim();
            setLiveUserTranscript(userTranscriptRef.current);
            return;
          }

          if (msg.type === 'outputTranscript' && msg.text) {
            modelTranscriptRef.current = `${modelTranscriptRef.current} ${msg.text}`.trim();
            setLiveModelTranscript(modelTranscriptRef.current);
            return;
          }

          if (msg.type === 'turnComplete') {
            const spokenUser = userTranscriptRef.current.trim();
            const spokenModel = modelTranscriptRef.current.trim();
            if (spokenUser || spokenModel) {
              callbacksRef.current.onTurnTranscripts(spokenUser, spokenModel);
            }
            userTranscriptRef.current = '';
            modelTranscriptRef.current = '';
            setLiveUserTranscript('');
            setLiveModelTranscript('');
            return;
          }

          if (msg.type === 'offers' && Array.isArray(msg.offers)) {
            callbacksRef.current.onOffers(msg.offers);
            return;
          }

          if (msg.type === 'orderPreview' && msg.orderPreview) {
            callbacksRef.current.onOrderPreview(msg.orderPreview);
            return;
          }

          if (msg.type === 'placedOrder' && msg.order) {
            callbacksRef.current.onPlacedOrder(msg.order);
            return;
          }

          if (msg.type === 'cartUpdated') {
            callbacksRef.current.onCartUpdated();
            return;
          }

          if (msg.type === 'error') {
            setVoiceError(msg.message || 'Voice conversation failed.');
            setVoiceStatus('error');
            stopVoice(true);
            return;
          }

          if (msg.type === 'closed') {
            stopVoice(false);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        setVoiceError(
          language === 'ne'
            ? 'लाइभ भ्वाइस सर्भर उपलब्ध छैन। कृपया टेक्स्ट च्याट प्रयोग गर्नुहोस्।'
            : 'Live voice service is temporarily offline. Please use text chat to order.'
        );
        setVoiceStatus('error');
        stopVoice(true);
      };

      ws.onclose = () => {
        if (connectTimer) {
          clearTimeout(connectTimer);
          connectTimer = null;
        }
        setVoiceStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Microphone access denied or Live Voice session failed.';
      setVoiceError(msg);
      setVoiceStatus('error');
      stopVoice(true);
    }
  }, [clearAudioPlaybackQueue, language, location, scheduleOutputAudio, stopVoice, voiceStatus]);

  const toggleVoice = useCallback(() => {
    if (voiceStatus === 'connected' || voiceStatus === 'connecting') {
      stopVoice(false);
    } else {
      startVoice();
    }
  }, [startVoice, stopVoice, voiceStatus]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const sendVoiceText = useCallback((text: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && text.trim()) {
      wsRef.current.send(JSON.stringify({ type: 'text', text: text.trim() }));
    }
  }, []);

  return {
    voiceStatus,
    isMuted,
    isSpeaking,
    voiceError,
    liveUserTranscript,
    liveModelTranscript,
    toggleVoice,
    stopVoice,
    toggleMute,
    sendVoiceText,
  };
}
