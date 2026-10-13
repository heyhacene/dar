import { NextRequest, NextResponse } from 'next/server';
import { parseIngredientLine, parseIsoDuration, detectCategory } from '@/lib/recipeParser';
import { Recipe } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, rawText } = body;

    // CAS 1 : Import intelligent via texte copié-collé (Cookidoo, livre, etc.)
    if (rawText && typeof rawText === 'string') {
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        return NextResponse.json({ error: 'Texte vide' }, { status: 400 });
      }

      let title = lines[0];
      let servings = 4;
      let prepTime = 15;
      let cookTime = 25;
      const ingredients: any[] = [];
      const steps: string[] = [];

      let currentSection: 'header' | 'ingredients' | 'steps' = 'header';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // Détection de portions
        const servMatch = line.match(/(\d+)\s*(?:portions|personnes|pers)/i);
        if (servMatch) {
          servings = parseInt(servMatch[1], 10);
          continue;
        }

        // Détection de temps
        const timeMatch = line.match(/(?:temps|préparation|cuisson)[\s:]+(\d+)\s*(?:min|h)/i);
        if (timeMatch) {
          prepTime = parseInt(timeMatch[1], 10);
          continue;
        }

        // Bascule de section
        if (lower.includes('ingrédient') || lower.includes('ingredients')) {
          currentSection = 'ingredients';
          continue;
        }
        if (lower.includes('préparation') || lower.includes('etape') || lower.includes('instructions') || lower.includes('étapes')) {
          currentSection = 'steps';
          continue;
        }

        if (currentSection === 'ingredients') {
          // Si la ligne ressemble à une étape
          if (/^(étape|\d+[\.)]|\bpréchauffer\b|\bmettre\b|\binsérer\b|\bmélanger\b)/i.test(line)) {
            currentSection = 'steps';
            steps.push(line.replace(/^\d+[\.)]\s*/, ''));
          } else {
            ingredients.push(parseIngredientLine(line));
          }
        } else if (currentSection === 'steps') {
          steps.push(line.replace(/^\d+[\.)]\s*/, ''));
        } else {
          // Tant qu'on n'est pas dans une section explicite, tenter de deviner
          if (line.match(/^([\d¼½¾.,\s]+)?\s*(g|kg|ml|cl|l|c\.|cas|cac|pincée)/i) || line.startsWith('-')) {
            ingredients.push(parseIngredientLine(line));
          } else {
            steps.push(line);
          }
        }
      }

      const importedRecipe: Partial<Recipe> = {
        title: title || 'Recette importée',
        category: 'plat',
        defaultServings: servings,
        prepTimeMinutes: prepTime,
        cookTimeMinutes: cookTime,
        ingredients: ingredients.length > 0 ? ingredients : [parseIngredientLine('Ingrédient à préciser')],
        steps: steps.length > 0 ? steps : ['Suivre les instructions'],
        notes: 'Importé depuis Cookidoo / Texte',
      };

      return NextResponse.json({ success: true, recipe: importedRecipe });
    }

    // CAS 2 : Import via URL (Cookidoo, Marmiton, 750g, etc.)
    if (url && typeof url === 'string') {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          if (url.includes('cookidoo')) {
            return NextResponse.json(
              {
                error:
                  'Cookidoo bloque les accès web directs pour protéger ses recettes privées. Utilisez simplement l’onglet "Copier-Coller" : sélectionnez le texte sur Cookidoo et collez-le ici !',
              },
              { status: 422 }
            );
          }
          throw new Error('Erreur de chargement de la page');
        }

        const html = await response.text();

        // Extraction des données structurées schema.org/Recipe
        const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
        let recipeData: any = null;

        if (jsonLdMatches) {
          for (const match of jsonLdMatches) {
            try {
              const cleanJson = match.replace(/<\/?script[^>]*>/gi, '').trim();
              const parsed = JSON.parse(cleanJson);
              const items = Array.isArray(parsed) ? parsed : [parsed];
              for (const item of items) {
                if (item['@type'] === 'Recipe' || (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
                  recipeData = item;
                  break;
                }
                if (item['@graph']) {
                  const graphRecipe = item['@graph'].find(
                    (g: any) => g['@type'] === 'Recipe' || (Array.isArray(g['@type']) && g['@type'].includes('Recipe'))
                  );
                  if (graphRecipe) {
                    recipeData = graphRecipe;
                    break;
                  }
                }
              }
              if (recipeData) break;
            } catch (e) {
              // Ignore invalid JSON-LD
            }
          }
        }

        if (!recipeData) {
          return NextResponse.json(
            {
              error:
                'Impossible d’extraire automatiquement les données de cette page. Utilisez l’onglet "Copier-Coller" pour importer le texte directement.',
            },
            { status: 422 }
          );
        }

        // Transformation des données Schema.org en format Dar
        const ingredients = Array.isArray(recipeData.recipeIngredient)
          ? recipeData.recipeIngredient.map((line: string) => parseIngredientLine(line))
          : [];

        const steps: string[] = [];
        if (Array.isArray(recipeData.recipeInstructions)) {
          recipeData.recipeInstructions.forEach((inst: any) => {
            if (typeof inst === 'string') steps.push(inst);
            else if (inst.text) steps.push(inst.text);
          });
        }

        let servings = 4;
        if (recipeData.recipeYield) {
          const yieldMatch = String(recipeData.recipeYield).match(/\d+/);
          if (yieldMatch) servings = parseInt(yieldMatch[0], 10);
        }

        let imageUrl: string | undefined = undefined;
        if (recipeData.image) {
          if (typeof recipeData.image === 'string') imageUrl = recipeData.image;
          else if (Array.isArray(recipeData.image) && recipeData.image[0]) imageUrl = recipeData.image[0];
          else if (recipeData.image.url) imageUrl = recipeData.image.url;
        }

        const importedRecipe: Partial<Recipe> = {
          title: recipeData.name || 'Recette importée',
          category: 'plat',
          defaultServings: servings,
          prepTimeMinutes: parseIsoDuration(recipeData.prepTime),
          cookTimeMinutes: parseIsoDuration(recipeData.cookTime),
          imageUrl,
          ingredients: ingredients.length > 0 ? ingredients : [parseIngredientLine('Ingrédient à préciser')],
          steps: steps.length > 0 ? steps : ['Suivre les étapes indiquées sur la source'],
          notes: `Importé depuis : ${url}`,
        };

        return NextResponse.json({ success: true, recipe: importedRecipe });
      } catch (err) {
        return NextResponse.json(
          { error: 'Échec de l’importation de cette URL. Utilisez le mode Copier-Coller.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Fournissez une URL ou du texte brut.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur lors de l’importation.' }, { status: 500 });
  }
}
