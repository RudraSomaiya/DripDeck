// Reads and writes the data folder through the Rust commands in src-tauri/src/main.rs.
// In a plain browser (`npm run dev`, handy for UI work) nothing is written: it all lives in memory until reload.
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { DEFAULT_TAGS, type Db } from './logic'

const tauri = '__TAURI_INTERNALS__' in window
let memDb = ''
const memPhotos = new Map<string, string>()
const fileName = (id: string) => `${id}.webp`

export async function loadDb(): Promise<Db> {
  const raw = tauri ? await invoke<string>('load_db') : memDb
  return { items: [], fits: [], tags: DEFAULT_TAGS, theme: 'old-money', font: 'editorial', ...(raw ? JSON.parse(raw) : {}) }
}

export async function saveDb(db: Db) {
  const json = JSON.stringify(db)
  if (tauri) await invoke('save_db', { json })
  else memDb = json
}

export async function savePhoto(id: string, photo: Blob) {
  if (tauri) await invoke('save_photo', new Uint8Array(await photo.arrayBuffer()), { headers: { name: fileName(id) } })
  else memPhotos.set(id, URL.createObjectURL(photo))
}

export async function deletePhoto(id: string) {
  if (tauri) await invoke('delete_photo', { name: fileName(id) })
  else memPhotos.delete(id)
}

export const photoUrl = (id: string) => (tauri ? convertFileSrc(fileName(id), 'photo') : (memPhotos.get(id) ?? ''))
export const dataFolder = () => (tauri ? invoke<string>('data_folder') : Promise.resolve(''))
export const openDataFolder = () => (tauri ? invoke('open_data_folder') : Promise.resolve())
