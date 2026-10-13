'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, FamilyEvent } from '@/lib/supabase';
import { Calendar, Plus, Clock, Tag, Trash2, CalendarDays, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

const CATEGORIES = [
  { key: 'famille', label: 'Famille', color: 'bg-orange-500 text-white', border: 'border-orange-500' },
  { key: 'anniversaire', label: 'Anniversaire', color: 'bg-pink-500 text-white', border: 'border-pink-500' },
  { key: 'ecole', label: 'École & Enfants', color: 'bg-blue-500 text-white', border: 'border-blue-500' },
  { key: 'sante', label: 'Santé & RDV', color: 'bg-emerald-500 text-white', border: 'border-emerald-500' },
  { key: 'sortie', label: 'Sorties & Vacances', color: 'bg-purple-500 text-white', border: 'border-purple-500' },
  { key: 'general', label: 'Autre', color: 'bg-gray-500 text-white', border: 'border-gray-500' },
];

export default function AgendaPage() {
  const router = useRouter();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal nouvel événement
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [allDay, setAllDay] = useState(true);
  const [category, setCategory] = useState<FamilyEvent['category']>('famille');

  // Mois actif dans le calendrier
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Charger les événements
  useEffect(() => {
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

    loadEvents();

    // TEMPS RÉEL (REALTIME SUPABASE)
    const channel = supabase
      .channel('family_events')
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
  }, []);

  // Ajouter un événement
  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !user) return;

    try {
      const fullStartDate = allDay
        ? new Date(`${startDate}T00:00:00`).toISOString()
        : new Date(`${startDate}T${startTime}:00`).toISOString();

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
      setTitle('');
      setDescription('');
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

  // Filtrage par mois
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthName = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Événements à venir
  const upcomingEvents = events.filter((e) => {
    const d = new Date(e.start_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  });

  return (
    <div className="pb-32">
      <Header title="Agenda Partagé" />

      <div className="p-4 space-y-5">
        {/* EN-TÊTE & BOUTON AJOUT */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Calendrier de la maison</h2>
            <p className="text-xs text-gray-500">Synchronisé en temps réel avec toute la famille</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="py-2 px-3.5 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter</span>
          </button>
        </div>

        {/* NAVIGATION MOIS */}
        <div className="bg-white rounded-2xl border border-gray-100 p-3.5 shadow-xs flex items-center justify-between">
          <button
            onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-600"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-sm text-gray-900 capitalize">{monthName}</span>
          <button
            onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
            className="p-1.5 hover:bg-gray-100 rounded-xl transition text-gray-600"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* LISTE DES ÉVÉNEMENTS À VENIR */}
        <div className="space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-400">
            Prochains rendez-vous & dates clés
          </h3>

          {loading ? (
            <div className="text-center py-8 text-gray-400 text-xs">Chargement de l'agenda...</div>
          ) : upcomingEvents.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center space-y-2">
              <Calendar className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="font-bold text-xs text-gray-600">Aucun événement à venir</p>
              <p className="text-[11px] text-gray-400">
                Ajoutez les anniversaires, vacances ou rendez-vous de la famille.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {upcomingEvents.map((evt) => {
                const dateObj = new Date(evt.start_date);
                const dayNumber = dateObj.getDate();
                const dayName = dateObj.toLocaleDateString('fr-FR', { weekday: 'short' });
                const monthShort = dateObj.toLocaleDateString('fr-FR', { month: 'short' });
                const timeStr = evt.all_day
                  ? 'Journée entière'
                  : dateObj.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

                const catInfo = CATEGORIES.find((c) => c.key === evt.category) || CATEGORIES[0];
                const canDelete = isAdmin || evt.created_by === user?.id;

                return (
                  <div
                    key={evt.id}
                    className="bg-white rounded-2xl p-3.5 border border-gray-100 shadow-xs flex items-center gap-3.5 hover:border-gray-200 transition"
                  >
                    {/* PASTILLE CALENDRIER */}
                    <div className="w-12 h-13 rounded-2xl bg-orange-50 border border-orange-100 flex flex-col items-center justify-center flex-shrink-0 text-primary-700">
                      <span className="text-[10px] font-bold uppercase leading-none">{dayName}</span>
                      <span className="text-base font-black leading-tight">{dayNumber}</span>
                      <span className="text-[9px] text-gray-400 leading-none">{monthShort}</span>
                    </div>

                    {/* DÉTAILS */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs text-gray-900 truncate">{evt.title}</h4>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeStr}
                        </span>
                      </div>
                      {evt.description && (
                        <p className="text-[11px] text-gray-500 mt-1 truncate">{evt.description}</p>
                      )}
                    </div>

                    {/* ACTION SUPPRIMER */}
                    {canDelete && (
                      <button
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition flex-shrink-0"
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

      {/* MODAL AJOUT D'ÉVÉNEMENT */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <h3 className="font-bold text-base text-gray-900">Ajouter à l'agenda</h3>

            <form onSubmit={handleAddEvent} className="space-y-3">
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
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
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
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {!allDay && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 mb-1">Heure</label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
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
                  className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700"
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
