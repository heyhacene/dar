'use client';

import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Profile } from '@/lib/supabase';
import { Users, UserPlus, CheckCircle, XCircle, Shield, LogOut, MessageSquare, Clock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function FamillePage() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Formulaire d'ajout direct par l'Admin
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMembers(data as Profile[]);
    } catch (err: any) {
      console.error(err);
      setError('Impossible de charger la liste des membres.');
    } finally {
      setLoading(false);
    }
  }

  // Valider ou refuser un membre en attente (Admin seulement)
  async function handleUpdateStatus(userId: string, newStatus: 'approved' | 'rejected') {
    setError(null);
    setActionSuccess(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setActionSuccess(newStatus === 'approved' ? 'Membre approuvé avec succès !' : 'Demande refusée.');
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la mise à jour.');
    }
  }

  // Création directe d'un membre par l'Admin
  async function handleCreateMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setActionSuccess(null);
    setAddingUser(true);

    try {
      // Inscription via Supabase Auth
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: newEmail.trim(),
        password: newPassword,
        options: {
          data: { full_name: newFullName.trim() },
        },
      });

      if (signUpErr) throw signUpErr;

      // Approuver immédiatement ce compte créé par l'admin
      if (data.user) {
        await supabase
          .from('profiles')
          .update({ status: 'approved' })
          .eq('id', data.user.id);
      }

      setActionSuccess(`Le compte de ${newFullName} a été créé et approuvé !`);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setShowAddForm(false);
      fetchMembers();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du compte.');
    } finally {
      setAddingUser(false);
    }
  }

  // Démarrer une conversation privée
  async function handleStartDirectChat(targetUser: Profile) {
    if (!user) return;
    try {
      // Vérifier si une conversation existe déjà
      const { data: convs } = await supabase
        .from('conversations')
        .select('id, is_group, conversation_participants!inner(user_id)')
        .eq('is_group', false);

      const existing = convs?.find((c: any) =>
        c.conversation_participants?.some((p: any) => p.user_id === targetUser.id)
      );

      if (existing) {
        router.push(`/messages?conv=${existing.id}`);
        return;
      }

      // Créer une nouvelle conversation privée
      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({ is_group: false, created_by: user.id })
        .select()
        .single();

      if (convErr) throw convErr;

      // Ajouter les deux participants
      await supabase.from('conversation_participants').insert([
        { conversation_id: newConv.id, user_id: user.id },
        { conversation_id: newConv.id, user_id: targetUser.id },
      ]);

      router.push(`/messages?conv=${newConv.id}`);
    } catch (err: any) {
      console.error(err);
      router.push('/messages');
    }
  }

  const pendingMembers = members.filter((m) => m.status === 'pending');
  const approvedMembers = members.filter((m) => m.status === 'approved');

  return (
    <div className="pb-32">
      <Header title="Membres de la Famille" />

      <div className="p-4 space-y-6">
        {/* MON COMPTE & DÉCONNEXION */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-500 to-amber-500 text-white font-black text-lg flex items-center justify-center shadow-sm">
              {profile?.full_name ? profile.full_name[0].toUpperCase() : 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900 text-sm">
                  {profile?.full_name || 'Utilisateur'}
                </span>
                {isAdmin && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">{user?.email || profile?.email}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            title="Se déconnecter"
            className="p-2 text-gray-400 hover:text-red-600 rounded-xl hover:bg-red-50 transition"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* MESSAGES D'ACTION */}
        {actionSuccess && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* SECTION ADMIN : DEMANDES EN ATTENTE */}
        {isAdmin && pendingMembers.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-amber-900 text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Demandes d'accès en attente ({pendingMembers.length})</span>
              </h2>
            </div>
            <p className="text-xs text-amber-700">
              Ces personnes ont demandé à rejoindre l'espace familial. Validez leur accès pour leur ouvrir le site :
            </p>

            <div className="space-y-2 mt-2">
              {pendingMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-3 border border-amber-200/80 flex items-center justify-between shadow-xs"
                >
                  <div>
                    <h3 className="font-bold text-xs text-gray-900">{m.full_name}</h3>
                    <p className="text-[11px] text-gray-500">{m.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleUpdateStatus(m.id, 'approved')}
                      className="px-3 py-1.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 transition flex items-center gap-1 shadow-xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Valider</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(m.id, 'rejected')}
                      className="px-2.5 py-1.5 bg-gray-100 text-gray-600 font-bold rounded-xl text-xs hover:bg-red-50 hover:text-red-700 transition flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Refuser</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION ADMIN : CRÉER UN MEMBRE DIRECTEMENT */}
        {isAdmin && (
          <div className="bg-white rounded-3xl border border-gray-100 p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-primary-600" />
                <h2 className="font-bold text-gray-900 text-sm">Ajouter un membre de la famille</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs font-bold text-primary-600 hover:text-primary-700"
              >
                {showAddForm ? 'Fermer' : '+ Nouveau compte'}
              </button>
            </div>

            {showAddForm && (
              <form onSubmit={handleCreateMember} className="space-y-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Prénom & Nom
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="Ex: Hacene Otsmane"
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Adresse email
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="email@famille.fr"
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Mot de passe initial
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 caractères"
                      className="w-full pl-3 pr-10 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 transition"
                      title={showNewPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                    >
                      {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs shadow-sm transition disabled:opacity-50"
                >
                  {addingUser ? 'Création en cours...' : 'Créer et valider ce membre'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* LISTE DES MEMBRES ACTIFS */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-600" />
            <span>Membres de la famille ({approvedMembers.length})</span>
          </h2>

          <div className="space-y-2">
            {approvedMembers.map((m) => {
              const isMe = m.id === user?.id;
              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl p-3.5 border border-gray-100 flex items-center justify-between shadow-xs hover:border-gray-200 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-sm">
                      {m.full_name ? m.full_name[0].toUpperCase() : 'M'}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-gray-900">{m.full_name}</span>
                        {isMe && <span className="text-[10px] text-gray-400">(Vous)</span>}
                        {m.role === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800">
                            Admin
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-400">{m.email}</span>
                    </div>
                  </div>

                  {!isMe && (
                    <button
                      onClick={() => handleStartDirectChat(m)}
                      title="Envoyer un message privé"
                      className="p-2 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-xl transition"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
