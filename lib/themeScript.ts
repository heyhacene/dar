// Fichier volontairement sans 'use client' : importé par le layout serveur.
export const THEME_STORAGE_KEY = 'dar_theme';

/**
 * Script exécuté dans <head> avant l'affichage pour éviter un flash blanc
 * au chargement quand le mode sombre est actif.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem('${THEME_STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',d?'#111318':'#ee7318');}catch(e){}})();`;
