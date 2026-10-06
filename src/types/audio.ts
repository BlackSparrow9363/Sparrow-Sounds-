export type SoundCategory =
  | 'Rain & Storm'
  | 'Nature'
  | 'Animals & Birds'
  | 'City & Places'
  | 'Transport'
  | 'Objects & Focus'
  | 'Custom';

export interface FilterConfig {
  type: BiquadFilterType; // 'lowpass' | 'highpass'
  frequency: number; // 400 to 20000 Hz
  q: number;
}

export interface SoundLibraryItem {
  id: string;
  name: string;
  category: SoundCategory;
  description: string;
  audioUrl: string;
  iconName: string;
  isCustom?: boolean;
  accentColor: string;
}

export interface ActiveSoundLayer {
  id: string; // matches SoundLibraryItem.id
  name: string;
  category: SoundCategory;
  audioUrl: string;
  iconName: string;
  volume: number; // 0.0 to 1.0
  pan: number; // -1.0 (Left) to +1.0 (Right)
  isMuted: boolean;
  isSoloed: boolean;
  filter: FilterConfig;
  isCustom?: boolean;
  accentColor: string;
}

export interface SavedPreset {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  masterVolume: number;
  layers: ActiveSoundLayer[];
}

export interface CustomSoundBlobRecord {
  id: string;
  name: string;
  mimeType: string;
  blob: Blob;
  createdAt: number;
}

export interface PersistedAppState {
  id: 'current_session_v2';
  masterVolume: number;
  isMutedAll: boolean;
  activeLayers: ActiveSoundLayer[];
  reducedMotionOverride: boolean | null;
  updatedAt: number;
}

export interface TransientAudioTelemetry {
  rmsLeft: number;
  rmsRight: number;
  peak: number;
  audioClockTime: number;
  workletActive: boolean;
}
