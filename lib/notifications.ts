'use client';

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

export async function sendLocalNotification(
  title: string,
  options: NotificationOptions & { url?: string } = {}
) {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;

  const defaultOptions: NotificationOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    ...options,
    data: {
      url: options.url || '/messages',
      ...(options.data || {}),
    },
  };

  try {
    // Essayer d'utiliser le Service Worker en priorité (indispensable sur mobile Android / PWA)
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(title, defaultOptions);
        return;
      }
    }

    // Fallback standard pour navigateur de bureau
    new Notification(title, defaultOptions);
  } catch (err) {
    console.warn('Impossible dafficher la notification:', err);
  }
}
