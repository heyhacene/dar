'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { AppData, ShoppingItem } from '@/types';
import { loadLocalData, saveLocalData, syncWithGoogle } from '@/lib/storage';
import { Check, Plus, ShoppingBag, Trash2, Info } from 'lucide-react';
import Link from 'next/link';

export default function CoursesPage() {
  const [data, setData] = useState<AppData | null>(null);
  const [newItemText, setNewItemText] = useState('');

  useEffect(() => {
    const loaded = loadLocalData();
    setData(loaded);
  }, []);

  // Consolidation des ingrédients depuis le planning de la semaine
  const aggregatedItems = useMemo(() => {
    if (!data) return [];

    const map = new Map<string, { name: string; quantity: number; unit: string; category: string }>();

    Object.values(data.weeklyPlan).forEach((meal) => {
      if (!meal.recipeId) return;
      const recipe = data.recipes.find((r) => r.id === meal.recipeId);
      if (!recipe) return;

      const scale = meal.servings / recipe.defaultServings;

      recipe.ingredients.forEach((ing) => {
        const key = `${ing.name.toLowerCase().trim()}_${ing.unit.toLowerCase().trim()}`;
        const qty = ing.quantity * scale;

        if (map.has(key)) {
          const existing = map.get(key)!;
          existing.quantity += qty;
        } else {
          map.set(key, {
            name: ing.name,
            quantity: qty,
            unit: ing.unit,
            category: ing.category || 'epicerie',
          });
        }
      });
    });

    const list: ShoppingItem[] = [];
    map.forEach((item, key) => {
      list.push({
        id: `agg_${key}`,
        name: item.name,
        quantity: Math.round(item.quantity * 10) / 10,
        unit: item.unit,
        category: item.category,
        checked: Boolean(data.checkedItems[`agg_${key}`]),
      });
    });

    return list;
  }, [data]);

  if (!data) return <div className="p-8 text-center text-gray-500">Génération de la liste...</div>;

  const allItems = [...aggregatedItems, ...data.customShoppingItems];

  function toggleItem(id: string, isCustom?: boolean) {
    if (!data) return;
    if (isCustom) {
      const updatedCustom = data.customShoppingItems.map((it) =>
        it.id === id ? { ...it, checked: !it.checked } : it
      );
      const updated = { ...data, customShoppingItems: updatedCustom };
      setData(updated);
      saveLocalData(updated);
      syncWithGoogle(updated);
    } else {
      const isChecked = Boolean(data.checkedItems[id]);
      const updatedChecked = { ...data.checkedItems, [id]: !isChecked };
      const updated = { ...data, checkedItems: updatedChecked };
      setData(updated);
      saveLocalData(updated);
      syncWithGoogle(updated);
    }
  }

  function handleAddCustomItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItemText.trim() || !data) return;

    const newItem: ShoppingItem = {
      id: `custom_${Date.now()}`,
      name: newItemText.trim(),
      category: 'autres',
      checked: false,
      isCustom: true,
    };

    const updated: AppData = {
      ...data,
      customShoppingItems: [newItem, ...data.customShoppingItems],
    };

    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
    setNewItemText('');
  }

  function handleDeleteCustomItem(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!data) return;
    const updatedCustom = data.customShoppingItems.filter((i) => i.id !== id);
    const updated: AppData = {
      ...data,
      customShoppingItems: updatedCustom,
    };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
  }

  function handleClearChecked() {
    if (!data) return;
    const updatedCustom = data.customShoppingItems.filter((i) => !i.checked);
    const updated: AppData = {
      ...data,
      customShoppingItems: updatedCustom,
      checkedItems: {},
    };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
  }

  function handleClearAllCustom() {
    if (!data) return;
    if (!confirm('Supprimer tous les articles ajoutés manuellement ?')) return;
    const updated: AppData = {
      ...data,
      customShoppingItems: [],
    };
    setData(updated);
    saveLocalData(updated);
    syncWithGoogle(updated);
  }

  const uncheckedCount = allItems.filter((i) => !i.checked).length;
  const hasPlannedMeals = Object.keys(data.weeklyPlan).length > 0;

  return (
    <div>
      <Header title="Liste de Courses" onRefresh={() => syncWithGoogle(data).then(setData)} />

      <div className="p-4 space-y-4">
        {/* Résumé */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900 text-sm">Articles à acheter</h2>
            <p className="text-xs text-gray-500">
              {uncheckedCount} restant(s) sur {allItems.length}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {data.customShoppingItems.length > 0 && (
              <button
                onClick={handleClearAllCustom}
                className="text-xs text-gray-500 hover:text-red-600 font-semibold px-2 py-1.5 rounded-lg transition"
                title="Vider les ajouts manuels"
              >
                Vider manuels
              </button>
            )}
            {allItems.some((i) => i.checked) && (
              <button
                onClick={handleClearChecked}
                className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2 py-1.5 rounded-lg transition"
              >
                Vider cochés
              </button>
            )}
          </div>
        </div>

        {/* Message d'explication si planning vide */}
        {!hasPlannedMeals && (
          <div className="p-3.5 bg-orange-50/70 border border-orange-100 rounded-2xl flex items-start gap-2.5 text-xs text-orange-950">
            <Info className="w-4 h-4 text-primary-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-primary-950">Votre planning est vide</p>
              <p className="text-orange-900/80 mt-0.5 leading-relaxed">
                Les ingrédients s’ajoutent ici automatiquement quand vous programmez des recettes dans le{' '}
                <Link href="/planning" className="font-bold text-primary-700 underline">
                  Planning
                </Link>
                . Vous pouvez aussi ajouter des articles libres ci-dessous.
              </p>
            </div>
          </div>
        )}

        {/* Ajout libre */}
        <form onSubmit={handleAddCustomItem} className="flex gap-2">
          <input
            type="text"
            placeholder="Ajouter un article libre (ex: Café, Éponge...)"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
          />
          <button
            type="submit"
            className="p-2.5 bg-primary-600 text-white rounded-xl shadow-xs hover:bg-primary-700 transition"
            title="Ajouter à la liste"
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {/* Liste avec cases à cocher */}
        <div className="space-y-2">
          {allItems.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id, item.isCustom)}
              className={`flex items-center gap-3 p-3.5 rounded-2xl border transition cursor-pointer select-none ${
                item.checked
                  ? 'bg-gray-50 border-gray-100 opacity-60'
                  : 'bg-white border-gray-200 shadow-xs hover:border-primary-300'
              }`}
            >
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition flex-shrink-0 ${
                  item.checked
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold truncate ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name}
                </p>
                <span className="text-[10px] text-gray-400">
                  {item.isCustom ? 'Ajout manuel' : 'Ingrédient du planning'}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {item.quantity && (
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-md ${
                      item.checked ? 'bg-gray-200 text-gray-500' : 'bg-orange-50 text-primary-700'
                    }`}
                  >
                    {item.quantity} {item.unit}
                  </span>
                )}
                {item.isCustom && (
                  <button
                    onClick={(e) => handleDeleteCustomItem(item.id, e)}
                    className="p-1 text-gray-400 hover:text-red-500 transition rounded-md"
                    title="Supprimer cet article"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}

          {allItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 mb-2 text-gray-300" />
              <p className="text-sm font-semibold text-gray-600">Votre liste de courses est vide !</p>
              <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                Ajoutez un repas dans votre planning ou ajoutez un article manuel avec le formulaire ci-dessus.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
