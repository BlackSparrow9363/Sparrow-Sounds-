/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  EyeOff,
  Sparkles,
  RotateCcw,
  Trash2,
  Shuffle,
} from 'lucide-react';
import { useAudioStore, usePrefersReducedMotion } from './store/useAudioStore';
import { AccessibleSlider } from './components/ui/AccessibleSlider';
import { SoundLibrarySidebar } from './components/sound/SoundLibrarySidebar';
import { SoundLayerCard } from './components/sound/SoundLayerCard';
import { PresetsAndTimerPanel } from './components/ui/PresetsAndTimerPanel';
import { AudioVisualizer } from './visualizer/AudioVisualizer';
import { DEFAULT_STARTER_PRESETS } from './lib/audio/soundSynthesis';

export default function App() {
  const hydrateFromIndexedDB = useAudioStore((s) => s.hydrateFromIndexedDB);
  const isHydrated = useAudioStore((s) => s.isHydrated);
  const isPlaying = useAudioStore((s) => s.isPlaying);
  const isMutedAll = useAudioStore((s) => s.isMutedAll);
  const masterVolume = useAudioStore((s) => s.masterVolume);
  const activeLayers = useAudioStore((s) => s.activeLayers);
  const activePresetId = useAudioStore((s) => s.activePresetId);
  const reducedMotionOverride = useAudioStore((s) => s.reducedMotionOverride);

  const toggleGlobalPlayPause = useAudioStore((s) => s.toggleGlobalPlayPause);
  const toggleMuteAll = useAudioStore((s) => s.toggleMuteAll);
  const setMasterVolume = useAudioStore((s) => s.setMasterVolume);
  const loadPreset = useAudioStore((s) => s.loadPreset);
  const clearAllLayers = useAudioStore((s) => s.clearAllLayers);
  const randomizeMix = useAudioStore((s) => s.randomizeMix);
  const setSystemPrefersReducedMotion = useAudioStore(
    (s) => s.setSystemPrefersReducedMotion
  );
  const setReducedMotionOverride = useAudioStore((s) => s.setReducedMotionOverride);

  const prefersReducedMotion = usePrefersReducedMotion();

  const heroContainerRef = useRef<HTMLDivElement>(null);
  const heroHeadlineRef = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroControlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    hydrateFromIndexedDB();
  }, [hydrateFromIndexedDB]);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setSystemPrefersReducedMotion(mql.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersReducedMotion(e.matches);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, [setSystemPrefersReducedMotion]);

  useEffect(() => {
    if (
      !heroHeadlineRef.current ||
      !heroSubRef.current ||
      !heroControlsRef.current
    ) {
      return;
    }

    if (prefersReducedMotion) {
      gsap.set(
        [heroHeadlineRef.current, heroSubRef.current, heroControlsRef.current],
        { opacity: 1, y: 0, clearProps: 'transform' }
      );
      return;
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(
        heroHeadlineRef.current,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.6 }
      )
        .fromTo(
          heroSubRef.current,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.45 },
          '-=0.35'
        )
        .fromTo(
          heroControlsRef.current,
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.4 },
          '-=0.3'
        );
    }, heroContainerRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  const anySoloed = activeLayers.some((l) => l.isSoloed);

  return (
    <div className="min-h-screen flex flex-col bg-[#070A10] text-[#F1F5F9]">
      {/* Skip to Main Content Link */}
      <a
        href="#library"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-slate-950 focus:font-semibold focus:rounded-lg"
      >
        Skip to Sound Library
      </a>

      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-[#070A10]/90 backdrop-blur-xl border-b border-slate-800/80">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#"
          className="text-2xl font-display tracking-normal text-slate-100 hover:text-amber-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 rounded-xs"
        >
          Sparrow sounds
        </a>

        {/* Zone 2: Navigation Links */}
        <nav
          aria-label="Primary studio sections"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
        >
          <a
            href="#library"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Sound Library
          </a>
          <a
            href="#mixer"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Active Mixer
          </a>
          <a
            href="#presets"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Saved Mixes &amp; Timer
          </a>
        </nav>

        {/* Zone 3: Global Audio Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleMuteAll}
            aria-pressed={isMutedAll}
            aria-label={isMutedAll ? 'Unmute all audio' : 'Mute all audio'}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border whitespace-nowrap shrink-0 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
              isMutedAll
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                : 'bg-slate-900 text-slate-200 border-slate-700/80 hover:border-slate-500'
            }`}
          >
            {isMutedAll ? (
              <>
                <VolumeX className="w-4 h-4" aria-hidden="true" />
                <span>Unmute All</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4" aria-hidden="true" />
                <span>Mute All</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={toggleGlobalPlayPause}
            aria-pressed={isPlaying}
            aria-label={isPlaying ? 'Pause soundscape playback' : 'Play soundscape'}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
              isPlaying
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-emerald-400 text-slate-950 hover:bg-emerald-300'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Pause Mix</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Play Soundscape</span>
              </>
            )}
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Hero Studio Console + Quick Mood Scene Selector */}
        <section
          ref={heroContainerRef}
          aria-labelledby="hero-heading"
          className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-[#121A2B] via-[#0C121E] to-[#080C14] p-6 sm:p-8 shadow-2xl"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-28 -right-20 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 -left-20 w-80 h-80 rounded-full bg-sky-500/10 blur-3xl"
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-300/90">
                <span>42 Real Recorded Environments</span>
                <span aria-hidden="true">·</span>
                <span>Nature, Rain, City &amp; Café</span>
                <span aria-hidden="true">·</span>
                <span>Web Audio Studio Mixer</span>
              </div>

              <h1
                id="hero-heading"
                ref={heroHeadlineRef}
                className="text-3xl sm:text-4xl lg:text-5xl font-display text-white leading-tight max-w-2xl"
              >
                Immerse your space in organic rain, forest songbirds, and city nights.
              </h1>

              <p
                ref={heroSubRef}
                className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed"
              >
                Layer authentic field recordings from nature, cozy cafés, sleeper trains, and
                rainstorms. Save your favorite mixes locally and set a gentle sleep fade-out.
              </p>

              {/* Instant Curated Scene Buttons */}
              <div className="pt-1">
                <div className="text-xs text-slate-400 mb-2">
                  Instant Curated Scenes:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {DEFAULT_STARTER_PRESETS.map((scene) => {
                    const isCurrent = activePresetId === scene.id;
                    return (
                      <button
                        key={scene.id}
                        type="button"
                        onClick={() => loadPreset(scene)}
                        className={`px-3.5 py-2 text-xs font-medium rounded-xl border whitespace-nowrap transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                          isCurrent
                            ? 'bg-amber-400/15 text-amber-300 border-amber-400/50 font-semibold'
                            : 'bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        {scene.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Master Output & Visualizer Console */}
            <div
              ref={heroControlsRef}
              className="lg:col-span-5 rounded-2xl border border-slate-800/90 bg-[#080C14]/90 p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Master Studio Volume
                </span>
                <span className="text-sm font-mono tabular-nums text-amber-300 font-semibold">
                  {isMutedAll ? 'MUTED (0%)' : `${Math.round(masterVolume * 100)}%`}
                </span>
              </div>

              <AccessibleSlider
                label="Master studio volume"
                value={masterVolume}
                min={0}
                max={1}
                step={0.01}
                showMarkers
                accentColor={isMutedAll ? '#64748B' : '#F59E0B'}
                formatValue={(v) => `${Math.round(v * 100)}%`}
                onChange={setMasterVolume}
              />

              <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-2 font-mono tabular-nums">
                  <span>{activeLayers.length} Active Sounds</span>
                  <span aria-hidden="true">·</span>
                  <span>{isHydrated ? 'Saved Locally' : 'Loading...'}</span>
                </div>

                <button
                  type="button"
                  onClick={() => setReducedMotionOverride(!prefersReducedMotion)}
                  aria-pressed={prefersReducedMotion}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    prefersReducedMotion
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                  }`}
                >
                  <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>
                    Reduced Motion: {prefersReducedMotion ? 'On' : 'Off'}
                    {reducedMotionOverride === null ? ' (OS)' : ''}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Main Studio Workspace:
            Left (8 cols): Restyled Soundscape Library Grid
            Right (4 cols): Real-Time Visualizer + Active Mix Stack + Presets & Sleep Timer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 8 Columns: Interactive Soundscape Library */}
          <div id="library" className="lg:col-span-8">
            <SoundLibrarySidebar />
          </div>

          {/* Right 4 Columns: Active Mixer Console, Visualizer & Presets */}
          <div id="mixer" className="lg:col-span-4 space-y-6">
            <AudioVisualizer />

            {/* Active Layers Mixer Panel */}
            <section
              aria-labelledby="active-mixer-heading"
              className="rounded-2xl border border-slate-800/90 bg-[#0D131F]/90 p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2
                    id="active-mixer-heading"
                    className="text-lg font-display text-slate-100 tracking-wide"
                  >
                    Active Mix ({activeLayers.length})
                  </h2>
                  <p className="text-xs text-slate-400">
                    Fine-tune volume, warmth, and stereo balance.
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={randomizeMix}
                    title="Blend 3 random sounds"
                    className="p-2 text-slate-300 hover:text-amber-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Surprise random mix"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loadPreset(DEFAULT_STARTER_PRESETS[0])}
                    title="Reset to default mix"
                    className="p-2 text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    aria-label="Reset to default mix"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  {activeLayers.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAllLayers}
                      title="Clear all active sounds"
                      className="p-2 text-slate-400 hover:text-rose-400 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      aria-label="Clear all active sounds"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {activeLayers.length > 0 ? (
                <div className="space-y-2.5 max-h-[440px] overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {activeLayers.map((layer) => (
                      <SoundLayerCard
                        key={layer.id}
                        layer={layer}
                        anySoloed={anySoloed}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-800/80 bg-[#080C14] p-6 text-center space-y-3">
                  <Sparkles className="w-5 h-5 text-amber-400 mx-auto" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-slate-200">
                    No active sounds in your mix
                  </h3>
                  <p className="text-xs text-slate-400">
                    Click any card in the Soundscape Library or pick a curated scene above.
                  </p>
                </div>
              )}
            </section>

            {/* Saved Presets & Sleep Timer */}
            <div id="presets">
              <PresetsAndTimerPanel />
            </div>
          </div>
        </div>
      </main>

      <footer className="mt-12 border-t border-slate-800/80 py-6 px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <span>Sparrow sounds — Ambient Soundscape Studio</span>
          <div className="flex items-center gap-3">
            <span>42 Real Field Recordings</span>
            <span aria-hidden="true">·</span>
            <span>Web Audio API + AudioWorklet</span>
            <span aria-hidden="true">·</span>
            <span>Local IndexedDB Storage</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
