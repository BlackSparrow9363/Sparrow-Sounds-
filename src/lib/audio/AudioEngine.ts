import {
  ActiveSoundLayer,
  FilterConfig,
  TransientAudioTelemetry,
} from '../../types/audio';
import { getCustomSoundBlobFromDB } from '../../db/indexedDb';

interface LayerAudioNodes {
  sourceNode: AudioBufferSourceNode;
  filterNode: BiquadFilterNode;
  gainNode: GainNode;
  pannerNode: StereoPannerNode;
}

const WORKLET_PROCESSOR_CODE = `
class SparrowMasterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._frameCounter = 0;
    this._rmsSumL = 0.0;
    this._rmsSumR = 0.0;
    this._peak = 0.0;
    this._sampleCount = 0;
    this._telemetryMsg = {
      rmsLeft: 0,
      rmsRight: 0,
      peak: 0,
      audioClockTime: 0,
      workletActive: true
    };
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : output[0];
    const blockSize = outL.length;

    for (let i = 0; i < blockSize; i++) {
      outL[i] = 0.0;
      if (outR !== outL) outR[i] = 0.0;
    }

    const numInputs = inputs.length;
    for (let inpIdx = 0; inpIdx < numInputs; inpIdx++) {
      const input = inputs[inpIdx];
      if (!input || input.length === 0) continue;
      const inL = input[0];
      const inR = input.length > 1 ? input[1] : inL;

      for (let i = 0; i < blockSize; i++) {
        outL[i] += inL[i];
        if (outR !== outL) {
          outR[i] += inR[i];
        }
      }
    }

    for (let i = 0; i < blockSize; i++) {
      const rawL = outL[i];
      const rawR = outR[i];
      const sL = rawL / (1.0 + Math.abs(rawL) * 0.25);
      const sR = rawR / (1.0 + Math.abs(rawR) * 0.25);

      outL[i] = sL;
      if (outR !== outL) outR[i] = sR;

      this._rmsSumL += sL * sL;
      this._rmsSumR += sR * sR;
      const absMax = Math.abs(sL) > Math.abs(sR) ? Math.abs(sL) : Math.abs(sR);
      if (absMax > this._peak) {
        this._peak = absMax;
      }
    }

    this._sampleCount += blockSize;
    this._frameCounter += 1;

    if (this._frameCounter >= 10 && this._sampleCount > 0) {
      this._telemetryMsg.rmsLeft = Math.sqrt(this._rmsSumL / this._sampleCount);
      this._telemetryMsg.rmsRight = Math.sqrt(this._rmsSumR / this._sampleCount);
      this._telemetryMsg.peak = this._peak;
      this._telemetryMsg.audioClockTime = currentTime;
      this.port.postMessage(this._telemetryMsg);

      this._frameCounter = 0;
      this._rmsSumL = 0.0;
      this._rmsSumR = 0.0;
      this._peak = 0.0;
      this._sampleCount = 0;
    }

    return true;
  }
}

registerProcessor('sparrow-master-processor', SparrowMasterProcessor);
`;

class AudioEngine {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private bufferCache = new Map<string, AudioBuffer>();
  private loadingPromises = new Map<string, Promise<AudioBuffer>>();
  private activeLayerNodes = new Map<string, LayerAudioNodes>();
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  // Sleep Timer Hybrid Scheduler state
  private sleepTimerTimeoutId: number | null = null;
  private sleepTimerEndAudioTime: number | null = null;
  private sleepTimerDurationSec = 0;

  private onTelemetryCallback: ((telemetry: TransientAudioTelemetry) => void) | null = null;
  private onLoadingStateCallback: ((soundId: string, isLoading: boolean) => void) | null = null;
  private onSleepTimerTickCallback: ((remainingSeconds: number) => void) | null = null;
  private onSleepTimerCompleteCallback: (() => void) | null = null;

  public setTelemetryListener(cb: (telemetry: TransientAudioTelemetry) => void) {
    this.onTelemetryCallback = cb;
  }

  public setLoadingStateListener(cb: (soundId: string, isLoading: boolean) => void) {
    this.onLoadingStateCallback = cb;
  }

  public setSleepTimerListeners(
    onTick: (remainingSeconds: number) => void,
    onComplete: () => void
  ) {
    this.onSleepTimerTickCallback = onTick;
    this.onSleepTimerCompleteCallback = onComplete;
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ latencyHint: 'interactive' });
      this.audioContext = ctx;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, ctx.currentTime);
      this.masterGainNode = masterGain;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.82;
      this.analyserNode = analyser;

      try {
        const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
        const workletUrl = URL.createObjectURL(blob);
        await ctx.audioWorklet.addModule(workletUrl);
        URL.revokeObjectURL(workletUrl);

        const worklet = new AudioWorkletNode(ctx, 'sparrow-master-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [2],
        });

        worklet.port.onmessage = (event: MessageEvent<TransientAudioTelemetry>) => {
          if (this.onTelemetryCallback) {
            this.onTelemetryCallback(event.data);
          }
        };

        this.workletNode = worklet;
      } catch (err) {
        console.warn('AudioWorklet fallback engaged:', err);
        const fallbackBus = ctx.createGain();
        this.workletNode = fallbackBus;
      }

      this.workletNode.connect(masterGain);
      masterGain.connect(analyser);
      analyser.connect(ctx.destination);

      this.isInitialized = true;
    })();

    return this.initPromise;
  }

  public async ensureContextResumed(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  public async suspendContext(): Promise<void> {
    if (this.audioContext && this.audioContext.state === 'running') {
      await this.audioContext.suspend();
    }
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  public async loadSoundFromUrl(id: string, url: string): Promise<AudioBuffer> {
    await this.init();
    const cached = this.bufferCache.get(id);
    if (cached) return cached;

    const existingPromise = this.loadingPromises.get(id);
    if (existingPromise) return existingPromise;

    this.onLoadingStateCallback?.(id, true);
    const promise = (async () => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} loading ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
        this.bufferCache.set(id, audioBuffer);
        return audioBuffer;
      } finally {
        this.loadingPromises.delete(id);
        this.onLoadingStateCallback?.(id, false);
      }
    })();

    this.loadingPromises.set(id, promise);
    return promise;
  }

  public async decodeSoundFromBlob(id: string, blob: Blob): Promise<AudioBuffer> {
    await this.init();
    const cached = this.bufferCache.get(id);
    if (cached) return cached;

    this.onLoadingStateCallback?.(id, true);
    try {
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (reader.result instanceof ArrayBuffer) {
            resolve(reader.result);
          } else {
            reject(new Error('FileReader did not return an ArrayBuffer'));
          }
        };
        reader.onerror = () => reject(reader.error || new Error('FileReader error'));
        reader.readAsArrayBuffer(blob);
      });

      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      this.bufferCache.set(id, audioBuffer);
      return audioBuffer;
    } finally {
      this.onLoadingStateCallback?.(id, false);
    }
  }

  public async resolveAudioBuffer(layer: ActiveSoundLayer): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(layer.id);
    if (cached) return cached;

    if (layer.isCustom) {
      const record = await getCustomSoundBlobFromDB(layer.id);
      if (!record) {
        throw new Error(`Custom sound blob not found in IndexedDB for id: ${layer.id}`);
      }
      return this.decodeSoundFromBlob(layer.id, record.blob);
    }

    return this.loadSoundFromUrl(layer.id, layer.audioUrl);
  }

  private rampGainSmoothly(gainParam: AudioParam, targetGain: number, rampDuration = 0.065): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const currentVal = Math.max(0.0001, gainParam.value);
    const safeTarget = Math.max(0.0001, Math.min(1.5, targetGain));

    gainParam.cancelScheduledValues(now);
    gainParam.setValueAtTime(currentVal, now);
    gainParam.exponentialRampToValueAtTime(safeTarget, now + rampDuration);

    if (targetGain <= 0.0001) {
      gainParam.setTargetAtTime(0, now + rampDuration, 0.015);
    }
  }

  public async startOrUpdateLayer(
    layer: ActiveSoundLayer,
    effectiveAudible: boolean
  ): Promise<void> {
    await this.init();
    const ctx = this.audioContext!;

    const targetVolume = effectiveAudible ? layer.volume : 0;
    const existing = this.activeLayerNodes.get(layer.id);

    if (existing) {
      this.rampGainSmoothly(existing.gainNode.gain, targetVolume);
      this.applyPan(existing.pannerNode, layer.pan ?? 0);
      this.applyFilterConfig(existing.filterNode, layer.filter);
      return;
    }

    const buffer = await this.resolveAudioBuffer(layer);

    if (this.activeLayerNodes.has(layer.id)) {
      const nodeSet = this.activeLayerNodes.get(layer.id)!;
      this.rampGainSmoothly(nodeSet.gainNode.gain, targetVolume);
      return;
    }

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = true;

    const filterNode = ctx.createBiquadFilter();
    this.applyFilterConfig(filterNode, layer.filter, true);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.rampGainSmoothly(gainNode.gain, targetVolume, 0.15);

    const pannerNode = ctx.createStereoPanner();
    this.applyPan(pannerNode, layer.pan ?? 0, true);

    sourceNode.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(pannerNode);
    pannerNode.connect(this.workletNode!);

    sourceNode.start(0);

    this.activeLayerNodes.set(layer.id, {
      sourceNode,
      filterNode,
      gainNode,
      pannerNode,
    });
  }

  public updateLayerGain(layerId: string, effectiveVolume: number): void {
    const nodes = this.activeLayerNodes.get(layerId);
    if (!nodes) return;
    this.rampGainSmoothly(nodes.gainNode.gain, effectiveVolume);
  }

  public updateLayerPan(layerId: string, pan: number): void {
    const nodes = this.activeLayerNodes.get(layerId);
    if (!nodes) return;
    this.applyPan(nodes.pannerNode, pan);
  }

  private applyPan(panner: StereoPannerNode, pan: number, immediate = false): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    const clamped = Math.max(-1, Math.min(1, pan));
    if (immediate) {
      panner.pan.setValueAtTime(clamped, now);
    } else {
      panner.pan.cancelScheduledValues(now);
      panner.pan.setValueAtTime(panner.pan.value, now);
      panner.pan.linearRampToValueAtTime(clamped, now + 0.05);
    }
  }

  public updateLayerFilter(layerId: string, filter: FilterConfig): void {
    const nodes = this.activeLayerNodes.get(layerId);
    if (!nodes) return;
    this.applyFilterConfig(nodes.filterNode, filter);
  }

  private applyFilterConfig(
    filterNode: BiquadFilterNode,
    filter: FilterConfig,
    immediate = false
  ): void {
    if (!this.audioContext) return;
    const now = this.audioContext.currentTime;
    filterNode.type = filter.type;
    const safeFreq = Math.max(200, Math.min(20000, filter.frequency));

    if (immediate) {
      filterNode.frequency.setValueAtTime(safeFreq, now);
      filterNode.Q.setValueAtTime(filter.q, now);
    } else {
      filterNode.frequency.cancelScheduledValues(now);
      filterNode.frequency.setValueAtTime(Math.max(200, filterNode.frequency.value), now);
      filterNode.frequency.exponentialRampToValueAtTime(safeFreq, now + 0.06);
      filterNode.Q.setTargetAtTime(filter.q, now, 0.03);
    }
  }

  public removeLayer(layerId: string): void {
    const nodes = this.activeLayerNodes.get(layerId);
    if (!nodes || !this.audioContext) return;

    this.activeLayerNodes.delete(layerId);
    this.rampGainSmoothly(nodes.gainNode.gain, 0, 0.08);

    window.setTimeout(() => {
      try {
        nodes.sourceNode.stop();
        nodes.sourceNode.disconnect();
        nodes.filterNode.disconnect();
        nodes.gainNode.disconnect();
        nodes.pannerNode.disconnect();
      } catch {
        // Ignore if already stopped
      }
    }, 110);
  }

  public clearAllLayers(): void {
    for (const id of Array.from(this.activeLayerNodes.keys())) {
      this.removeLayer(id);
    }
  }

  public setMasterVolume(masterVolume: number, isMutedAll: boolean): void {
    if (!this.masterGainNode) return;
    const effective = isMutedAll ? 0 : masterVolume;
    this.rampGainSmoothly(this.masterGainNode.gain, effective, 0.07);
  }

  public startSleepTimer(
    durationMinutes: number,
    currentMasterVolume: number,
    isMutedAll: boolean
  ): void {
    this.cancelSleepTimer();
    if (!this.audioContext || durationMinutes <= 0) return;

    const durationSec = durationMinutes * 60;
    this.sleepTimerDurationSec = durationSec;
    const startAudioTime = this.audioContext.currentTime;
    this.sleepTimerEndAudioTime = startAudioTime + durationSec;
    const lookaheadWindowSec = 0.1;

    const schedulerTick = () => {
      if (this.sleepTimerEndAudioTime === null || !this.audioContext) return;

      const nowAudio = this.audioContext.currentTime;
      const remaining = Math.max(0, this.sleepTimerEndAudioTime - nowAudio);

      if (this.onSleepTimerTickCallback) {
        this.onSleepTimerTickCallback(Math.ceil(remaining));
      }

      if (
        remaining <= 5.0 &&
        remaining > lookaheadWindowSec &&
        !isMutedAll &&
        this.masterGainNode
      ) {
        const attenuated = Math.max(0.0001, currentMasterVolume * (remaining / 5.0));
        this.masterGainNode.gain.exponentialRampToValueAtTime(attenuated, nowAudio + 0.05);
      }

      if (nowAudio + lookaheadWindowSec >= this.sleepTimerEndAudioTime) {
        const triggerDelayMs = Math.max(0, (this.sleepTimerEndAudioTime - nowAudio) * 1000);
        this.sleepTimerEndAudioTime = null;
        this.sleepTimerTimeoutId = window.setTimeout(() => {
          this.sleepTimerTimeoutId = null;
          if (this.onSleepTimerCompleteCallback) {
            this.onSleepTimerCompleteCallback();
          }
        }, triggerDelayMs);
        return;
      }

      this.sleepTimerTimeoutId = window.setTimeout(schedulerTick, 25);
    };

    this.sleepTimerTimeoutId = window.setTimeout(schedulerTick, 25);
  }

  public cancelSleepTimer(): void {
    if (this.sleepTimerTimeoutId !== null) {
      window.clearTimeout(this.sleepTimerTimeoutId);
      this.sleepTimerTimeoutId = null;
    }
    this.sleepTimerEndAudioTime = null;
    this.sleepTimerDurationSec = 0;
  }
}

export const audioEngine = new AudioEngine();
