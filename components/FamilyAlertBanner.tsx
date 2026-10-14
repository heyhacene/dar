'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, FamilyAlert } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import {
  AlertTriangle,
  Info,
  Flame,
  X,
  Clock,
  Trash2,
  Megaphone,
  Check,
  Repeat,
  Calendar,
} from 'lucide-react';

const DURATION_OPTIONS = [
  { label: '30 minutes', minutes: 30 },
  { label: '1 heure', minutes: 60 },
  { label: '3 heures', minutes: 180 },
  { label: 'Ce soir (23h59)', minutes: 'tonight' },
  { label: '24 heures (1 jour)', minutes: 1440 },
  { label: '2 jours', minutes: 2880 },
  { label: '1 semaine', minutes: 10080 },
];

const DAYS_OF_WEEK = [
  { day: 1, label: 'Lun', full: 'Lundi' },
  { day: 2, label: 'Mar', full: 'Mardi' },
  { day: 3, label: 'Mer', full: 'Mercredi' },
  { day: 4, label: 'Jeu', full: 'Jeudi' },
  { day: 5, label: 'Ven', full: 'Vendredi' },
  { day: 6, label: 'Sam', full: 'Samedi' },
  { day: 0, label: 'Dim', full: 'Dimanche' },
];

/**
 * Détermine si une alerte (ponctuelle ou récurrente) est active à cet instant précis
 */
export function isAlertActiveNow(a: FamilyAlert): boolean {
  if (!a.is_active) return false;
  const now = new Date();

  if (a.is_recurring) {
    // 1. Vérifier le jour de la semaine
    if (Array.isArray(a.recurrence_days) && a.recurrence_days.length > 0) {
      if (!a.recurrence_days.includes(now.getDay())) {
        return false;
      }
    }

    // 2. Vérifier la plage horaire si définie
    if (a.time_start && a.time_end) {
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = a.time_start.split(':').map(Number);
      const [eh, em] = a.time_end.split(':').map(Number);
      const startMinutes = (sh || 0) * 60 + (sm || 0);
      const endMinutes = (eh || 0) * 60 + (em || 0);

      if (startMinutes <= endMinutes) {
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
          return false;
        }
      } else {
        // Plage chevauchant minuit (ex: 22h00 -> 02h00)
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) {
          return false;
        }
      }
    }

    return true;
  }

  // Alerte ponctuelle : date d'expiration supérieure à maintenant
  return new Date(a.expires_at).getTime() > now.getTime();
}

export default function FamilyAlertBanner() {
  const { user, profile, isAdmin } = useAuth();
  const [alerts, setAlerts] = useState<FamilyAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Formulaire d'alerte
  const [alertTypeMode, setAlertTypeMode] = useState<'temporary' | 'recurring'>('temporary');
  const [message, setMessage] = useState('');
  const [level, setLevel] = useState<'info' | 'warning' | 'urgent'>('warning');
  const [selectedDuration, setSelectedDuration] = useState<number | string>(60);

  // Champs de récurrence (ex: poubelle tous les mardis de 18h à 21h)
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>([2]); // Mardi par défaut
  const [timeStart, setTimeStart] = useState('18:00');
  const [timeEnd, setTimeEnd] = useState('21:00');

  const [submitting, setSubmitting] = useState(false);

  // Charger les alertes actives
  async function fetchActiveAlerts() {
    if (!isSupabaseConfigured()) return;
    try {
      const { data, error } = await supabase
        .from('family_alerts')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Filtrer les alertes qui sont actives à l'instant présent
        const activeNow = (data as FamilyAlert[]).filter(isAlertActiveNow);
        setAlerts(activeNow);
      }
    } catch (err) {
      console.warn('Erreur chargement alertes familiales:', err);
    }
  }

  useEffect(() => {
    fetchActiveAlerts();

    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('family_alerts_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'family_alerts' },
          () => {
            fetchActiveAlerts();
          }
        )
        .subscribe();

      // Vérifier toutes les 30 secondes pour mettre à jour les plages horaires et expirations
      const interval = setInterval(fetchActiveAlerts, 30000);

      return () => {
        supabase.removeChannel(channel);
        clearInterval(interval);
      };
    }
  }, []);

  // Création d'une alerte
  async function handleCreateAlert(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim() || !user) return;
    setSubmitting(true);

    try {
      let expiresAt: Date;
      const isRecurring = alertTypeMode === 'recurring';

      if (isRecurring) {
        // Pour les alertes récurrentes, expiration lointaine (2 ans)
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 2);
      } else if (selectedDuration === 'tonight') {
        expiresAt = new Date();
        expiresAt.setHours(23, 59, 59, 999);
      } else {
        const mins = typeof selectedDuration === 'number' ? selectedDuration : 60;
        expiresAt = new Date(Date.now() + mins * 60 * 1000);
      }

      const alertPayload: Partial<FamilyAlert> = {
        message: message.trim(),
        level,
        author_name: profile?.full_name || 'Un membre de la famille',
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        is_active: true,
        is_recurring: isRecurring,
        recurrence_days: isRecurring ? recurrenceDays : [],
        time_start: isRecurring ? timeStart : undefined,
        time_end: isRecurring ? timeEnd : undefined,
      };

      const { error } = await supabase.from('family_alerts').insert(alertPayload);

      if (error) throw error;

      setMessage('');
      setShowCreateModal(false);
      fetchActiveAlerts();
    } catch (err: any) {
      console.error('Erreur création alerte:', err);
      alert('Impossible de publier l’alerte : ' + (err?.message || 'Erreur inconnue'));
    } finally {
      setSubmitting(false);
    }
  }

  // Désactiver l'alerte pour toute la famille
  async function handleDismissForFamily(alertId: string) {
    if (!confirm('Supprimer cette alerte pour toute la famille ?')) return;
    try {
      await supabase
        .from('family_alerts')
        .update({ is_active: false })
        .eq('id', alertId);

      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error(err);
    }
  }

  // Masquer temporairement pour cette session locale
  function handleDismissLocally(alertId: string) {
    setDismissedIds((prev) => [...prev, alertId]);
  }

  // Formatage du libellé de récurrence ou temps restant
  function formatAlertSchedule(alt: FamilyAlert) {
    if (alt.is_recurring) {
      const days = alt.recurrence_days || [];
      let dayStr = '';
      if (days.length === 7) {
        dayStr = 'Tous les jours';
      } else if (days.length === 5 && !days.includes(0) && !days.includes(6)) {
        dayStr = 'En semaine';
      } else if (days.length === 2 && days.includes(0) && days.includes(6)) {
        dayStr = 'Le week-end';
      } else if (days.length > 0) {
        const mapDays: Record<number, string> = {
          1: 'mardis',
          2: 'mardis',
          3: 'mercredis',
          4: 'jeudis',
          5: 'vendredis',
          6: 'samedis',
          0: 'dimanches',
        };
        dayStr = 'Tous les ' + days.map((d) => mapDays[d] || 'jours').join(', ');
      } else {
        dayStr = 'Récurrent';
      }

      if (alt.time_start && alt.time_end) {
        return `🔁 ${dayStr} • ${alt.time_start} à ${alt.time_end}`;
      }
      return `🔁 ${dayStr}`;
    }

    // Formatage classique du temps restant
    const diffMs = new Date(alt.expires_at).getTime() - Date.now();
    if (diffMs <= 0) return 'Expiré';
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `dans ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    const remainingMins = diffMins % 60;
    if (diffHours < 24) {
      return remainingMins > 0 ? `dans ${diffHours}h${remainingMins}` : `dans ${diffHours}h`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `dans ${diffDays}j`;
  }

  function toggleDay(dayNum: number) {
    setRecurrenceDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum]
    );
  }

  // Filtrer les alertes non masquées localement
  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  return (
    <>
      {/* BANNIÈRES D'ALERTES EN HAUT DE L'ÉCRAN */}
      {visibleAlerts.length > 0 && (
        <div className="sticky top-0 z-40 space-y-1 shadow-md">
          {visibleAlerts.map((alt) => {
            const isUrgent = alt.level === 'urgent';
            const isWarning = alt.level === 'warning';
            const canManage = isAdmin || alt.created_by === user?.id;

            return (
              <div
                key={alt.id}
                className={`px-4 py-2.5 text-white flex items-center justify-between gap-3 text-xs transition animate-in slide-in-from-top ${
                  isUrgent
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700'
                    : isWarning
                    ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600'
                    : 'bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-1 rounded-lg bg-white/20 flex-shrink-0">
                    {isUrgent ? (
                      <Flame className="w-4 h-4 text-white animate-bounce" />
                    ) : isWarning ? (
                      <AlertTriangle className="w-4 h-4 text-white" />
                    ) : (
                      <Megaphone className="w-4 h-4 text-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-black uppercase tracking-wider text-[9px] px-1.5 py-0.2 rounded-md bg-white/30 text-white">
                        {isUrgent ? 'URGENT' : isWarning ? 'ATTENTION' : 'MESSAGE FAMILLE'}
                      </span>
                      {alt.author_name && (
                        <span className="text-[10px] text-white/80 font-medium">
                          • {alt.author_name}
                        </span>
                      )}
                      <span className="text-[10px] text-white/90 font-semibold flex items-center gap-1 bg-black/15 px-1.5 py-0.2 rounded-md">
                        {alt.is_recurring ? (
                          <Repeat className="w-3 h-3 inline" />
                        ) : (
                          <Clock className="w-3 h-3 inline" />
                        )}
                        {formatAlertSchedule(alt)}
                      </span>
                    </div>
                    <p className="font-bold text-xs sm:text-sm text-white leading-tight mt-0.5 break-words">
                      {alt.message}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {canManage && (
                    <button
                      onClick={() => handleDismissForFamily(alt.id)}
                      title="Supprimer pour toute la famille"
                      className="p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white/90 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDismissLocally(alt.id)}
                    title="Masquer sur cet écran"
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BOUTON FLOTTANT DISCRET POUR CRÉER UNE ALERTE */}
      {user && (
        <div className="fixed right-3 bottom-20 z-30">
          <button
            onClick={() => setShowCreateModal(true)}
            title="Publier une alerte familiale"
            className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition flex items-center justify-center border-2 border-white dark:border-slate-800"
          >
            <Megaphone className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL CRÉATION D'ALERTE */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-sm w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0 bg-white dark:bg-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white">Alerte Familiale</h3>
                  <p className="text-[10px] text-gray-400">S'affiche en haut de tous les écrans</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAlert} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 space-y-4 overflow-y-auto flex-1">
                {/* SÉLECTEUR TYPE : PONCTUELLE VS RÉCURRENTE */}
                <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-slate-700/70 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAlertTypeMode('temporary')}
                    className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      alertTypeMode === 'temporary'
                        ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-xs'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Ponctuelle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlertTypeMode('recurring')}
                    className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                      alertTypeMode === 'recurring'
                        ? 'bg-white dark:bg-slate-800 text-primary-600 dark:text-primary-400 shadow-xs'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Repeat className="w-3.5 h-3.5" />
                    <span>Récurrente</span>
                  </button>
                </div>

                {/* MESSAGE */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Message de l'alerte
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      alertTypeMode === 'recurring'
                        ? 'Ex: Sortir la poubelle jaune !'
                        : "Ex: Couper l'eau à 14h, Grand-mère arrive..."
                    }
                    className="w-full p-2.5 text-xs bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none dark:text-white"
                  />
                </div>

                {/* NIVEAU D'URGENCE */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                    Niveau d'importance
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setLevel('info')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition flex flex-col items-center gap-1 ${
                        level === 'info'
                          ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 ring-1 ring-sky-500'
                          : 'border-gray-100 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Info className="w-4 h-4 text-sky-500" />
                      <span>Info</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLevel('warning')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition flex flex-col items-center gap-1 ${
                        level === 'warning'
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500'
                          : 'border-gray-100 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <span>Attention</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLevel('urgent')}
                      className={`p-2 rounded-xl text-center border text-[11px] font-bold transition flex flex-col items-center gap-1 ${
                        level === 'urgent'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 ring-1 ring-red-500'
                          : 'border-gray-100 dark:border-slate-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-red-500" />
                      <span>Urgent</span>
                    </button>
                  </div>
                </div>

                {/* SI RÉCURRENTE : SÉLECTION DES JOURS ET HEURES */}
                {alertTypeMode === 'recurring' ? (
                  <div className="space-y-3 p-3 bg-orange-50/60 dark:bg-primary-950/30 rounded-2xl border border-orange-100 dark:border-primary-900">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-primary-600" />
                        <span>Jours de récurrence</span>
                      </label>
                      <div className="grid grid-cols-7 gap-1">
                        {DAYS_OF_WEEK.map(({ day, label }) => {
                          const isSelected = recurrenceDays.includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleDay(day)}
                              className={`py-2 rounded-xl text-xs font-bold transition flex items-center justify-center ${
                                isSelected
                                  ? 'bg-primary-600 text-white shadow-xs'
                                  : 'bg-white dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                          Heure de début :
                        </label>
                        <input
                          type="time"
                          value={timeStart}
                          onChange={(e) => setTimeStart(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-bold text-gray-800 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">
                          Heure de fin :
                        </label>
                        <input
                          type="time"
                          value={timeEnd}
                          onChange={(e) => setTimeEnd(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl text-xs font-bold text-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">
                      L'alerte apparaîtra automatiquement chaque semaine pendant cette plage horaire.
                    </p>
                  </div>
                ) : (
                  /* SI PONCTUELLE : SÉLECTION DE LA DURÉE */
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-primary-600" />
                      <span>Durée de visibilité</span>
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => setSelectedDuration(opt.minutes)}
                          className={`p-2 rounded-xl text-left border text-[11px] font-bold transition flex items-center justify-between ${
                            selectedDuration === opt.minutes
                              ? 'border-primary-500 bg-orange-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300'
                              : 'border-gray-100 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {selectedDuration === opt.minutes && (
                            <Check className="w-3.5 h-3.5 text-primary-600" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER ÉPINGLÉ */}
              <div className="p-3.5 bg-gray-50 dark:bg-slate-750 border-t border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !message.trim() ||
                    (alertTypeMode === 'recurring' && recurrenceDays.length === 0)
                  }
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md transition disabled:opacity-40"
                >
                  {submitting
                    ? 'Diffusion...'
                    : alertTypeMode === 'recurring'
                    ? 'Activer la récurrence'
                    : 'Diffuser l’alerte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
