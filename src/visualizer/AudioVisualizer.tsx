import React, { useEffect, useRef, useState } from 'react';
import { audioEngine } from '../lib/audio/AudioEngine';
import { useAudioStore, usePrefersReducedMotion } from '../store/useAudioStore';
import { TransientAudioTelemetry } from '../types/audio';

export const AudioVisualizer: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const telemetryRef = useRef<TransientAudioTelemetry>(
    useAudioStore.getState().transientTelemetry
  );
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isMutedAll = useAudioStore((s) => s.isMutedAll);
  const activeLayerCount = useAudioStore((s) => s.activeLayers.length);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [mode, setMode] = useState<'hybrid' | 'spectrum' | 'waveform'>('hybrid');

  // Subscribe transiently to Zustand store updates without triggering React re-renders
  useEffect(() => {
    const unsubscribe = useAudioStore.subscribe((state) => {
      telemetryRef.current = state.transientTelemetry;
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId: number | null = null;
    const freqBuffer = new Uint8Array(512);
    const timeBuffer = new Uint8Array(512);

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const renderFrame = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // Subtle studio acoustic grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      const horizLines = 3;
      for (let i = 1; i <= horizLines; i++) {
        const y = (height / (horizLines + 1)) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const analyser = audioEngine.getAnalyserNode();
      const activeAudio = isPlaying && !isMutedAll && activeLayerCount > 0 && analyser;

      if (activeAudio && analyser) {
        analyser.getByteFrequencyData(freqBuffer);
        analyser.getByteTimeDomainData(timeBuffer);
      } else {
        freqBuffer.fill(0);
        timeBuffer.fill(128);
      }

      const telemetry = telemetryRef.current;

      if (prefersReducedMotion) {
        // Accessible Reduced-Motion View: Calm static level meters and gentle harmonic horizon
        const barCount = 24;
        const gap = 6;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(4, (width - 32 - totalGap) / barCount);

        for (let i = 0; i < barCount; i++) {
          const binIndex = Math.min(freqBuffer.length - 1, Math.floor((i / barCount) * 160));
          const val = activeAudio ? freqBuffer[binIndex] / 255 : 0.04;
          const barHeight = Math.max(4, val * (height - 36));
          const x = 16 + i * (barWidth + gap);
          const y = height - 16 - barHeight;

          ctx.fillStyle = activeAudio
            ? 'rgba(245, 158, 11, 0.55)'
            : 'rgba(100, 116, 139, 0.25)';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 2);
          ctx.fill();
        }
      } else {
        // Full 60fps rAF Spectrum + Time-Domain Waveform
        if (mode === 'spectrum' || mode === 'hybrid') {
          const barCount = 56;
          const gap = 3;
          const usableWidth = width - 24;
          const barWidth = Math.max(2, (usableWidth - gap * (barCount - 1)) / barCount);

          for (let i = 0; i < barCount; i++) {
            // Logarithmic-like mapping across the lower-to-mid ambient frequencies
            const normalizedIdx = Math.pow(i / barCount, 1.45);
            const bin = Math.min(
              freqBuffer.length - 1,
              Math.max(1, Math.floor(normalizedIdx * 220))
            );
            const amplitude = activeAudio ? freqBuffer[bin] / 255 : 0.02;
            const barHeight = Math.max(3, amplitude * (height - 28));
            const x = 12 + i * (barWidth + gap);
            const y = height - 12 - barHeight;

            const grad = ctx.createLinearGradient(0, y, 0, height - 12);
            grad.addColorStop(0, 'rgba(251, 191, 36, 0.85)');
            grad.addColorStop(0.6, 'rgba(245, 158, 11, 0.45)');
            grad.addColorStop(1, 'rgba(56, 189, 248, 0.18)');

            ctx.fillStyle = activeAudio ? grad : 'rgba(100, 116, 139, 0.2)';
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 2);
            ctx.fill();
          }
        }

        if (mode === 'waveform' || mode === 'hybrid') {
          ctx.save();
          ctx.beginPath();
          ctx.lineWidth = mode === 'waveform' ? 2.2 : 1.6;
          ctx.strokeStyle = activeAudio
            ? 'rgba(56, 189, 248, 0.85)'
            : 'rgba(148, 163, 184, 0.3)';

          const sliceWidth = width / (timeBuffer.length - 1);
          let x = 0;
          for (let i = 0; i < timeBuffer.length; i++) {
            const v = timeBuffer[i] / 128.0; // 0..2, 1 is center
            const y = (v * height) / 2;
            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }
          ctx.stroke();
          ctx.restore();
        }
      }

      // Draw Stereo L/R RMS Transient Meter on right edge (driven directly by AudioWorklet telemetry)
      const rmsL = activeAudio ? Math.min(1, telemetry.rmsLeft * 3.2) : 0;
      const rmsR = activeAudio ? Math.min(1, telemetry.rmsRight * 3.2) : 0;
      const meterX = width - 18;
      const meterH = height - 24;

      ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
      ctx.fillRect(meterX, 12, 4, meterH);
      ctx.fillRect(meterX + 6, 12, 4, meterH);

      const hL = Math.max(2, rmsL * meterH);
      const hR = Math.max(2, rmsR * meterH);
      ctx.fillStyle = '#34D399';
      ctx.fillRect(meterX, 12 + (meterH - hL), 4, hL);
      ctx.fillRect(meterX + 6, 12 + (meterH - hR), 4, hR);

      if (!prefersReducedMotion) {
        rafId = window.requestAnimationFrame(renderFrame);
      }
    };

    renderFrame();

    // If reduced motion is enabled, refresh at a calm 2Hz interval instead of 60fps
    let calmInterval: number | null = null;
    if (prefersReducedMotion) {
      calmInterval = window.setInterval(renderFrame, 500);
    }

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      if (calmInterval !== null) window.clearInterval(calmInterval);
    };
  }, [isPlaying, isMutedAll, activeLayerCount, prefersReducedMotion, mode]);

  return (
    <div className="relative rounded-xl border border-slate-800/90 bg-[#0F1623] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">
            Real-Time Acoustic Spectrum &amp; Waveform
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            {prefersReducedMotion ? 'Reduced-Motion Mode' : 'AudioWorklet DSP Active'}
          </span>
        </div>

        {/* Interactive segmented filter controls for visualizer view */}
        <div
          role="group"
          aria-label="Visualizer display mode"
          className="flex items-center gap-1 p-1 bg-slate-900/90 border border-slate-800 rounded-lg"
        >
          {(['hybrid', 'spectrum', 'waveform'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md capitalize whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                mode === m
                  ? 'bg-slate-800 text-amber-300 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full h-36 rounded-lg bg-[#090D14] border border-slate-800/70 overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-label="Audio spectrum and waveform visualizer"
          role="img"
          className="w-full h-full block"
        />
      </div>
    </div>
  );
};
