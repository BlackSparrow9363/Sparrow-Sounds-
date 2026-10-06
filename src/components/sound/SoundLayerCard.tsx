import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Sliders,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ActiveSoundLayer } from '../../types/audio';
import { useAudioStore, usePrefersReducedMotion } from '../../store/useAudioStore';
import { AccessibleSlider } from '../ui/AccessibleSlider';
import { SoundIcon } from './SoundIcon';

interface SoundLayerCardProps {
  layer: ActiveSoundLayer;
  anySoloed: boolean;
}

export const SoundLayerCard: React.FC<SoundLayerCardProps> = ({ layer, anySoloed }) => {
  const [showTonePanel, setShowTonePanel] = useState(false);

  const setLayerVolume = useAudioStore((s) => s.setLayerVolume);
  const setLayerPan = useAudioStore((s) => s.setLayerPan);
  const toggleLayerMute = useAudioStore((s) => s.toggleLayerMute);
  const toggleLayerSolo = useAudioStore((s) => s.toggleLayerSolo);
  const removeSoundLayer = useAudioStore((s) => s.removeSoundLayer);
  const updateLayerFilter = useAudioStore((s) => s.updateLayerFilter);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isEffectivelyMuted = layer.isMuted || (anySoloed && !layer.isSoloed);

  const panLabel =
    layer.pan === 0
      ? 'Center'
      : layer.pan < 0
      ? `L ${Math.round(Math.abs(layer.pan) * 100)}%`
      : `R ${Math.round(layer.pan * 100)}%`;

  return (
    <motion.div
      layout={!prefersReducedMotion}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.16 }}
      className="rounded-xl border border-slate-800/90 bg-[#090D16] hover:border-slate-700/80 p-3.5 transition-colors"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0"
            style={{ color: layer.accentColor }}
          >
            <SoundIcon name={layer.iconName} className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-semibold text-slate-100 truncate">
              {layer.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono tabular-nums">
              <span className="font-sans">{layer.category}</span>
              <span aria-hidden="true">·</span>
              <span>
                {isEffectivelyMuted ? 'Silenced' : `${Math.round(layer.volume * 100)}%`}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions: Solo, Mute, Tone, Remove */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => toggleLayerSolo(layer.id)}
            aria-pressed={layer.isSoloed}
            aria-label={`Solo ${layer.name}`}
            className={`px-2 py-1 text-[11px] font-semibold rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              layer.isSoloed
                ? 'bg-amber-400 text-slate-950 border-amber-300'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Solo
          </button>

          <button
            type="button"
            onClick={() => toggleLayerMute(layer.id)}
            aria-pressed={layer.isMuted}
            aria-label={layer.isMuted ? `Unmute ${layer.name}` : `Mute ${layer.name}`}
            className={`p-1.5 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              layer.isMuted
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {layer.isMuted ? (
              <VolumeX className="w-3.5 h-3.5" />
            ) : (
              <Volume2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTonePanel((v) => !v)}
            aria-expanded={showTonePanel}
            aria-label={`Tone and stereo balance for ${layer.name}`}
            className={`p-1.5 rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              showTonePanel
                ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            {showTonePanel ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <Sliders className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => removeSoundLayer(layer.id)}
            aria-label={`Remove ${layer.name} from active mix`}
            className="p-1.5 text-slate-500 hover:text-rose-400 bg-slate-900 border border-slate-800 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Volume Slider */}
      <div className="mt-2.5">
        <AccessibleSlider
          label={`${layer.name} volume`}
          value={layer.volume}
          min={0}
          max={1}
          step={0.01}
          accentColor={isEffectivelyMuted ? '#64748B' : layer.accentColor}
          formatValue={(v) => `${Math.round(v * 100)}%`}
          onChange={(val) => setLayerVolume(layer.id, val)}
        />
      </div>

      {/* Optional Expandable Tone Warmth & Stereo Balance */}
      {showTonePanel && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Tone Warmth</span>
              <span className="font-mono tabular-nums text-slate-300">
                {layer.filter.frequency >= 1000
                  ? `${(layer.filter.frequency / 1000).toFixed(1)} kHz`
                  : `${Math.round(layer.filter.frequency)} Hz`}
              </span>
            </div>
            <AccessibleSlider
              label={`${layer.name} tone filter`}
              value={layer.filter.frequency}
              min={400}
              max={18000}
              step={200}
              accentColor="#38BDF8"
              formatValue={(v) => `${Math.round(v)} Hz`}
              onChange={(freq) => updateLayerFilter(layer.id, { frequency: freq })}
            />
          </div>

          <div>
            <div className="flex justify-between text-[11px] text-slate-400 mb-1">
              <span>Stereo Balance</span>
              <span className="font-mono tabular-nums text-slate-300">{panLabel}</span>
            </div>
            <AccessibleSlider
              label={`${layer.name} stereo balance`}
              value={layer.pan ?? 0}
              min={-1}
              max={1}
              step={0.05}
              showMarkers
              accentColor={layer.accentColor}
              formatValue={(v) =>
                v === 0
                  ? 'Center'
                  : v < 0
                  ? `Left ${Math.round(Math.abs(v) * 100)}%`
                  : `Right ${Math.round(v * 100)}%`
              }
              onChange={(p) => setLayerPan(layer.id, p)}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
};
