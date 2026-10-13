'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, User, AlertCircle, ArrowRight, ShieldCheck, Clock, CheckCircle2, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import Logo from '@/components/Logo';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const { refreshProfile, user, isApproved } = useAuth();
  const { isDark, toggle } = useTheme();
  const [mode, setMode] = useState<'login' | 'register'>('login');

  useEffect(() => {
    if (user && isApproved) {
      router.push('/messages');
    }
  }, [user, isApproved, router]);
  
  // Champs formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // États de feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingNotice, setPendingNotice] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const supabaseReady = isSupabaseConfigured();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setPendingNotice(false);
    setLoading(true);

    if (!supabaseReady) {
      // Mode de secours si Supabase n'est pas encore configuré
      if (password === 'famille2025' || password === 'dar') {
        router.push('/planning');
        return;
      }
      setError("Supabase n'est pas encore configuré. Renseignez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY sur Vercel.");
      setLoading(false);
      return;
    }

    try {
      if (mode === 'register') {
        // Demande d'inscription
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
          },
        });

        if (signUpErr) throw signUpErr;

        if (data.user) {
          // Vérifier son profil créé par le trigger SQL
          const { data: prof } = await supabase
            .from('profiles')
            .select('status, role')
            .eq('id', data.user.id)
            .single();

          if (prof?.status === 'approved') {
            // C'est le tout premier utilisateur (Admin) !
            await refreshProfile();
            router.push('/messages');
          } else {
            // Membre standard en attente
            setPendingNotice(true);
            setSuccessMsg("Votre inscription a été envoyée ! Un administrateur doit valider votre accès.");
          }
        }
      } else {
        // Connexion
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInErr) throw signInErr;

        if (data.user) {
          // Vérification du statut du membre
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('status, role')
            .eq('id', data.user.id)
            .single();

          if (prof?.status === 'pending') {
            setPendingNotice(true);
            setLoading(false);
            return;
          }

          if (prof?.status === 'rejected') {
            setError("Votre demande d'accès a été refusée par l'administrateur.");
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }

          await refreshProfile();
          router.push('/messages');
        }
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Email not confirmed')) {
        setError(
          "L'adresse e-mail n'a pas encore été confirmée. Vérifiez vos e-mails (et spams), ou l'administrateur peut la valider en 1 clic dans Supabase (Authentication > Users > Confirm user)."
        );
      } else if (msg.includes('Invalid login credentials')) {
        setError("Adresse email ou mot de passe incorrect.");
      } else {
        setError(msg || 'Une erreur est survenue lors de la connexion.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-5 py-10 bg-gradient-to-b from-orange-50/50 via-white to-gray-50 relative">
      {/* BOUTON THÈME */}
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggle}
          className={`p-2.5 rounded-2xl transition flex items-center gap-1.5 shadow-xs border ${
            isDark
              ? 'bg-gray-800 text-amber-300 border-gray-700 hover:bg-gray-700'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:text-primary-600'
          }`}
          title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
          aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
        >
          {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Logo className="w-16 h-16 mx-auto mb-3 shadow-lg shadow-orange-500/20" size={64} />
        <h1 className="text-2xl font-black text-gray-900 tracking-tight">Dar</h1>
        <p className="mt-1 text-sm text-gray-500">
          L'espace partagé de notre famille
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-7 px-6 shadow-sm border border-gray-100 rounded-3xl">
          {/* SÉLECTEUR CONNEXION / INSCRIPTION */}
          <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-2xl mb-6 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setPendingNotice(false);
              }}
              className={`py-2 rounded-xl transition ${
                mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Se connecter
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
                setPendingNotice(false);
              }}
              className={`py-2 rounded-xl transition ${
                mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Créer un compte
            </button>
          </div>

          {/* MESSAGE EN ATTENTE DE VALIDATION */}
          {pendingNotice && (
            <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-800">
                <Clock className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>Compte en attente de validation</span>
              </div>
              <p className="text-xs text-amber-700 leading-relaxed">
                Votre compte a bien été créé ! Pour des raisons de sécurité familiale, un administrateur doit approuver votre accès. Vous pourrez vous connecter dès que l'approbation sera faite.
              </p>
            </div>
          )}

          {/* NOTIFICATION SUCCÈS */}
          {successMsg && !pendingNotice && (
            <div className="mb-5 p-3 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-emerald-800 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ERREURS */}
          {error && (
            <div className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Prénom & Nom
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Sarah Otsmane"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Adresse email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@exemple.com"
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Mot de passe personnel
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 6 caractères' : 'Votre mot de passe'}
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition"
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white font-bold rounded-xl shadow-md shadow-orange-500/20 transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
            >
              {loading ? (
                'Veuillez patienter...'
              ) : mode === 'login' ? (
                <>
                  <span>Connexion</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Demander l'accès à Dar</span>
                </>
              )}
            </button>
          </form>

          {/* NOTE DE SÉCURITÉ */}
          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
            <p className="text-[11px] text-gray-400">
              Accès strictement réservé aux membres de la famille Otsmane.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
