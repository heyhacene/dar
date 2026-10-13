'use client';

import { useState, useEffect, useMemo } from 'react';
import Header from '@/components/Header';
import { AppData, ShoppingItem } from '@/types';
import { loadLocalData, saveLocalData, syncWithGoogle } from '@/lib/storage';
import { Check, Plus, ShoppingBag } from 'lucide-react';

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
    } else {
      const isChecked = Boolean(data.checkedItems[id]);
      const updatedChecked = { ...data.checkedItems, [id]: !isChecked };
      const updated = { ...data, checkedItems: updatedChecked };
      setData(updated);
      saveLocalData(updated);
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
    setNewItemText('');
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
  }

  const uncheckedCount = allItems.filter((i) => !i.checked).length;

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
          {allItems.some((i) => i.checked) && (
            <button
              onClick={handleClearChecked}
              className="text-xs text-red-600 font-semibold hover:bg-red-50 px-2.5 py-1.5 rounded-lg transition"
            >
              Décocher / Vider cochés
            </button>
          )}
        </div>

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
          >
            <Plus className="w-5 h-5" />
          </button>
        </form>

        {/* Cases à cocher interactives */}
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
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                  item.checked
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-gray-300 bg-white'
                }`}
              >
                {item.checked && <Check className="w-4 h-4 stroke-[3]" />}
              </div>

              <div className="flex-1">
                <p className={`text-sm font-semibold ${item.checked ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name}
                </p>
                {item.isCustom && <span className="text-[10px] text-gray-400">Ajout libre</span>}
              </div>

              {item.quantity && (
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-md ${
                    item.checked ? 'bg-gray-200 text-gray-500' : 'bg-orange-50 text-primary-700'
                  }`}
                >
                  {item.quantity} {item.unit}
                </span>
              )}
            </div>
          ))}

          {allItems.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ShoppingBag className="w-12 h-12 mx-auto stroke-1 mb-2" />
              <p className="text-sm">Votre liste de courses est vide !</p>
              <p className="text-xs text-gray-400 mt-1">Ajoutez des recettes dans votre planning pour la remplir.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
