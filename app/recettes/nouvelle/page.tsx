'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import { Recipe, Ingredient } from '@/types';
import { loadLocalData, saveLocalData, syncWithGoogle } from '@/lib/storage';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NouvelleRecettePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<'plat' | 'entree' | 'dessert' | 'rapide'>('plat');
  const [servings, setServings] = useState(4);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(20);
  const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: 'ing_1', name: '', quantity: 100, unit: 'g', category: 'epicerie' },
  ]);
  const [steps, setSteps] = useState<string[]>(['']);

  function handleAddIngredient() {
    setIngredients([
      ...ingredients,
      { id: `ing_${Date.now()}`, name: '', quantity: 1, unit: 'pièce(s)', category: 'epicerie' },
    ]);
  }

  function handleRemoveIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function handleAddStep() {
    setSteps([...steps, '']);
  }

  function handleRemoveStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const validIngredients = ingredients.filter((i) => i.name.trim() !== '');
    const validSteps = steps.filter((s) => s.trim() !== '');

    const newRecipe: Recipe = {
      id: `rec_${Date.now()}`,
      title: title.trim(),
      category,
      defaultServings: servings,
      prepTimeMinutes: prepTime,
      cookTimeMinutes: cookTime,
      imageUrl: imageUrl.trim() || undefined,
      ingredients: validIngredients,
      steps: validSteps,
      updatedAt: new Date().toISOString(),
    };

    const currentData = loadLocalData();
    const updated = {
      ...currentData,
      recipes: [newRecipe, ...currentData.recipes],
    };

    saveLocalData(updated);
    syncWithGoogle(updated);
    router.push('/recettes');
  }

  return (
    <div className="pb-10">
      <Header title="Nouvelle Recette" />

      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <Link href="/recettes" className="text-xs text-primary-600 font-semibold flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Retour aux recettes
        </Link>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Titre de la recette</label>
            <input
              type="text"
              required
              placeholder="Ex: Gratin Dauphinois"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500 bg-white"
              >
                <option value="plat">Plat</option>
                <option value="rapide">Rapide</option>
                <option value="entree">Entrée</option>
                <option value="dessert">Dessert</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Portions de base</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Préparation (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Cuisson (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Lien photo (optionnel)</label>
            <input
              type="url"
              placeholder="https://..."
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl"
            />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">Ingrédients</h3>
            <button
              type="button"
              onClick={handleAddIngredient}
              className="text-xs text-primary-600 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>

          {ingredients.map((ing, i) => (
            <div key={ing.id} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Nom (ex: Farine)"
                value={ing.name}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].name = e.target.value;
                  setIngredients(copy);
                }}
                className="flex-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <input
                type="number"
                placeholder="Qté"
                value={ing.quantity}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].quantity = Number(e.target.value);
                  setIngredients(copy);
                }}
                className="w-16 px-2 py-1.5 text-xs border border-gray-200 rounded-lg text-center"
              />
              <input
                type="text"
                placeholder="Unité"
                value={ing.unit}
                onChange={(e) => {
                  const copy = [...ingredients];
                  copy[i].unit = e.target.value;
                  setIngredients(copy);
                }}
                className="w-20 px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveIngredient(i)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-gray-900">Étapes</h3>
            <button
              type="button"
              onClick={handleAddStep}
              className="text-xs text-primary-600 font-bold flex items-center gap-1 hover:underline"
            >
              <Plus className="w-4 h-4" /> Ajouter étape
            </button>
          </div>

          {steps.map((st, i) => (
            <div key={i} className="flex gap-2 items-start">
              <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-1.5">
                {i + 1}
              </span>
              <textarea
                rows={2}
                placeholder={`Étape ${i + 1}...`}
                value={st}
                onChange={(e) => {
                  const copy = [...steps];
                  copy[i] = e.target.value;
                  setSteps(copy);
                }}
                className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
              />
              <button
                type="button"
                onClick={() => handleRemoveStep(i)}
                className="text-gray-400 hover:text-red-500 p-1 mt-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl shadow-sm hover:bg-primary-700 transition text-sm"
        >
          Enregistrer la recette
        </button>
      </form>
    </div>
  );
}
