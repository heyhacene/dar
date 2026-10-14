'use client';

export type NotificationSoundType = 'chime' | 'bell' | 'pop' | 'harp';

export interface NotificationSoundOption {
  id: NotificationSoundType;
  name: string;
  description: string;
}

export const NOTIFICATION_SOUNDS: NotificationSoundOption[] = [
  { id: 'chime', name: 'Carillon doux', description: 'Mélodie chaleureuse à 3 tons' },
  { id: 'bell', name: 'Clochette cristalline', description: 'Tintement doux et net' },
  { id: 'pop', name: 'Pop moderne', description: 'Son de bulle dynamique' },
  { id: 'harp', name: 'Arpège zen', description: 'Cascade de 4 notes apaisantes' },
];

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.error('Erreur demande permission notifications:', err);
    return 'denied';
  }
}

export function getNotificationSoundPreference(): { enabled: boolean; sound: NotificationSoundType } {
  if (typeof window === 'undefined') {
    return { enabled: true, sound: 'chime' };
  }
  const enabledStr = localStorage.getItem('dar_notif_sound_enabled');
  const soundStr = (localStorage.getItem('dar_notif_sound_type') as NotificationSoundType) || 'chime';
  return {
    enabled: enabledStr !== 'false',
    sound: NOTIFICATION_SOUNDS.some((s) => s.id === soundStr) ? soundStr : 'chime',
  };
}

export function setNotificationSoundPreference(enabled: boolean, sound: NotificationSoundType) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('dar_notif_sound_enabled', enabled ? 'true' : 'false');
  localStorage.setItem('dar_notif_sound_type', sound);
}

/**
 * Joue la tonalité audio synthétisée choisie via Web Audio API (sans fichier externe, 100% hors-ligne)
 */
export function playNotificationSound(soundType?: NotificationSoundType) {
  if (typeof window === 'undefined') return;

  const pref = getNotificationSoundPreference();
  if (!pref.enabled && !soundType) return;

  const chosen = soundType || pref.sound;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (chosen === 'chime') {
      // 3 notes douces ascendantes (C5, E5, G5)
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.12);
        osc.stop(ctx.currentTime + idx * 0.12 + 0.4);
      });
    } else if (chosen === 'bell') {
      // Clochette avec harmonique
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.65);
      osc2.stop(ctx.currentTime + 0.65);
    } else if (chosen === 'pop') {
      // Pop moderne
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(850, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.16);
    } else if (chosen === 'harp') {
      // Cascade arpège 4 notes
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.075);
        gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.075);
        gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + idx * 0.075 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.075 + 0.38);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.075);
        osc.stop(ctx.currentTime + idx * 0.075 + 0.42);
      });
    }
  } catch (err) {
    console.warn('AudioContext playback error:', err);
  }
}

/**
 * Envoie une notification dans le volet du système (Android, Windows, etc.) et joue la sonnerie paramétrée
 */
export async function sendLocalNotification(
  title: string,
  options: NotificationOptions & { url?: string; sound?: boolean } = {}
) {
  // 1. Déclencher la sonnerie configurée si activée
  if (options.sound !== false) {
    playNotificationSound();
  }

  // Si pas de permission ou non supporté, s'arrêter après le son
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const defaultOptions: NotificationOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: options.tag || `dar-notif-${Date.now()}`,
    renotify: true,
    requireInteraction: false,
    ...options,
    data: {
      url: options.url || '/messages',
      ...(options.data || {}),
    },
  };

  try {
    // Service Worker showNotification : obligatoire pour le volet de notification sur mobile / PWA
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    }

    // Fallback navigateur classique
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn('Impossible d’afficher la notification dans le volet système:', err);
  }
}
