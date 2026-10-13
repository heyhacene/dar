'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { loadLocalData, saveLocalData } from '@/lib/storage';
import { AppData } from '@/types';
import { Cloud, Download, Upload, ShieldCheck, Palette, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '@/lib/theme';

export default function SettingsPage() {
  const [data, setData] = useState<AppData | null>(null);
  const { preference, setPreference } = useTheme();

  useEffect(() => {
    setData(loadLocalData());
  }, []);

  function handleExport() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sauvegarde-repas-famille-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        saveLocalData(parsed);
        setData(parsed);
        alert('Sauvegarde restaurée avec succès !');
      } catch (err) {
        alert('Fichier JSON invalide');
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="pb-32">
      <Header title="Paramètres & Synchronisation" />

      <div className="p-4 space-y-4">
        {/* Apparence */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-sm text-gray-900">Apparence</h2>
          </div>
          <div className="grid grid-cols-3 p-1 bg-gray-100 rounded-2xl text-xs font-bold">
            {(
              [
                { value: 'light', label: 'Clair', Icon: Sun },
                { value: 'dark', label: 'Sombre', Icon: Moon },
                { value: 'system', label: 'Auto', Icon: Monitor },
              ] as const
            ).map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setPreference(value)}
                className={`py-2 rounded-xl transition flex items-center justify-center gap-1.5 ${
                  preference === value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">« Auto » suit le réglage clair/sombre de votre téléphone.</p>
        </div>

        {/* Statut Stockage */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-primary-600" />
            <h2 className="font-bold text-sm text-gray-900">Synchronisation des données</h2>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">
            Vos recettes, plannings et courses sont conservés en local sur votre appareil et peuvent être synchronisés avec Google Drive / Google Sheets.
          </p>
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2 text-emerald-800 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Stockage local actif (prêt pour Vercel)</span>
          </div>
        </div>

        {/* Export / Import JSON */}
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs space-y-3">
          <h2 className="font-bold text-sm text-gray-900">Sauvegarde manuelle (JSON)</h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleExport}
              className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
            >
              <Download className="w-4 h-4" /> Exporter
            </button>

            <label className="py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer transition">
              <Upload className="w-4 h-4" /> Importer
              <input type="file" accept=".json" onChange={handleImport} className="hidden" />
            </label>
          </div>
        </div>

        {/* Réinitialisation du planning et des courses */}
        <div className="bg-white p-4 rounded-2xl border border-red-100 shadow-xs space-y-2">
          <h2 className="font-bold text-sm text-gray-900">Nettoyage des données</h2>
          <p className="text-xs text-gray-500">
            Remettre à zéro le planning de la semaine et la liste de courses en un clic (vos recettes sont conservées).
          </p>
          <button
            onClick={() => {
              if (confirm('Voulez-vous vraiment vider tout le planning et toute la liste de courses ?')) {
                const updated = {
                  ...data!,
                  weeklyPlan: {},
                  customShoppingItems: [],
                  checkedItems: {},
                };
                saveLocalData(updated);
                setData(updated);
                alert('Planning et liste de courses vidés !');
              }
            }}
            className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
          >
            Vider le planning & la liste de courses
          </button>
        </div>

        {/* Notice PWA Smartphone */}
        <div className="bg-orange-50/70 p-4 rounded-2xl border border-orange-100 space-y-2">
          <h3 className="font-bold text-xs text-primary-900">📱 Installer sur smartphone (PWA)</h3>
          <p className="text-xs text-gray-600 leading-relaxed">
            • <strong>Sur iPhone (Safari) :</strong> Touchez le bouton Partage puis <em>"Sur l'écran d'accueil"</em>.<br />
            • <strong>Sur Android (Chrome) :</strong> Touchez les 3 points verticaux puis <em>"Installer l'application"</em>.
          </p>
        </div>
      </div>
    </div>
  );
}
