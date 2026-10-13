import { NextRequest, NextResponse } from 'next/server';
import { parseIngredientLine, parseIsoDuration } from '@/lib/recipeParser';
import { Recipe } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawInput = (body.url || body.rawText || '').trim();

    if (!rawInput) {
      return NextResponse.json({ error: 'Veuillez coller un lien ou le texte d’une recette.' }, { status: 400 });
    }

    const urlMatch = rawInput.match(/https?:\/\/[^\s]+/i);
    const isUrl = Boolean(urlMatch && rawInput.length < 500);
    const targetUrl = urlMatch ? urlMatch[0] : '';

    // CAS 1 : Import via URL (Marmiton, 750g, blogs, Cookidoo web...)
    if (isUrl && targetUrl) {
      try {
        const response = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        if (!response.ok) {
          if (targetUrl.includes('cookidoo')) {
            return NextResponse.json(
              {
                error:
                  'Cookidoo bloque l’accès automatique aux serveurs distants. Astuce : sur Cookidoo, touchez Partager > Partager vers Notes ou WhatsApp, puis copiez et collez le texte ici !',
              },
              { status: 422 }
            );
          }
          throw new Error('Impossible de charger cette page web.');
        }

        const html = await response.text();

        // Recherche du schéma de recette Schema.org
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
              // Ignore invalid JSON
            }
          }
        }

        if (recipeData) {
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
            steps: steps.length > 0 ? steps : ['Suivre les étapes de préparation'],
            notes: `Lien source : ${targetUrl}`,
          };

          return NextResponse.json({ success: true, recipe: importedRecipe });
        }
      } catch (err) {
        // En cas d'échec du fetch URL, basculer vers le parsing texte si disponible
      }
    }

    // CAS 2 : Découpage intelligent du texte brut (Thermomix, Cookidoo copié, etc.)
    const lines = rawInput.split('\n').map((l: string) => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      let title = lines[0].replace(/https?:\/\/[^\s]+/gi, '').trim();
      if (!title && lines.length > 1) title = lines[1];

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

        // Changement de section
        if (lower.includes('ingrédient') || lower.includes('ingredients')) {
          currentSection = 'ingredients';
          continue;
        }
        if (lower.includes('préparation') || lower.includes('instructions') || lower.includes('étapes') || lower.includes('etape')) {
          currentSection = 'steps';
          continue;
        }

        if (currentSection === 'ingredients') {
          if (/^(étape|\d+[\.)]|\bpréchauffer\b|\bmettre\b|\binsérer\b|\bmélanger\b)/i.test(line)) {
            currentSection = 'steps';
            steps.push(line.replace(/^\d+[\.)]\s*/, ''));
          } else {
            ingredients.push(parseIngredientLine(line));
          }
        } else if (currentSection === 'steps') {
          steps.push(line.replace(/^\d+[\.)]\s*/, ''));
        } else {
          if (line.match(/^([\d¼½¾.,\s]+)?\s*(g|kg|ml|cl|l|c\.|cas|cac|pincée)/i) || line.startsWith('-')) {
            ingredients.push(parseIngredientLine(line));
          } else {
            steps.push(line);
          }
        }
      }

      const importedRecipe: Partial<Recipe> = {
        title: title || 'Recette Thermomix',
        category: 'plat',
        defaultServings: servings,
        prepTimeMinutes: prepTime,
        cookTimeMinutes: cookTime,
        ingredients: ingredients.length > 0 ? ingredients : [parseIngredientLine('Ingrédient à vérifier')],
        steps: steps.length > 0 ? steps : ['Suivre la recette'],
        notes: 'Importé depuis Cookidoo / Texte',
      };

      return NextResponse.json({ success: true, recipe: importedRecipe });
    }

    return NextResponse.json({ error: 'Impossible de lire cette recette.' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur lors de l’analyse de la recette.' }, { status: 500 });
  }
}
