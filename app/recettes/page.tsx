'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { Recipe } from '@/types';
import { loadLocalData } from '@/lib/storage';
import Link from 'next/link';
import { Plus, Search, Clock, Users, ChefHat } from 'lucide-react';

export default function RecettesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  useEffect(() => {
    const data = loadLocalData();
    setRecipes(data.recipes);
  }, []);

  const filtered = recipes.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'all' || r.category === category;
    return matchSearch && matchCategory;
  });

  return (
    <div>
      <Header title="Carnet de Recettes" />

      <div className="p-4 space-y-4">
        {/* Recherche et Ajout */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une recette..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xs"
            />
          </div>
          <Link
            href="/recettes/nouvelle"
            className="p-2.5 bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-700 transition"
            title="Ajouter une recette"
          >
            <Plus className="w-5 h-5" />
          </Link>
        </div>

        {/* Filtres par catégorie */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
          {[
            { id: 'all', label: 'Toutes' },
            { id: 'plat', label: 'Plats' },
            { id: 'rapide', label: 'Rapides' },
            { id: 'entree', label: 'Entrées' },
            { id: 'dessert', label: 'Desserts' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`px-3 py-1.5 rounded-full transition whitespace-nowrap ${
                category === cat.id
                  ? 'bg-gray-900 text-white shadow-xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Liste des recettes */}
        <div className="grid grid-cols-1 gap-3.5">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/recettes/${r.id}`}
              className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden flex gap-3 p-3 hover:shadow-md transition active:scale-[0.99]"
            >
              {r.imageUrl ? (
                <img
                  src={r.imageUrl}
                  alt={r.title}
                  className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <ChefHat className="w-8 h-8" />
                </div>
              )}

              <div className="flex-1 flex flex-col justify-between py-0.5">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-primary-600 bg-orange-50 px-2 py-0.5 rounded-md">
                    {r.category}
                  </span>
                  <h3 className="font-bold text-gray-900 text-sm mt-1 line-clamp-1">{r.title}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {r.prepTimeMinutes + r.cookTimeMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {r.defaultServings} pers.
                  </span>
                  <span>{r.ingredients.length} ingr.</span>
                </div>
              </div>
            </Link>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <ChefHat className="w-12 h-12 mx-auto stroke-1 mb-2" />
              <p className="text-sm">Aucune recette trouvée</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
