import React, { useState } from 'react';
import {
  Bookmark,
  Clock,
  Plus,
  Trash2,
  Play,
  X,
} from 'lucide-react';
import { useAudioStore } from '../../store/useAudioStore';

export const PresetsAndTimerPanel: React.FC = () => {
  const presets = useAudioStore((s) => s.presets);
  const activePresetId = useAudioStore((s) => s.activePresetId);
  const activeLayers = useAudioStore((s) => s.activeLayers);
  const saveCurrentAsPreset = useAudioStore((s) => s.saveCurrentAsPreset);
  const loadPreset = useAudioStore((s) => s.loadPreset);
  const deletePreset = useAudioStore((s) => s.deletePreset);

  const sleepTimerRemainingSec = useAudioStore((s) => s.sleepTimerRemainingSec);
  const sleepTimerTotalSec = useAudioStore((s) => s.sleepTimerTotalSec);
  const startSleepTimer = useAudioStore((s) => s.startSleepTimer);
  const cancelSleepTimer = useAudioStore((s) => s.cancelSleepTimer);

  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');

  const handleSavePresetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    await saveCurrentAsPreset(presetName, presetDesc);
    setPresetName('');
    setPresetDesc('');
    setIsSavingPreset(false);
  };

  const formatCountdown = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      {/* Hybrid Web Audio Clock Sleep Timer */}
      <section
        aria-labelledby="sleep-timer-heading"
        className="rounded-xl border border-slate-800/90 bg-[#0F1623] p-4"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h3 id="sleep-timer-heading" className="text-sm font-semibold text-slate-100">
              Sleep Timer
            </h3>
          </div>
          {sleepTimerRemainingSec !== null && (
            <button
              type="button"
              onClick={cancelSleepTimer}
              aria-label="Cancel sleep timer"
              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-950/40 border border-rose-800/50 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              <span>Cancel</span>
            </button>
          )}
        </div>

        {sleepTimerRemainingSec !== null ? (
          <div className="rounded-lg bg-[#090D14] border border-slate-800 p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-400">Remaining until fade-out</span>
              <span className="text-xl font-semibold font-mono tabular-nums text-amber-300">
                {formatCountdown(sleepTimerRemainingSec)}
              </span>
            </div>
            {sleepTimerTotalSec && sleepTimerTotalSec > 0 && (
              <div className="mt-2 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 transition-all duration-300"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (sleepTimerRemainingSec / sleepTimerTotalSec) * 100)
                    )}%`,
                  }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => startSleepTimer(mins)}
                aria-label={`Set sleep timer for ${mins} minutes`}
                className="px-2.5 py-2 text-xs font-mono tabular-nums font-medium text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-lg transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {mins}m
              </button>
            ))}
          </div>
        )}
      </section>

      {/* IndexedDB Presets Manager */}
      <section
        aria-labelledby="presets-heading"
        className="rounded-xl border border-slate-800/90 bg-[#0F1623] p-4"
      >
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <h3 id="presets-heading" className="text-sm font-semibold text-slate-100">
              Saved Soundscapes
            </h3>
          </div>
          <button
            type="button"
            disabled={activeLayers.length === 0}
            onClick={() => setIsSavingPreset((v) => !v)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Save Mix</span>
          </button>
        </div>

        {isSavingPreset && (
          <form
            onSubmit={handleSavePresetSubmit}
            className="mb-4 p-3 rounded-lg bg-[#090D14] border border-slate-800 space-y-2.5"
          >
            <div>
              <label htmlFor="preset-name-input" className="block text-xs text-slate-300 mb-1">
                Preset Name
              </label>
              <input
                id="preset-name-input"
                type="text"
                required
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g., Evening Pine Sanctuary"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>
            <div>
              <label htmlFor="preset-desc-input" className="block text-xs text-slate-400 mb-1">
                Notes (optional)
              </label>
              <input
                id="preset-desc-input"
                type="text"
                value={presetDesc}
                onChange={(e) => setPresetDesc(e.target.value)}
                placeholder="Describe spatial mood or focus setting"
                className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSavingPreset(false)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Save to IndexedDB
              </button>
            </div>
          </form>
        )}

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {presets.map((preset) => {
            const isCurrent = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`group flex items-start justify-between gap-2 p-2.5 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'bg-[#131C2E] border-amber-500/40'
                    : 'bg-[#090D14] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="text-left w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Play
                        className={`w-3 h-3 shrink-0 ${
                          isCurrent ? 'text-amber-400 fill-amber-400' : 'text-slate-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {preset.name}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {preset.description}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-500 font-mono tabular-nums">
                      <span>{preset.layers.length} layers</span>
                      <span aria-hidden="true">·</span>
                      <span>Master {Math.round(preset.masterVolume * 100)}%</span>
                    </div>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => deletePreset(preset.id)}
                  aria-label={`Delete preset ${preset.name}`}
                  className="p-1.5 text-slate-500 hover:text-rose-400 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
