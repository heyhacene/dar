'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Recipe } from '@/types';
import { loadLocalData, saveLocalData, syncWithGoogle } from '@/lib/storage';
import Link from 'next/link';
import { Plus, Search, Clock, Users, ChefHat, Wand2, X, AlertCircle, Share2, Sparkles } from 'lucide-react';
import CuisineTabs from '@/components/CuisineTabs';

export default function RecettesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  // Modal d'import Cookidoo / Web
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importInput, setImportInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const data = loadLocalData();
    setRecipes(data.recipes);
  }, []);

  const filtered = recipes.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === 'all' || r.category === category;
    return matchSearch && matchCategory;
  });

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!importInput.trim()) return;

    setError(null);
    setLoading(true);

    try {
      const isUrl = /^https?:\/\//i.test(importInput.trim());
      const payload = isUrl ? { url: importInput.trim() } : { rawText: importInput.trim() };

      const res = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.recipe) {
        throw new Error(data.error || 'Impossible d’analyser cette recette.');
      }

      const imported = data.recipe;
      const newRecipe: Recipe = {
        id: `rec_${Date.now()}`,
        title: imported.title || 'Recette Cookidoo',
        category: (imported.category as any) || 'plat',
        defaultServings: imported.defaultServings || 4,
        prepTimeMinutes: imported.prepTimeMinutes || 15,
        cookTimeMinutes: imported.cookTimeMinutes || 25,
        imageUrl: imported.imageUrl,
        ingredients: imported.ingredients || [],
        steps: imported.steps || [],
        notes: imported.notes || 'Importé depuis Cookidoo / Thermomix',
        updatedAt: new Date().toISOString(),
      };

      const currentData = loadLocalData();
      const updated = {
        ...currentData,
        recipes: [newRecipe, ...currentData.recipes],
      };

      saveLocalData(updated);
      syncWithGoogle(updated);
      setRecipes(updated.recipes);
      setIsModalOpen(false);
      setImportInput('');

      // Rediriger immédiatement vers la nouvelle fiche recette !
      router.push(`/recettes/${newRecipe.id}`);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l’importation.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-32">
      <Header title="Carnet de Recettes" />
      <CuisineTabs />

      <div className="p-4 space-y-4">
        {/* BANNIÈRE COOKIDOO ULTRA-VISIBLE */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 rounded-2xl text-white shadow-md flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-200" />
              <span>Importer depuis Cookidoo</span>
            </h2>
            <p className="text-xs text-emerald-100 mt-0.5">
              Collez le lien ou texte Thermomix en 1 clic
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="py-2 px-3.5 bg-white text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-50 transition shadow-sm flex items-center gap-1.5 whitespace-nowrap"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Importer</span>
          </button>
        </div>

        {/* Barre de recherche et ajout manuel */}
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
            className="p-2.5 bg-primary-600 text-white rounded-xl shadow-sm hover:bg-primary-700 transition flex items-center gap-1 text-xs font-semibold"
            title="Créer une recette manuellement"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer</span>
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
              <p className="text-sm font-semibold text-gray-600">Aucune recette trouvée</p>
              <p className="text-xs text-gray-400 mt-1">
                Touchez « Importer » en haut pour ajouter une recette Cookidoo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* MODALE D'IMPORTATION COOKIDOO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Wand2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base">Importer depuis Cookidoo</h3>
                  <p className="text-[11px] text-gray-500">Thermomix ou n'importe quel site web</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-full"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleImport} className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl text-xs text-emerald-950 space-y-2">
                <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                  <Share2 className="w-4 h-4" /> Comment faire depuis l'application Cookidoo :
                </p>
                <ol className="list-decimal pl-4 space-y-1 text-emerald-900/90 leading-relaxed">
                  <li>Ouvrez votre recette sur l'application <strong>Cookidoo</strong>.</li>
                  <li>Touchez l'icône <strong>Partager</strong> <em>(les 3 points ou la flèche en haut de l'écran)</em>.</li>
                  <li>Touchez <strong>« Copier le lien »</strong> <em>(ou partagez le texte vers Notes/WhatsApp)</em>.</li>
                  <li>Revenez ici et <strong>collez dans la case ci-dessous</strong> !</li>
                </ol>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Collez le lien Cookidoo ou le texte copié ici :
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Exemple : https://cookidoo.fr/recipes/recipe/fr-FR/r... ou collez le texte de la recette"
                  value={importInput}
                  onChange={(e) => setImportInput(e.target.value)}
                  className="w-full p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Analyse et découpage en cours...</span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Importer dans mon carnet</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
