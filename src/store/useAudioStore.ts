import { create } from 'zustand';
import {
  ActiveSoundLayer,
  FilterConfig,
  SavedPreset,
  SoundLibraryItem,
  TransientAudioTelemetry,
} from '../types/audio';
import {
  BUILTIN_SOUND_LIBRARY,
  DEFAULT_STARTER_PRESETS,
} from '../lib/audio/soundSynthesis';
import { audioEngine } from '../lib/audio/AudioEngine';
import {
  deleteCustomSoundBlobFromDB,
  deletePresetFromDB,
  getAllCustomSoundBlobsFromDB,
  getAllPresetsFromDB,
  loadSessionStateFromDB,
  saveCustomSoundBlobToDB,
  savePresetToDB,
  saveSessionStateToDB,
} from '../db/indexedDb';

interface AudioStoreState {
  soundLibrary: SoundLibraryItem[];
  presets: SavedPreset[];
  activePresetId: string | null;

  activeLayers: ActiveSoundLayer[];
  loadingSoundIds: Record<string, boolean>;
  masterVolume: number;
  isPlaying: boolean;
  isMutedAll: boolean;

  sleepTimerRemainingSec: number | null;
  sleepTimerTotalSec: number | null;

  systemPrefersReducedMotion: boolean;
  reducedMotionOverride: boolean | null;

  transientTelemetry: TransientAudioTelemetry;

  isHydrated: boolean;
  uploadError: string | null;
  isUploading: boolean;

  hydrateFromIndexedDB: () => Promise<void>;
  toggleGlobalPlayPause: () => Promise<void>;
  pauseAudio: () => Promise<void>;
  toggleMuteAll: () => Promise<void>;
  setMasterVolume: (volume: number) => void;

  addOrToggleSoundLayer: (item: SoundLibraryItem) => Promise<void>;
  setSoundVolumeFromLibrary: (item: SoundLibraryItem, volume: number) => Promise<void>;
  removeSoundLayer: (layerId: string) => void;
  clearAllLayers: () => void;
  randomizeMix: () => Promise<void>;
  setLayerVolume: (layerId: string, volume: number) => void;
  setLayerPan: (layerId: string, pan: number) => void;
  toggleLayerMute: (layerId: string) => void;
  toggleLayerSolo: (layerId: string) => void;
  updateLayerFilter: (layerId: string, filterUpdate: Partial<FilterConfig>) => void;

  saveCurrentAsPreset: (name: string, description: string) => Promise<void>;
  loadPreset: (preset: SavedPreset) => Promise<void>;
  deletePreset: (presetId: string) => Promise<void>;

  uploadCustomSound: (file: File) => Promise<void>;
  deleteCustomSound: (soundId: string) => Promise<void>;

  startSleepTimer: (minutes: number) => Promise<void>;
  cancelSleepTimer: () => void;

  setSystemPrefersReducedMotion: (matches: boolean) => void;
  setReducedMotionOverride: (override: boolean | null) => void;
  clearUploadError: () => void;
}

let persistDebounceTimer: number | null = null;

function scheduleSessionPersist(state: AudioStoreState) {
  if (!state.isHydrated) return;
  if (persistDebounceTimer !== null) {
    window.clearTimeout(persistDebounceTimer);
  }
  persistDebounceTimer = window.setTimeout(() => {
    saveSessionStateToDB({
      masterVolume: state.masterVolume,
      isMutedAll: state.isMutedAll,
      activeLayers: state.activeLayers,
      reducedMotionOverride: state.reducedMotionOverride,
    });
  }, 250);
}

function isLayerEffectivelyAudible(
  layer: ActiveSoundLayer,
  allLayers: ActiveSoundLayer[],
  isMutedAll: boolean,
  isPlaying: boolean
): boolean {
  if (!isPlaying || isMutedAll || layer.isMuted) return false;
  const anySoloed = allLayers.some((l) => l.isSoloed);
  if (anySoloed && !layer.isSoloed) return false;
  return true;
}

function syncAllLayerGainsWithEngine(
  layers: ActiveSoundLayer[],
  isMutedAll: boolean,
  isPlaying: boolean
) {
  for (const layer of layers) {
    const audible = isLayerEffectivelyAudible(layer, layers, isMutedAll, isPlaying);
    audioEngine.updateLayerGain(layer.id, audible ? layer.volume : 0);
  }
}

export const useAudioStore = create<AudioStoreState>((set, get) => {
  audioEngine.setTelemetryListener((telemetry) => {
    set({ transientTelemetry: telemetry });
  });

  audioEngine.setLoadingStateListener((soundId, isLoading) => {
    set((s) => ({
      loadingSoundIds: {
        ...s.loadingSoundIds,
        [soundId]: isLoading,
      },
    }));
  });

  audioEngine.setSleepTimerListeners(
    (remainingSec) => {
      set({ sleepTimerRemainingSec: remainingSec });
    },
    () => {
      const current = get();
      audioEngine.suspendContext();
      audioEngine.setMasterVolume(current.masterVolume, current.isMutedAll);
      set({
        isPlaying: false,
        sleepTimerRemainingSec: null,
        sleepTimerTotalSec: null,
      });
    }
  );

  return {
    soundLibrary: BUILTIN_SOUND_LIBRARY,
    presets: DEFAULT_STARTER_PRESETS,
    activePresetId: DEFAULT_STARTER_PRESETS[0].id,

    activeLayers: DEFAULT_STARTER_PRESETS[0].layers,
    loadingSoundIds: {},
    masterVolume: 0.85,
    isPlaying: false,
    isMutedAll: false,

    sleepTimerRemainingSec: null,
    sleepTimerTotalSec: null,

    systemPrefersReducedMotion:
      typeof window !== 'undefined'
        ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
        : false,
    reducedMotionOverride: null,

    transientTelemetry: {
      rmsLeft: 0,
      rmsRight: 0,
      peak: 0,
      audioClockTime: 0,
      workletActive: true,
    },

    isHydrated: false,
    uploadError: null,
    isUploading: false,

    hydrateFromIndexedDB: async () => {
      try {
        const [savedSession, savedPresets, customBlobs] = await Promise.all([
          loadSessionStateFromDB(),
          getAllPresetsFromDB(),
          getAllCustomSoundBlobsFromDB(),
        ]);

        const customLibraryItems: SoundLibraryItem[] = customBlobs.map((rec) => ({
          id: rec.id,
          name: rec.name,
          category: 'Custom',
          description: `Uploaded custom audio (${(rec.blob.size / 1024).toFixed(0)} KB)`,
          audioUrl: '',
          iconName: 'Music',
          isCustom: true,
          accentColor: '#F43F5E',
        }));

        const fullLibrary = [...BUILTIN_SOUND_LIBRARY, ...customLibraryItems];
        const validIds = new Set(fullLibrary.map((i) => i.id));

        let mergedPresets = savedPresets;
        if (savedPresets.length === 0) {
          await Promise.all(DEFAULT_STARTER_PRESETS.map((p) => savePresetToDB(p)));
          mergedPresets = DEFAULT_STARTER_PRESETS;
        }

        const validSessionLayers =
          savedSession?.activeLayers?.filter((l) => validIds.has(l.id) && l.audioUrl !== undefined) ??
          [];

        const nextLayers =
          validSessionLayers.length > 0
            ? validSessionLayers
            : DEFAULT_STARTER_PRESETS[0].layers;

        set({
          soundLibrary: fullLibrary,
          presets: mergedPresets,
          activeLayers: nextLayers,
          masterVolume: savedSession ? savedSession.masterVolume : 0.85,
          isMutedAll: savedSession ? savedSession.isMutedAll : false,
          reducedMotionOverride: savedSession?.reducedMotionOverride ?? null,
          isHydrated: true,
        });
      } catch (err) {
        console.warn('Hydration fallback:', err);
        set({ isHydrated: true });
      }
    },

    toggleGlobalPlayPause: async () => {
      const state = get();
      const nextPlaying = !state.isPlaying;

      if (nextPlaying) {
        await audioEngine.ensureContextResumed();
        audioEngine.setMasterVolume(state.masterVolume, state.isMutedAll);
        set({ isPlaying: true });

        await Promise.all(
          state.activeLayers.map((layer) => {
            const audible = isLayerEffectivelyAudible(
              layer,
              state.activeLayers,
              state.isMutedAll,
              true
            );
            return audioEngine.startOrUpdateLayer(layer, audible);
          })
        );
      } else {
        syncAllLayerGainsWithEngine(state.activeLayers, state.isMutedAll, false);
        window.setTimeout(() => {
          if (!get().isPlaying) {
            audioEngine.suspendContext();
          }
        }, 90);
        set({ isPlaying: false });
      }
    },

    pauseAudio: async () => {
      const state = get();
      if (!state.isPlaying) return;
      syncAllLayerGainsWithEngine(state.activeLayers, state.isMutedAll, false);
      window.setTimeout(() => {
        if (!get().isPlaying) {
          audioEngine.suspendContext();
        }
      }, 90);
      set({ isPlaying: false });
    },

    toggleMuteAll: async () => {
      const state = get();
      const nextMutedAll = !state.isMutedAll;
      audioEngine.setMasterVolume(state.masterVolume, nextMutedAll);
      syncAllLayerGainsWithEngine(state.activeLayers, nextMutedAll, state.isPlaying);
      set({ isMutedAll: nextMutedAll });
      scheduleSessionPersist(get());
    },

    setMasterVolume: (volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      const state = get();
      audioEngine.setMasterVolume(clamped, state.isMutedAll);
      set({ masterVolume: clamped, isMutedAll: clamped === 0 ? true : false });
      scheduleSessionPersist(get());
    },

    addOrToggleSoundLayer: async (item: SoundLibraryItem) => {
      const state = get();
      const exists = state.activeLayers.find((l) => l.id === item.id);

      if (exists) {
        get().removeSoundLayer(item.id);
        return;
      }

      const newLayer: ActiveSoundLayer = {
        id: item.id,
        name: item.name,
        category: item.category,
        audioUrl: item.audioUrl,
        iconName: item.iconName,
        volume: 0.6,
        pan: 0,
        isMuted: false,
        isSoloed: false,
        filter: {
          type: 'lowpass',
          frequency: 16000,
          q: 0.7,
        },
        isCustom: item.isCustom,
        accentColor: item.accentColor,
      };

      const nextLayers = [...state.activeLayers, newLayer];
      const shouldStartPlayback = !state.isPlaying;

      if (shouldStartPlayback) {
        await audioEngine.ensureContextResumed();
        audioEngine.setMasterVolume(state.masterVolume, state.isMutedAll);
      }

      set({
        activeLayers: nextLayers,
        isPlaying: true,
        activePresetId: null,
      });

      if (shouldStartPlayback) {
        await Promise.all(
          nextLayers.map((l) =>
            audioEngine.startOrUpdateLayer(
              l,
              isLayerEffectivelyAudible(l, nextLayers, state.isMutedAll, true)
            )
          )
        );
      } else {
        const audible = isLayerEffectivelyAudible(newLayer, nextLayers, state.isMutedAll, true);
        await audioEngine.startOrUpdateLayer(newLayer, audible);
      }

      scheduleSessionPersist(get());
    },

    setSoundVolumeFromLibrary: async (item: SoundLibraryItem, volume: number) => {
      const state = get();
      const exists = state.activeLayers.find((l) => l.id === item.id);
      if (exists) {
        if (volume <= 0.01) {
          get().removeSoundLayer(item.id);
        } else {
          get().setLayerVolume(item.id, volume);
        }
        return;
      }

      if (volume <= 0.01) return;

      const newLayer: ActiveSoundLayer = {
        id: item.id,
        name: item.name,
        category: item.category,
        audioUrl: item.audioUrl,
        iconName: item.iconName,
        volume: Math.max(0.05, Math.min(1, volume)),
        pan: 0,
        isMuted: false,
        isSoloed: false,
        filter: {
          type: 'lowpass',
          frequency: 16000,
          q: 0.7,
        },
        isCustom: item.isCustom,
        accentColor: item.accentColor,
      };

      const nextLayers = [...state.activeLayers, newLayer];
      const shouldStartPlayback = !state.isPlaying;

      if (shouldStartPlayback) {
        await audioEngine.ensureContextResumed();
        audioEngine.setMasterVolume(state.masterVolume, state.isMutedAll);
      }

      set({
        activeLayers: nextLayers,
        isPlaying: true,
        activePresetId: null,
      });

      if (shouldStartPlayback) {
        await Promise.all(
          nextLayers.map((l) =>
            audioEngine.startOrUpdateLayer(
              l,
              isLayerEffectivelyAudible(l, nextLayers, state.isMutedAll, true)
            )
          )
        );
      } else {
        const audible = isLayerEffectivelyAudible(newLayer, nextLayers, state.isMutedAll, true);
        await audioEngine.startOrUpdateLayer(newLayer, audible);
      }

      scheduleSessionPersist(get());
    },

    removeSoundLayer: (layerId: string) => {
      const state = get();
      audioEngine.removeLayer(layerId);
      const nextLayers = state.activeLayers.filter((l) => l.id !== layerId);
      syncAllLayerGainsWithEngine(nextLayers, state.isMutedAll, state.isPlaying);
      set({
        activeLayers: nextLayers,
        activePresetId: null,
      });
      scheduleSessionPersist(get());
    },

    clearAllLayers: () => {
      audioEngine.clearAllLayers();
      set({
        activeLayers: [],
        activePresetId: null,
        isPlaying: false,
      });
      scheduleSessionPersist(get());
    },

    randomizeMix: async () => {
      const state = get();
      await audioEngine.ensureContextResumed();

      // Pick 3 random complementary sounds from the library
      const pool = [...state.soundLibrary];
      const picked: SoundLibraryItem[] = [];
      while (picked.length < 3 && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
      }

      const nextIds = new Set(picked.map((p) => p.id));
      for (const old of state.activeLayers) {
        if (!nextIds.has(old.id)) {
          audioEngine.removeLayer(old.id);
        }
      }

      const randomLayers: ActiveSoundLayer[] = picked.map((item, i) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        audioUrl: item.audioUrl,
        iconName: item.iconName,
        volume: Number((0.4 + Math.random() * 0.35).toFixed(2)),
        pan: i === 0 ? -0.15 : i === 1 ? 0.15 : 0,
        isMuted: false,
        isSoloed: false,
        filter: { type: 'lowpass', frequency: 16000, q: 0.7 },
        isCustom: item.isCustom,
        accentColor: item.accentColor,
      }));

      audioEngine.setMasterVolume(state.masterVolume, state.isMutedAll);
      set({
        activeLayers: randomLayers,
        activePresetId: null,
        isPlaying: true,
      });

      await Promise.all(
        randomLayers.map((l) =>
          audioEngine.startOrUpdateLayer(l, !state.isMutedAll)
        )
      );
      scheduleSessionPersist(get());
    },

    setLayerVolume: (layerId: string, volume: number) => {
      const clamped = Math.max(0, Math.min(1, volume));
      const state = get();
      const nextLayers = state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, volume: clamped, isMuted: clamped === 0 ? true : false } : l
      );
      const updatedLayer = nextLayers.find((l) => l.id === layerId);
      if (updatedLayer) {
        const audible = isLayerEffectivelyAudible(
          updatedLayer,
          nextLayers,
          state.isMutedAll,
          state.isPlaying
        );
        audioEngine.updateLayerGain(layerId, audible ? updatedLayer.volume : 0);
      }
      set({ activeLayers: nextLayers, activePresetId: null });
      scheduleSessionPersist(get());
    },

    setLayerPan: (layerId: string, pan: number) => {
      const clamped = Math.max(-1, Math.min(1, Number(pan.toFixed(2))));
      const state = get();
      const nextLayers = state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, pan: clamped } : l
      );
      audioEngine.updateLayerPan(layerId, clamped);
      set({ activeLayers: nextLayers, activePresetId: null });
      scheduleSessionPersist(get());
    },

    toggleLayerMute: (layerId: string) => {
      const state = get();
      const nextLayers = state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, isMuted: !l.isMuted } : l
      );
      syncAllLayerGainsWithEngine(nextLayers, state.isMutedAll, state.isPlaying);
      set({ activeLayers: nextLayers, activePresetId: null });
      scheduleSessionPersist(get());
    },

    toggleLayerSolo: (layerId: string) => {
      const state = get();
      const nextLayers = state.activeLayers.map((l) =>
        l.id === layerId ? { ...l, isSoloed: !l.isSoloed } : l
      );
      syncAllLayerGainsWithEngine(nextLayers, state.isMutedAll, state.isPlaying);
      set({ activeLayers: nextLayers, activePresetId: null });
      scheduleSessionPersist(get());
    },

    updateLayerFilter: (layerId: string, filterUpdate: Partial<FilterConfig>) => {
      const state = get();
      const nextLayers = state.activeLayers.map((l) =>
        l.id === layerId
          ? { ...l, filter: { ...l.filter, ...filterUpdate } }
          : l
      );
      const target = nextLayers.find((l) => l.id === layerId);
      if (target) {
        audioEngine.updateLayerFilter(layerId, target.filter);
      }
      set({ activeLayers: nextLayers, activePresetId: null });
      scheduleSessionPersist(get());
    },

    saveCurrentAsPreset: async (name: string, description: string) => {
      const state = get();
      const trimmedName = name.trim();
      if (!trimmedName) return;

      const newPreset: SavedPreset = {
        id: `preset-${Date.now()}`,
        name: trimmedName,
        description:
          description.trim() ||
          `${state.activeLayers.length} ambient layers blended.`,
        createdAt: Date.now(),
        masterVolume: state.masterVolume,
        layers: JSON.parse(JSON.stringify(state.activeLayers)),
      };

      await savePresetToDB(newPreset);
      const updatedPresets = [newPreset, ...state.presets];
      set({
        presets: updatedPresets,
        activePresetId: newPreset.id,
      });
    },

    loadPreset: async (preset: SavedPreset) => {
      const state = get();
      await audioEngine.ensureContextResumed();

      const presetLayerIds = new Set(preset.layers.map((l) => l.id));
      for (const oldLayer of state.activeLayers) {
        if (!presetLayerIds.has(oldLayer.id)) {
          audioEngine.removeLayer(oldLayer.id);
        }
      }

      const clonedLayers: ActiveSoundLayer[] = JSON.parse(JSON.stringify(preset.layers));
      audioEngine.setMasterVolume(preset.masterVolume, state.isMutedAll);

      set({
        activeLayers: clonedLayers,
        masterVolume: preset.masterVolume,
        activePresetId: preset.id,
        isPlaying: true,
      });

      await Promise.all(
        clonedLayers.map((layer) => {
          const audible = isLayerEffectivelyAudible(
            layer,
            clonedLayers,
            state.isMutedAll,
            true
          );
          return audioEngine.startOrUpdateLayer(layer, audible);
        })
      );

      scheduleSessionPersist(get());
    },

    deletePreset: async (presetId: string) => {
      await deletePresetFromDB(presetId);
      const state = get();
      set({
        presets: state.presets.filter((p) => p.id !== presetId),
        activePresetId: state.activePresetId === presetId ? null : state.activePresetId,
      });
    },

    uploadCustomSound: async (file: File) => {
      set({ isUploading: true, uploadError: null });
      try {
        await audioEngine.ensureContextResumed();
        const customId = `custom-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_-]/g, '')}`;
        const cleanName = file.name.replace(/\.[^/.]+$/, '');

        await audioEngine.decodeSoundFromBlob(customId, file);

        await saveCustomSoundBlobToDB({
          id: customId,
          name: cleanName,
          mimeType: file.type || 'audio/wav',
          blob: file,
          createdAt: Date.now(),
        });

        const newItem: SoundLibraryItem = {
          id: customId,
          name: cleanName,
          category: 'Custom',
          description: `Uploaded custom audio (${(file.size / 1024).toFixed(0)} KB)`,
          audioUrl: '',
          iconName: 'Music',
          isCustom: true,
          accentColor: '#F43F5E',
        };

        set((s) => ({
          soundLibrary: [newItem, ...s.soundLibrary],
          isUploading: false,
        }));

        await get().addOrToggleSoundLayer(newItem);
      } catch (err) {
        const message =
          err instanceof Error
            ? `Could not decode audio file "${file.name}". Please upload a valid .wav, .mp3, or .ogg file.`
            : 'Audio upload failed.';
        set({ uploadError: message, isUploading: false });
      }
    },

    deleteCustomSound: async (soundId: string) => {
      get().removeSoundLayer(soundId);
      await deleteCustomSoundBlobFromDB(soundId);
      set((s) => ({
        soundLibrary: s.soundLibrary.filter((item) => item.id !== soundId),
      }));
    },

    startSleepTimer: async (minutes: number) => {
      const state = get();
      if (!state.isPlaying) {
        await get().toggleGlobalPlayPause();
      } else {
        await audioEngine.ensureContextResumed();
      }
      const totalSec = minutes * 60;
      set({
        sleepTimerRemainingSec: totalSec,
        sleepTimerTotalSec: totalSec,
      });
      audioEngine.startSleepTimer(minutes, get().masterVolume, get().isMutedAll);
    },

    cancelSleepTimer: () => {
      audioEngine.cancelSleepTimer();
      const state = get();
      audioEngine.setMasterVolume(state.masterVolume, state.isMutedAll);
      set({
        sleepTimerRemainingSec: null,
        sleepTimerTotalSec: null,
      });
    },

    setSystemPrefersReducedMotion: (matches: boolean) => {
      set({ systemPrefersReducedMotion: matches });
    },

    setReducedMotionOverride: (override: boolean | null) => {
      set({ reducedMotionOverride: override });
      scheduleSessionPersist(get());
    },

    clearUploadError: () => set({ uploadError: null }),
  };
});

export function usePrefersReducedMotion(): boolean {
  const systemPref = useAudioStore((s) => s.systemPrefersReducedMotion);
  const override = useAudioStore((s) => s.reducedMotionOverride);
  return override !== null ? override : systemPref;
}
