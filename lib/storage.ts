'use client';

import { AppData, Recipe, PlannedMeal, ShoppingItem } from '@/types';
import { initialAppData, initialRecipes } from './sampleData';
import { supabase, isSupabaseConfigured } from './supabase';

const STORAGE_KEY = 'dar_app_data_v2';

export function mapDbToRecipe(row: any): Recipe {
  return {
    id: row.id,
    title: row.title,
    category: row.category || 'plat',
    defaultServings: row.default_servings || 4,
    prepTimeMinutes: row.prep_time_minutes || 15,
    cookTimeMinutes: row.cook_time_minutes || 20,
    imageUrl: row.image_url || undefined,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    steps: Array.isArray(row.steps) ? row.steps : [],
    notes: row.notes || undefined,
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export function mapRecipeToDb(recipe: Recipe, userId?: string) {
  return {
    id: recipe.id,
    title: recipe.title,
    category: recipe.category,
    default_servings: recipe.defaultServings,
    prep_time_minutes: recipe.prepTimeMinutes,
    cook_time_minutes: recipe.cookTimeMinutes,
    image_url: recipe.imageUrl || null,
    ingredients: recipe.ingredients || [],
    steps: recipe.steps || [],
    notes: recipe.notes || null,
    updated_at: new Date().toISOString(),
    ...(userId ? { created_by: userId } : {}),
  };
}

export function loadLocalData(): AppData {
  if (typeof window === 'undefined') return initialAppData;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveLocalData(initialAppData);
      return initialAppData;
    }
    const parsed = JSON.parse(raw);
    return {
      recipes: parsed.recipes && parsed.recipes.length > 0 ? parsed.recipes : initialAppData.recipes,
      weeklyPlan: parsed.weeklyPlan || {},
      customShoppingItems: parsed.customShoppingItems || [],
      checkedItems: parsed.checkedItems || {},
      lastSync: parsed.lastSync,
    };
  } catch (err) {
    console.error('Erreur de lecture du stockage local', err);
    return initialAppData;
  }
}

export function saveLocalData(data: AppData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Erreur de sauvegarde locale', err);
  }
}

/**
 * Charge l'ensemble des données cuisine (Recettes + Planning + Courses) depuis Supabase.
 * Met également à jour le cache localStorage.
 */
export async function loadCloudData(): Promise<AppData> {
  const local = loadLocalData();
  if (!isSupabaseConfigured()) {
    return local;
  }

  try {
    // 1. Charger les recettes depuis Supabase
    const { data: cloudRecipes, error: recError } = await supabase
      .from('recipes')
      .select('*')
      .order('updated_at', { ascending: false });

    let finalRecipes: Recipe[] = local.recipes;

    if (!recError && cloudRecipes) {
      if (cloudRecipes.length > 0) {
        finalRecipes = cloudRecipes.map(mapDbToRecipe);
      } else if (local.recipes.length > 0) {
        // Première initialisation : peupler la table Supabase avec les recettes existantes
        try {
          const toInsert = local.recipes.map((r) => mapRecipeToDb(r));
          await supabase.from('recipes').insert(toInsert);
        } catch (e) {
          console.warn('Initial seeding recipes warning:', e);
        }
      }
    }

    // 2. Charger le planning et les courses partagés
    const { data: kitchenData, error: kitchenError } = await supabase
      .from('family_kitchen')
      .select('*')
      .eq('id', 'main')
      .maybeSingle();

    let finalWeeklyPlan = local.weeklyPlan;
    let finalCustomItems = local.customShoppingItems;
    let finalCheckedItems = local.checkedItems;

    if (!kitchenError && kitchenData) {
      finalWeeklyPlan = kitchenData.weekly_plan || {};
      finalCustomItems = Array.isArray(kitchenData.custom_shopping_items) ? kitchenData.custom_shopping_items : [];
      finalCheckedItems = kitchenData.checked_items || {};
    }

    const merged: AppData = {
      recipes: finalRecipes,
      weeklyPlan: finalWeeklyPlan,
      customShoppingItems: finalCustomItems,
      checkedItems: finalCheckedItems,
      lastSync: new Date().toISOString(),
    };

    saveLocalData(merged);
    return merged;
  } catch (err) {
    console.warn('Erreur chargement Supabase Cloud Cuisine:', err);
    return local;
  }
}

/**
 * Enregistre une recette dans le Cloud Supabase et dans le cache local
 */
export async function saveCloudRecipe(recipe: Recipe, userId?: string): Promise<AppData> {
  const local = loadLocalData();
  const exists = local.recipes.some((r) => r.id === recipe.id);
  const updatedRecipes = exists
    ? local.recipes.map((r) => (r.id === recipe.id ? recipe : r))
    : [recipe, ...local.recipes];

  const updated: AppData = {
    ...local,
    recipes: updatedRecipes,
    lastSync: new Date().toISOString(),
  };

  saveLocalData(updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('recipes').upsert(mapRecipeToDb(recipe, userId));
    } catch (err) {
      console.error('Erreur sauvegarde Supabase recipe:', err);
    }
  }

  return updated;
}

/**
 * Supprime une recette dans le Cloud Supabase et dans le cache local
 */
export async function deleteCloudRecipe(recipeId: string): Promise<AppData> {
  const local = loadLocalData();
  const updatedRecipes = local.recipes.filter((r) => r.id !== recipeId);

  // Supprimer aussi cette recette du planning si elle y figure
  const updatedPlan = { ...local.weeklyPlan };
  Object.keys(updatedPlan).forEach((k) => {
    if (updatedPlan[k]?.recipeId === recipeId) {
      delete updatedPlan[k];
    }
  });

  const updated: AppData = {
    ...local,
    recipes: updatedRecipes,
    weeklyPlan: updatedPlan,
    lastSync: new Date().toISOString(),
  };

  saveLocalData(updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('recipes').delete().eq('id', recipeId);
      // Mettre à jour le planning dans family_kitchen
      await syncKitchenCloud(updated.weeklyPlan, updated.customShoppingItems, updated.checkedItems);
    } catch (err) {
      console.error('Erreur suppression Supabase recipe:', err);
    }
  }

  return updated;
}

/**
 * Synchronise l'état du planning et de la liste de courses vers le Cloud Supabase
 */
export async function syncKitchenCloud(
  weeklyPlan: Record<string, PlannedMeal>,
  customShoppingItems: ShoppingItem[],
  checkedItems: Record<string, boolean>
): Promise<AppData> {
  const local = loadLocalData();
  const updated: AppData = {
    ...local,
    weeklyPlan,
    customShoppingItems,
    checkedItems,
    lastSync: new Date().toISOString(),
  };

  saveLocalData(updated);

  if (isSupabaseConfigured()) {
    try {
      await supabase.from('family_kitchen').upsert({
        id: 'main',
        weekly_plan: weeklyPlan,
        custom_shopping_items: customShoppingItems,
        checked_items: checkedItems,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Erreur sync family_kitchen:', err);
    }
  }

  return updated;
}

export function clearAllPlanningData(): AppData {
  const current = loadLocalData();
  const cleared: AppData = {
    ...current,
    weeklyPlan: {},
    customShoppingItems: [],
    checkedItems: {},
  };
  saveLocalData(cleared);
  if (isSupabaseConfigured()) {
    syncKitchenCloud({}, [], {});
  }
  return cleared;
}

export async function syncWithGoogle(currentData: AppData): Promise<AppData> {
  // Synchronisation prioritaire avec Supabase
  if (isSupabaseConfigured()) {
    await syncKitchenCloud(
      currentData.weeklyPlan,
      currentData.customShoppingItems,
      currentData.checkedItems
    );
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentData),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        saveLocalData(result.data);
        return result.data;
      }
    }
  } catch (e) {
    // Non bloquant
  }
  return currentData;
}
