import React, { useRef, useState } from 'react';
import {
  Upload,
  Search,
  Trash2,
  AlertCircle,
  Loader2,
  Volume2,
  VolumeX,
  Shuffle,
  X,
} from 'lucide-react';
import { SoundCategory } from '../../types/audio';
import { useAudioStore } from '../../store/useAudioStore';
import { SoundIcon } from './SoundIcon';
import { AccessibleSlider } from '../ui/AccessibleSlider';

const CATEGORIES: Array<'All' | SoundCategory> = [
  'All',
  'Rain & Storm',
  'Nature',
  'City & Places',
  'Animals & Birds',
  'Transport',
  'Objects & Focus',
  'Custom',
];

export const SoundLibrarySidebar: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | SoundCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const soundLibrary = useAudioStore((s) => s.soundLibrary);
  const activeLayers = useAudioStore((s) => s.activeLayers);
  const loadingSoundIds = useAudioStore((s) => s.loadingSoundIds);
  const addOrToggleSoundLayer = useAudioStore((s) => s.addOrToggleSoundLayer);
  const setSoundVolumeFromLibrary = useAudioStore((s) => s.setSoundVolumeFromLibrary);
  const toggleLayerMute = useAudioStore((s) => s.toggleLayerMute);
  const toggleLayerSolo = useAudioStore((s) => s.toggleLayerSolo);
  const randomizeMix = useAudioStore((s) => s.randomizeMix);
  const uploadCustomSound = useAudioStore((s) => s.uploadCustomSound);
  const deleteCustomSound = useAudioStore((s) => s.deleteCustomSound);
  const isUploading = useAudioStore((s) => s.isUploading);
  const uploadError = useAudioStore((s) => s.uploadError);
  const clearUploadError = useAudioStore((s) => s.clearUploadError);

  const activeLayerMap = new Map(activeLayers.map((l) => [l.id, l]));
  const anySoloed = activeLayers.some((l) => l.isSoloed);

  const filteredSounds = soundLibrary.filter((item) => {
    const matchesCat =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadCustomSound(file);
    e.target.value = '';
  };

  return (
    <section
      aria-label="Ambient Sound Library"
      className="rounded-2xl border border-slate-800/80 bg-[#0D131F]/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl"
    >
      {/* Library Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
        <div>
          <h2 className="text-2xl font-display text-slate-100 tracking-wide">
            Soundscape Library
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Click any ambient card to blend it into your mix, or drag its slider to set the level.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 42+ sounds..."
              aria-label="Search ambient sound sources"
              className="w-full rounded-xl bg-[#080C14] border border-slate-800 pl-8 pr-7 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Surprise Mix Button */}
          <button
            type="button"
            onClick={randomizeMix}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Shuffle className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Surprise Mix</span>
          </button>

          {/* Upload Custom Audio */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".wav,.mp3,.ogg,.flac,audio/*"
            onChange={handleFileChange}
            className="sr-only"
            id="custom-sound-upload-input"
          />
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isUploading ? 'Decoding...' : 'Upload Audio'}</span>
          </button>
        </div>
      </div>

      {uploadError && (
        <div
          role="alert"
          className="mt-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/70 flex items-start justify-between gap-2 text-xs text-rose-200"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
            <span>{uploadError}</span>
          </div>
          <button
            type="button"
            onClick={clearUploadError}
            className="text-rose-300 hover:text-white text-xs underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Interactive Category Filter Segmented Bar */}
      <div
        role="group"
        aria-label="Filter sound library by category"
        className="flex items-center gap-1.5 overflow-x-auto py-4 no-scrollbar"
      >
        {CATEGORIES.map((cat) => {
          const count =
            cat === 'All'
              ? soundLibrary.length
              : soundLibrary.filter((s) => s.category === cat).length;
          if (cat === 'Custom' && count === 0) return null;
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap shrink-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm'
                  : 'bg-[#080C14] text-slate-400 hover:text-slate-200 border border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <span>{cat}</span>
              <span
                className={`ml-1.5 font-mono tabular-nums text-[11px] ${
                  isSelected ? 'text-slate-900' : 'text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Modern Tactile Sound Cards Grid */}
      {filteredSounds.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
          {filteredSounds.map((item) => {
            const activeLayer = activeLayerMap.get(item.id);
            const isActive = Boolean(activeLayer);
            const isLoading = Boolean(loadingSoundIds[item.id]);
            const isSilenced =
              activeLayer && (activeLayer.isMuted || (anySoloed && !activeLayer.isSoloed));

            return (
              <div
                key={item.id}
                className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-b from-[#162033] to-[#101827] border-amber-500/45 shadow-lg'
                    : 'bg-[#090D16] border-slate-800/80 hover:border-slate-700 hover:bg-[#0D1320]'
                }`}
              >
                {/* Card Top: Icon + Title + Toggle Button */}
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => addOrToggleSoundLayer(item)}
                    aria-pressed={isActive}
                    className="flex items-start gap-3.5 text-left flex-1 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-lg"
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                        isActive
                          ? 'bg-slate-900/90 ring-1 ring-white/15'
                          : 'bg-slate-900/70 border border-slate-800/90'
                      }`}
                      style={
                        isActive
                          ? {
                              boxShadow: `0 0 20px -4px ${item.accentColor}40`,
                            }
                          : undefined
                      }
                    >
                      {isLoading ? (
                        <Loader2
                          className="w-5 h-5 animate-spin"
                          style={{ color: item.accentColor }}
                        />
                      ) : (
                        <SoundIcon
                          name={item.iconName}
                          className="w-5 h-5 transition-colors"
                          style={{
                            color: isActive ? item.accentColor : '#94A3B8',
                          }}
                        />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3
                          className={`text-sm font-semibold truncate transition-colors ${
                            isActive
                              ? 'text-white'
                              : 'text-slate-200 group-hover:text-white'
                          }`}
                        >
                          {item.name}
                        </h3>
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>{item.category}</span>
                        {isActive && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className="font-mono tabular-nums font-semibold"
                              style={{ color: item.accentColor }}
                            >
                              {isSilenced
                                ? 'Muted'
                                : `${Math.round((activeLayer?.volume ?? 0.6) * 100)}%`}
                            </span>
                          </>
                        )}
                      </div>

                      <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </button>

                  {item.isCustom && (
                    <button
                      type="button"
                      onClick={() => deleteCustomSound(item.id)}
                      aria-label={`Delete custom sound ${item.name}`}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>

                {/* Inline Volume Slider & Quick Solo/Mute Controls */}
                <div className="mt-3.5 pt-3 border-t border-slate-800/70 flex items-center gap-2.5">
                  <div className="flex-1">
                    <AccessibleSlider
                      label={`${item.name} volume`}
                      value={activeLayer ? activeLayer.volume : 0}
                      min={0}
                      max={1}
                      step={0.01}
                      accentColor={
                        isActive && !isSilenced ? item.accentColor : '#475569'
                      }
                      formatValue={(v) => `${Math.round(v * 100)}%`}
                      onChange={(val) => setSoundVolumeFromLibrary(item, val)}
                    />
                  </div>

                  {activeLayer ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleLayerMute(item.id)}
                        aria-pressed={activeLayer.isMuted}
                        aria-label={
                          activeLayer.isMuted
                            ? `Unmute ${item.name}`
                            : `Mute ${item.name}`
                        }
                        className={`p-1.5 rounded-lg border text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          activeLayer.isMuted
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                        }`}
                      >
                        {activeLayer.isMuted ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleLayerSolo(item.id)}
                        aria-pressed={activeLayer.isSoloed}
                        aria-label={`Solo ${item.name}`}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          activeLayer.isSoloed
                            ? 'bg-amber-400 text-slate-950 border-amber-300'
                            : 'bg-slate-900 text-slate-400 hover:text-white border-slate-800'
                        }`}
                      >
                        S
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => addOrToggleSoundLayer(item)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      Play
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-slate-400">
          No sounds match your search filter. Try another keyword or category.
        </div>
      )}
    </section>
  );
};
