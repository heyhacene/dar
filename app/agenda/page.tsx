'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, FamilyEvent } from '@/lib/supabase';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Check,
  CalendarDays,
  CalendarRange,
  Sun,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

type CalendarViewMode = 'jour' | 'semaine' | 'mois' | 'annee';

const CATEGORIES = [
  { key: 'famille', label: 'Famille', color: 'bg-orange-500 text-white', dot: 'bg-orange-500' },
  { key: 'anniversaire', label: 'Anniversaire', color: 'bg-pink-500 text-white', dot: 'bg-pink-500' },
  { key: 'ecole', label: 'École & Enfants', color: 'bg-blue-500 text-white', dot: 'bg-blue-500' },
  { key: 'sante', label: 'Santé & RDV', color: 'bg-emerald-500 text-white', dot: 'bg-emerald-500' },
  { key: 'sortie', label: 'Sorties & Vacances', color: 'bg-purple-500 text-white', dot: 'bg-purple-500' },
  { key: 'general', label: 'Autre', color: 'bg-gray-500 text-white', dot: 'bg-gray-500' },
];

const WEEK_DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function getStartOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Lundi est le 1er jour
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toLocalDateString(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function AgendaPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Vue active (Jour / Semaine / Mois / Année)
  const [viewMode, setViewMode] = useState<CalendarViewMode>('mois');

  // Date de référence actuellement sélectionnée
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Modal d'ajout d'événement
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDateStr, setStartDateStr] = useState(toLocalDateString(new Date()));
  const [startTimeStr, setStartTimeStr] = useState('10:00');
  const [allDay, setAllDay] = useState(true);
  const [category, setCategory] = useState<FamilyEvent['category']>('famille');

  // Charger les événements
  async function loadEvents() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: true });

      if (!error && data) {
        setEvents(data as FamilyEvent[]);
      }
    } catch (err) {
      console.error('Erreur events:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();

    if (isSupabaseConfigured()) {
      const channel = supabase
        .channel('family_events_realtime')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events' },
          () => {
            loadEvents();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, []);

  // Ouvrir la modale d'ajout pour un jour donné
  function handleOpenAddModal(dateToPreset?: Date) {
    const target = dateToPreset || selectedDate;
    setStartDateStr(toLocalDateString(target));
    setTitle('');
    setDescription('');
    setAllDay(true);
    setCategory('famille');
    setShowAddModal(true);
  }

  // Ajouter un événement
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      const fullStartDate = allDay
        ? new Date(`${startDateStr}T00:00:00`).toISOString()
        : new Date(`${startDateStr}T${startTimeStr}:00`).toISOString();

      const catObj = CATEGORIES.find((c) => c.key === category);

      const { error } = await supabase.from('events').insert({
        title: title.trim(),
        description: description.trim() || null,
        start_date: fullStartDate,
        all_day: allDay,
        category,
        color: catObj?.color || '#ee7318',
        created_by: user.id,
      });

      if (error) throw error;

      setShowAddModal(false);
      loadEvents();
    } catch (err) {
      console.error(err);
    }
  }

  // Supprimer un événement
  async function handleDeleteEvent(id: string) {
    if (!confirm('Supprimer cet événement du calendrier ?')) return;
    try {
      await supabase.from('events').delete().eq('id', id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error(err);
    }
  }

  // Navigation dans le temps (Précédent / Suivant / Aujourd'hui)
  function handleNavigate(direction: -1 | 1) {
    const next = new Date(selectedDate);
    if (viewMode === 'jour') {
      next.setDate(next.getDate() + direction);
    } else if (viewMode === 'semaine') {
      next.setDate(next.getDate() + direction * 7);
    } else if (viewMode === 'mois') {
      next.setMonth(next.getMonth() + direction);
    } else if (viewMode === 'annee') {
      next.setFullYear(next.getFullYear() + direction);
    }
    setSelectedDate(next);
  }

  function handleGoToday() {
    setSelectedDate(new Date());
  }

  // Titre d'en-tête selon la vue
  const headerTitle = useMemo(() => {
    if (viewMode === 'jour') {
      return selectedDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    if (viewMode === 'semaine') {
      const start = getStartOfWeek(selectedDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.getDate()} ${start.toLocaleDateString('fr-FR', { month: 'short' })} – ${end.getDate()} ${end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`;
    }
    if (viewMode === 'mois') {
      return selectedDate.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric',
      });
    }
    return String(selectedDate.getFullYear());
  }, [viewMode, selectedDate]);

  // Événements pour un jour précis
  function getEventsForDay(d: Date) {
    return events.filter((e) => {
      const evtDate = new Date(e.start_date);
      return isSameDay(evtDate, d);
    });
  }

  // --- VUE MOIS : Calcul des jours de la grille ---
  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Déterminer le décalage (lundi = 0, ..., dimanche = 6)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: { date: Date; currentMonth: boolean }[] = [];

    // Jours du mois précédent
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month, -i),
        currentMonth: false,
      });
    }

    // Jours du mois courant
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        currentMonth: true,
      });
    }

    // Compléter pour avoir des multiples de 7
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          currentMonth: false,
        });
      }
    }

    return days;
  }, [selectedDate]);

  // --- VUE SEMAINE : Calcul des 7 jours ---
  const weekDays = useMemo(() => {
    const start = getStartOfWeek(selectedDate);
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  // Événements du jour sélectionné
  const selectedDayEvents = useMemo(() => {
    return getEventsForDay(selectedDate);
  }, [selectedDate, events]);

  const today = new Date();

  return (
    <div className="pb-32">
      <Header title="Agenda Familial" />

      <div className="p-4 space-y-4">
        {/* SÉLECTEUR DE VUES (Jour / Semaine / Mois / Année) */}
        <div className="flex items-center justify-between gap-2">
          <div className="grid grid-cols-4 p-1 bg-gray-100 rounded-2xl text-xs font-bold flex-1 shadow-xs">
            <button
              onClick={() => setViewMode('jour')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'jour' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Jour
            </button>
            <button
              onClick={() => setViewMode('semaine')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'semaine' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setViewMode('mois')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'mois' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Mois
            </button>
            <button
              onClick={() => setViewMode('annee')}
              className={`py-2 rounded-xl transition ${
                viewMode === 'annee' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Année
            </button>
          </div>

          <button
            onClick={() => handleOpenAddModal()}
            className="py-2 px-3 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 transition flex items-center gap-1 shadow-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
        </div>

        {/* BARRE DE NAVIGATION TEMPORELLE */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3 shadow-xs flex items-center justify-between">
          <button
            onClick={() => handleNavigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600"
            title="Précédent"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-center">
            <h2 className="font-bold text-sm sm:text-base text-gray-900 capitalize">
              {headerTitle}
            </h2>
            <button
              onClick={handleGoToday}
              className="text-[10px] font-bold px-2 py-0.5 bg-orange-100 text-primary-700 rounded-lg hover:bg-orange-200 transition"
              title="Aller à aujourd'hui"
            >
              Aujourd'hui
            </button>
          </div>

          <button
            onClick={() => handleNavigate(1)}
            className="p-2 hover:bg-gray-100 rounded-xl transition text-gray-600"
            title="Suivant"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* VUE 1 : MOIS (MENSUEL)                                         */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'mois' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-3 shadow-xs">
              {/* Jours de la semaine */}
              <div className="grid grid-cols-7 mb-1 text-center">
                {WEEK_DAYS.map((wd) => (
                  <span key={wd} className="text-[11px] font-bold text-gray-400 py-1">
                    {wd}
                  </span>
                ))}
              </div>

              {/* Grille des jours */}
              <div className="grid grid-cols-7 gap-1">
                {monthDays.map(({ date, currentMonth }, idx) => {
                  const isSelected = isSameDay(date, selectedDate);
                  const isToday = isSameDay(date, today);
                  const dayEvents = getEventsForDay(date);

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDate(date)}
                      className={`min-h-[46px] rounded-2xl p-1 flex flex-col items-center justify-between transition relative ${
                        isSelected
                          ? 'bg-primary-50 border-2 border-primary-500 text-primary-900 font-bold'
                          : isToday
                          ? 'bg-orange-100/70 text-primary-800 font-bold'
                          : currentMonth
                          ? 'text-gray-800 hover:bg-gray-50'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className={`text-xs ${isToday && !isSelected ? 'text-primary-700' : ''}`}>
                        {date.getDate()}
                      </span>

                      {/* Pastilles des événements */}
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 flex-wrap max-w-full">
                        {dayEvents.slice(0, 3).map((e) => {
                          const catObj = CATEGORIES.find((c) => c.key === e.category);
                          return (
                            <span
                              key={e.id}
                              className={`w-1.5 h-1.5 rounded-full ${catObj?.dot || 'bg-orange-500'}`}
                            />
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <span className="text-[8px] text-gray-400 font-bold leading-none">+</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DÉTAIL DU JOUR SÉLECTIONNÉ */}
            <div className="bg-white rounded-3xl border border-gray-100 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-primary-600" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-gray-700 capitalize">
                    {selectedDate.toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700"
                >
                  + Ajouter un événement
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="py-6 text-center text-xs text-gray-400 space-y-1">
                  <p>Aucun événement prévu pour ce jour.</p>
                  <button
                    onClick={() => handleOpenAddModal(selectedDate)}
                    className="text-primary-600 font-semibold underline text-xs"
                  >
                    Ajouter un rendez-vous ou une note
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedDayEvents.map((evt) => {
                    const dateObj = new Date(evt.start_date);
                    const timeStr = evt.all_day
                      ? 'Journée entière'
                      : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                    const canDelete = isAdmin || evt.created_by === user?.id;

                    return (
                      <div
                        key={evt.id}
                        className="p-3 rounded-2xl border border-gray-100 flex items-center justify-between hover:border-gray-200 transition shadow-xs"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${catInfo.dot}`} />
                            <h4 className="font-bold text-xs text-gray-900 truncate">{evt.title}</h4>
                          </div>
                          <div className="flex items-center gap-2 mt-1 pl-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="text-[10px] text-gray-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeStr}
                            </span>
                          </div>
                          {evt.description && (
                            <p className="text-[11px] text-gray-500 mt-1 pl-4 truncate">{evt.description}</p>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 2 : SEMAINE (HEBDOMADAIRE)                                 */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'semaine' && (
          <div className="space-y-3">
            {weekDays.map((dayDate) => {
              const dayEvts = getEventsForDay(dayDate);
              const isToday = isSameDay(dayDate, today);
              const dayName = dayDate.toLocaleDateString('fr-FR', { weekday: 'long' });
              const dayNum = dayDate.getDate();
              const monthShort = dayDate.toLocaleDateString('fr-FR', { month: 'short' });

              return (
                <div
                  key={dayDate.toISOString()}
                  className={`bg-white rounded-2xl border p-3.5 shadow-xs transition ${
                    isToday ? 'border-primary-300 ring-1 ring-primary-100' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-gray-50">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-xs capitalize ${isToday ? 'text-primary-700' : 'text-gray-900'}`}>
                        {dayName} {dayNum} {monthShort}
                      </span>
                      {isToday && (
                        <span className="px-1.5 py-0.2 rounded-md bg-orange-100 text-primary-700 text-[10px] font-bold">
                          Aujourd'hui
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenAddModal(dayDate)}
                      className="p-1 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50"
                      title="Ajouter pour ce jour"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="pt-2">
                    {dayEvts.length === 0 ? (
                      <p className="text-[11px] text-gray-400 italic">Rien de prévu</p>
                    ) : (
                      <div className="space-y-1.5">
                        {dayEvts.map((evt) => {
                          const dateObj = new Date(evt.start_date);
                          const timeStr = evt.all_day
                            ? 'Journée'
                            : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                          const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                          const canDelete = isAdmin || evt.created_by === user?.id;

                          return (
                            <div
                              key={evt.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-gray-50/70 border border-gray-100"
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${catInfo.dot}`} />
                                <span className="text-xs font-bold text-gray-900 truncate">{evt.title}</span>
                                <span className="text-[10px] text-gray-400 whitespace-nowrap">({timeStr})</span>
                              </div>
                              {canDelete && (
                                <button
                                  onClick={() => handleDeleteEvent(evt.id)}
                                  className="text-gray-300 hover:text-red-500 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 3 : JOUR (JOURNALIER)                                      */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'jour' && (
          <div className="space-y-4">
            <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 capitalize">
                    {selectedDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="text-xs text-gray-400">{selectedDayEvents.length} événement(s) programmé(s)</p>
                </div>
                <button
                  onClick={() => handleOpenAddModal(selectedDate)}
                  className="py-2 px-3 bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs hover:bg-primary-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ajouter</span>
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-400 space-y-2">
                  <Sun className="w-10 h-10 text-amber-300 mx-auto animate-pulse" />
                  <p className="text-xs font-medium">Journée libre, aucun engagement familial noté.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {selectedDayEvents.map((evt) => {
                    const dateObj = new Date(evt.start_date);
                    const timeStr = evt.all_day
                      ? 'Toute la journée'
                      : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                    const canDelete = isAdmin || evt.created_by === user?.id;

                    return (
                      <div
                        key={evt.id}
                        className="p-4 rounded-2xl border border-gray-100 shadow-xs flex items-start justify-between bg-gradient-to-r from-white to-orange-50/20"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className="text-xs text-gray-500 font-semibold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {timeStr}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-gray-900">{evt.title}</h4>
                          {evt.description && (
                            <p className="text-xs text-gray-600 leading-relaxed">{evt.description}</p>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            onClick={() => handleDeleteEvent(evt.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VUE 4 : ANNÉE (ANNUEL)                                         */}
        {/* ------------------------------------------------------------- */}
        {viewMode === 'annee' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {MONTHS_FR.map((monthName, monthIndex) => {
                const year = selectedDate.getFullYear();
                const firstDay = new Date(year, monthIndex, 1);
                const lastDay = new Date(year, monthIndex + 1, 0);

                // Événements dans ce mois
                const monthEvents = events.filter((e) => {
                  const d = new Date(e.start_date);
                  return d.getFullYear() === year && d.getMonth() === monthIndex;
                });

                return (
                  <button
                    key={monthName}
                    type="button"
                    onClick={() => {
                      setSelectedDate(new Date(year, monthIndex, 1));
                      setViewMode('mois');
                    }}
                    className="bg-white rounded-2xl border border-gray-100 p-3 shadow-xs hover:border-primary-300 transition text-left flex flex-col justify-between min-h-[105px]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-gray-900">{monthName}</span>
                        {monthEvents.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-orange-100 text-primary-700 text-[10px] font-bold">
                            {monthEvents.length}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">
                        {lastDay.getDate()} jours
                      </p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-50 flex items-center justify-between text-[10px] text-primary-600 font-semibold">
                      <span>Voir le mois</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL AJOUT D'ÉVÉNEMENT (AVEC FOOTER TOUJOURS ACCESSIBLE SUR MOBILE) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h3 className="font-bold text-base text-gray-900">Ajouter à l'agenda</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Titre de l'événement
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: RDV Dentiste Lina, Anniversaire..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none bg-gray-50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Catégorie
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setCategory(cat.key as any)}
                        className={`p-2 rounded-xl text-[11px] font-bold border text-left transition flex items-center justify-between ${
                          category === cat.key
                            ? 'border-primary-500 bg-orange-50 text-primary-800'
                            : 'border-gray-100 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {category === cat.key && <Check className="w-3 h-3 text-primary-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={startDateStr}
                      onChange={(e) => setStartDateStr(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50"
                    />
                  </div>
                  {!allDay && (
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-700 mb-1">Heure</label>
                      <input
                        type="time"
                        value={startTimeStr}
                        onChange={(e) => setStartTimeStr(e.target.value)}
                        className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="allDayCheck"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded text-primary-600 focus:ring-primary-500"
                  />
                  <label htmlFor="allDayCheck" className="text-xs text-gray-700 font-medium">
                    Toute la journée
                  </label>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                    Notes (optionnel)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Lieu, détails..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 bg-gray-50"
                  />
                </div>
              </div>

              {/* FOOTER TOUJOURS VISIBLE ET CLICABLE SUR MOBILE */}
              <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition shadow-sm"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
