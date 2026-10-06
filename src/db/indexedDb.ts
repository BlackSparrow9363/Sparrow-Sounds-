import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  PersistedAppState,
  SavedPreset,
  CustomSoundBlobRecord,
} from '../types/audio';

interface SparrowSoundsDB extends DBSchema {
  app_state_v2: {
    key: string;
    value: PersistedAppState;
  };
  presets_v2: {
    key: string;
    value: SavedPreset;
    indexes: { 'by-created': number };
  };
  custom_sounds: {
    key: string;
    value: CustomSoundBlobRecord;
  };
}

const DB_NAME = 'sparrow_sounds_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<SparrowSoundsDB>> | null = null;

function getDB(): Promise<IDBPDatabase<SparrowSoundsDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SparrowSoundsDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('app_state_v2')) {
          db.createObjectStore('app_state_v2', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('presets_v2')) {
          const presetStore = db.createObjectStore('presets_v2', { keyPath: 'id' });
          presetStore.createIndex('by-created', 'createdAt');
        }
        if (!db.objectStoreNames.contains('custom_sounds')) {
          db.createObjectStore('custom_sounds', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveSessionStateToDB(
  state: Omit<PersistedAppState, 'id' | 'updatedAt'>
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('app_state_v2', {
      ...state,
      id: 'current_session_v2',
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn('IndexedDB session save failed:', err);
  }
}

export async function loadSessionStateFromDB(): Promise<PersistedAppState | undefined> {
  try {
    const db = await getDB();
    return await db.get('app_state_v2', 'current_session_v2');
  } catch (err) {
    console.warn('IndexedDB session load failed:', err);
    return undefined;
  }
}

export async function savePresetToDB(preset: SavedPreset): Promise<void> {
  const db = await getDB();
  await db.put('presets_v2', preset);
}

export async function getAllPresetsFromDB(): Promise<SavedPreset[]> {
  try {
    const db = await getDB();
    const list = await db.getAllFromIndex('presets_v2', 'by-created');
    return list.reverse();
  } catch (err) {
    console.warn('IndexedDB load presets failed:', err);
    return [];
  }
}

export async function deletePresetFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('presets_v2', id);
}

export async function saveCustomSoundBlobToDB(record: CustomSoundBlobRecord): Promise<void> {
  const db = await getDB();
  await db.put('custom_sounds', record);
}

export async function getCustomSoundBlobFromDB(
  id: string
): Promise<CustomSoundBlobRecord | undefined> {
  try {
    const db = await getDB();
    return await db.get('custom_sounds', id);
  } catch (err) {
    console.warn('IndexedDB get custom sound failed:', err);
    return undefined;
  }
}

export async function getAllCustomSoundBlobsFromDB(): Promise<CustomSoundBlobRecord[]> {
  try {
    const db = await getDB();
    return await db.getAll('custom_sounds');
  } catch (err) {
    console.warn('IndexedDB get all custom sounds failed:', err);
    return [];
  }
}

export async function deleteCustomSoundBlobFromDB(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('custom_sounds', id);
}
