'use client';

import { useState, useEffect } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

const CURRENT_CLIENT_VERSION = '1.2.0';

export default function AppUpdateNotifier() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function checkVersion() {
    try {
      const res = await fetch(`/api/version?_t=${Date.now()}`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const storedVersion = localStorage.getItem('dar_app_version') || CURRENT_CLIENT_VERSION;
        // Si le serveur a une version différente ou plus récente
        if (data.version && data.version !== storedVersion) {
          setHasUpdate(true);
        }
      }
    } catch {
      // Ignorer si hors-ligne
    }
  }

  useEffect(() => {
    // Vérification initiale
    checkVersion();

    // Vérification quand l'application revient au premier plan
    const onFocus = () => checkVersion();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);

    // Vérification périodique toutes les 5 minutes
    const interval = setInterval(checkVersion, 5 * 60 * 1000);

    // Écoute des mises à jour du Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setHasUpdate(true);
              }
            });
          }
        });
      });
    }

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
      clearInterval(interval);
    };
  }, []);

  async function handleApplyUpdate() {
    setUpdating(true);
    try {
      // 1. Purger les caches de l'ancienne version
      if (typeof window !== 'undefined' && 'caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }

      // 2. Mettre à jour le Service Worker
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
        }
      }

      // 3. Mettre à jour le numéro de version local
      localStorage.setItem('dar_app_version', CURRENT_CLIENT_VERSION);
    } catch (e) {
      console.warn('Erreur purge cache:', e);
    }

    // 4. Recharger la page en forçant le contournement du cache navigateur
    window.location.reload();
  }

  if (!hasUpdate || dismissed) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 max-w-sm mx-auto bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white p-3 rounded-2xl shadow-2xl z-50 flex items-center justify-between gap-2.5 animate-in slide-in-from-bottom border border-orange-400/40 backdrop-blur-md">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="p-1.5 bg-white/20 rounded-xl flex-shrink-0">
          <Sparkles className="w-4 h-4 text-amber-200 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-xs leading-tight">Mise à jour disponible !</div>
          <div className="text-[10px] text-orange-100 truncate">
            Une nouvelle version de Dar est prête
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          type="button"
          onClick={handleApplyUpdate}
          disabled={updating}
          className="px-3 py-1.5 bg-white text-orange-600 hover:bg-orange-50 active:scale-95 text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1"
        >
          {updating ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <span>Mettre à jour</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-white/70 hover:text-white transition"
          title="Plus tard"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
