'use client';

import { AppData } from '@/types';
import { initialAppData } from './sampleData';

const STORAGE_KEY = 'famille_repas_data_v1';

export function loadLocalData(): AppData {
  if (typeof window === 'undefined') return initialAppData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveLocalData(initialAppData);
      return initialAppData;
    }
    const parsed = JSON.parse(raw);
    return {
      recipes: parsed.recipes || initialAppData.recipes,
      weeklyPlan: parsed.weeklyPlan || initialAppData.weeklyPlan,
      customShoppingItems: parsed.customShoppingItems || initialAppData.customShoppingItems,
      checkedItems: parsed.checkedItems || {},
      lastSync: parsed.lastSync,
    };
  } catch (err) {
    console.error('Erreur de lecture du stockage local', err);
    return initialAppData;
  }
}

export function saveLocalData(data: AppData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erreur de sauvegarde locale', err);
  }
}

export async function syncWithGoogle(currentData: AppData): Promise<AppData> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentData),
    });
    if (!res.ok) throw new Error('Échec de synchronisation');
    const result = await res.json();
    if (result.data) {
      saveLocalData(result.data);
      return result.data;
    }
  } catch (e) {
    console.warn('Sync cloud non configuré ou hors-ligne, données conservées localement');
  }
  return currentData;
}
