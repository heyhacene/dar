export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: 'fruits_legumes' | 'viandes_poissons' | 'epicerie' | 'frais_cremerie' | 'boulangerie' | 'boissons' | 'autres';
}

export interface Recipe {
  id: string;
  title: string;
  category: 'plat' | 'entree' | 'dessert' | 'rapide';
  defaultServings: number;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  imageUrl?: string;
  ingredients: Ingredient[];
  steps: string[];
  notes?: string;
  updatedAt: string;
}

export type DayOfWeek = 'lundi' | 'mardi' | 'mercredi' | 'jeudi' | 'vendredi' | 'samedi' | 'dimanche';
export type MealType = 'midi' | 'soir';

export interface PlannedMeal {
  id: string;
  day: DayOfWeek;
  type: MealType;
  recipeId?: string;
  customTitle?: string;
  servings: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string;
  category: string;
  checked: boolean;
  isCustom?: boolean;
}

export interface AppData {
  recipes: Recipe[];
  weeklyPlan: Record<string, PlannedMeal>; // clé: `${day}_${type}`
  customShoppingItems: ShoppingItem[];
  checkedItems: Record<string, boolean>;
  lastSync?: string;
}
