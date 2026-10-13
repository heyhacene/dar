'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import AddMealModal from '@/components/AddMealModal';
import { AppData, DayOfWeek, MealType, PlannedMeal } from '@/types';
import { loadLocalData, saveLocalData, syncWithGoogle } from '@/lib/storage';
import { Plus, Users, Trash2, CalendarDays } from 'lucide-react';
import Link from 'next/link';

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

export default function PlanningPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [modalSlot, setModalSlot] = useState<{ day: DayOfWeek; type: MealType } | null>(null);

  useEffect(() => {
    const local = loadLocalData();
    setData(local);
  }, []);

  if (!data) return <div className="p-8 text-center text-gray-500">Chargement du planning...</div>;

  const handleOpenSlot = (day: DayOfWeek, type: MealType) => {
    setModalSlot({ day, type });
  };

  const handleSaveMeal = (mealInfo: { recipeId?: string; customTitle?: string; servings: number }) => {
    if (!modalSlot) return;
    const key = `${modalSlot.day}_${modalSlot.type}`;
    const newMeal: PlannedMeal = {
      id: `p_${Date.now()}`,
      day: modalSlot.day,
      type: modalSlot.type,
      ...mealInfo,
    };

    const updated: AppData = {
      ...data,
      weeklyPlan: {
        ...data.weeklyPlan,
        [key]: newMeal,
      },
    };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
    setModalSlot(null);
  };

  const handleDirectDelete = (day: DayOfWeek, type: MealType) => {
    const key = `${day}_${type}`;
    const copy = { ...data.weeklyPlan };
    delete copy[key];

    const updated: AppData = { ...data, weeklyPlan: copy };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
  };

  const handleDeleteMeal = () => {
    if (!modalSlot) return;
    handleDirectDelete(modalSlot.day, modalSlot.type);
    setModalSlot(null);
  };

  const handleClearWeek = () => {
    if (!confirm('Voulez-vous vider tous les repas de cette semaine ?')) return;
    const updated: AppData = {
      ...data,
      weeklyPlan: {},
    };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
  };

  const hasPlannedMeals = Object.keys(data.weeklyPlan).length > 0;

  return (
    <div>
      <Header title="Planning de la semaine" onRefresh={() => syncWithGoogle(data).then(setData)} />

      <div className="p-4 space-y-4">
        {/* Bannière d'actions */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-4 text-white shadow-md flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base">Menu de la semaine</h2>
            <p className="text-xs text-orange-100">
              {hasPlannedMeals
                ? `${Object.keys(data.weeklyPlan).length} repas prévu(s)`
                : 'Planning vide pour le moment'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {hasPlannedMeals && (
              <button
                onClick={handleClearWeek}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl text-xs backdrop-blur-md transition flex items-center gap-1"
                title="Vider tous les repas de la semaine"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>
            )}
            <Link
              href="/courses"
              className="px-3.5 py-1.5 bg-white text-primary-600 font-bold rounded-xl text-xs shadow-sm hover:bg-orange-50 transition"
            >
              Courses →
            </Link>
          </div>
        </div>

        {/* Grille du Lundi au Dimanche */}
        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const lunch = data.weeklyPlan[`${key}_midi`];
            const dinner = data.weeklyPlan[`${key}_soir`];
            const lunchRecipe = lunch?.recipeId ? data.recipes.find((r) => r.id === lunch.recipeId) : null;
            const dinnerRecipe = dinner?.recipeId ? data.recipes.find((r) => r.id === dinner.recipeId) : null;

            return (
              <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
                <div className="bg-gray-50/80 px-4 py-2 border-b border-gray-100 font-bold text-sm text-gray-800 flex items-center justify-between">
                  <span>{label}</span>
                  {(lunch || dinner) && (
                    <span className="text-[11px] font-normal text-gray-500">
                      {[lunch && 'Midi', dinner && 'Soir'].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-100 text-sm">
                  {/* Créneau MIDI */}
                  <div
                    onClick={() => handleOpenSlot(key, 'midi')}
                    className="p-3 hover:bg-orange-50/30 transition cursor-pointer flex flex-col justify-between min-h-[95px] relative group"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                      <span>Midi ☀️</span>
                      {lunch && (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5 text-primary-600 font-semibold">
                            <Users className="w-3 h-3" /> {lunch.servings}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDelete(key, 'midi');
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5 transition"
                            title="Supprimer ce repas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {lunch ? (
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-2 text-xs">
                          {lunchRecipe ? lunchRecipe.title : lunch.customTitle}
                        </p>
                        <span className="text-[10px] text-primary-600/80 font-medium">
                          {lunchRecipe ? 'Recette du carnet' : 'Plat libre'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-300 text-xs py-2">
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </div>
                    )}
                  </div>

                  {/* Créneau SOIR */}
                  <div
                    onClick={() => handleOpenSlot(key, 'soir')}
                    className="p-3 hover:bg-orange-50/30 transition cursor-pointer flex flex-col justify-between min-h-[95px] relative group"
                  >
                    <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                      <span>Soir 🌙</span>
                      {dinner && (
                        <div className="flex items-center gap-1.5">
                          <span className="flex items-center gap-0.5 text-primary-600 font-semibold">
                            <Users className="w-3 h-3" /> {dinner.servings}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDirectDelete(key, 'soir');
                            }}
                            className="text-gray-400 hover:text-red-500 p-0.5 transition"
                            title="Supprimer ce repas"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {dinner ? (
                      <div>
                        <p className="font-semibold text-gray-900 line-clamp-2 text-xs">
                          {dinnerRecipe ? dinnerRecipe.title : dinner.customTitle}
                        </p>
                        <span className="text-[10px] text-primary-600/80 font-medium">
                          {dinnerRecipe ? 'Recette du carnet' : 'Plat libre'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-300 text-xs py-2">
                        <Plus className="w-4 h-4" />
                        <span>Ajouter</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {modalSlot && (
        <AddMealModal
          day={modalSlot.day}
          type={modalSlot.type}
          recipes={data.recipes}
          initialMeal={data.weeklyPlan[`${modalSlot.day}_${modalSlot.type}`]}
          onClose={() => setModalSlot(null)}
          onSave={handleSaveMeal}
          onDelete={data.weeklyPlan[`${modalSlot.day}_${modalSlot.type}`] ? handleDeleteMeal : undefined}
        />
      )}
    </div>
  );
}
