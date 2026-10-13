'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Header from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Message, Conversation, Profile } from '@/lib/supabase';
import { Send, ArrowLeft, Plus, Users, User, MessageCircle, Clock, Smile } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

function MessagesContent() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const initialConvId = searchParams.get('conv');

  useEffect(() => {
    if (!authLoading && !user && isSupabaseConfigured()) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  // Modal nouveau groupe / DM
  const [showNewModal, setShowNewModal] = useState(false);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Charger la liste des profils
  useEffect(() => {
    async function loadProfiles() {
      if (!isSupabaseConfigured()) return;
      const { data } = await supabase.from('profiles').select('*').eq('status', 'approved');
      if (data) {
        const map: Record<string, Profile> = {};
        data.forEach((p) => {
          map[p.id] = p;
        });
        setProfilesMap(map);
        setAllProfiles(data);
      }
    }
    loadProfiles();
  }, []);

  // Charger les conversations
  useEffect(() => {
    async function loadConversations() {
      if (!isSupabaseConfigured() || !user) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        // Conversations de l'utilisateur
        const { data: participations, error } = await supabase
          .from('conversation_participants')
          .select('conversation_id, conversations(*)')
          .eq('user_id', user.id);

        if (error) throw error;

        const convList: Conversation[] = (participations || [])
          .map((p: any) => p.conversations)
          .filter(Boolean);

        setConversations(convList);

        if (initialConvId) {
          const found = convList.find((c) => c.id === initialConvId);
          if (found) setActiveConv(found);
        } else if (convList.length > 0 && !activeConv) {
          // Par défaut, ouvrir "Toute la Famille" ou la première conversation si sur grand écran
        }
      } catch (err) {
        console.error('Erreur conversations:', err);
      } finally {
        setLoading(false);
      }
    }

    loadConversations();
  }, [user, initialConvId]);

  // Charger les messages et abonnement en temps réel quand une conversation est sélectionnée
  useEffect(() => {
    if (!activeConv || !isSupabaseConfigured()) return;
    const convId = activeConv.id;

    async function fetchMessages() {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data as Message[]);
      }
    }

    fetchMessages();

    // ÉCOUTE EN TEMPS RÉEL (REALTIME SUPABASE)
    const channel = supabase
      .channel(`chat_${convId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeConv]);

  // Défilement automatique vers le bas
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Envoi d'un message
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessageText.trim() || !activeConv || !user) return;

    const text = newMessageText.trim();
    setNewMessageText('');

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        content: text,
      });

      if (error) {
        console.error('Erreur envoi message:', error);
      }
    } catch (err) {
      console.error(err);
    }
  }

  // Création d'une nouvelle conversation (DM ou Groupe)
  async function handleCreateConversation() {
    if (!user || selectedUserIds.length === 0) return;

    try {
      const isGroup = selectedUserIds.length > 1 || Boolean(groupName.trim());
      const name = isGroup ? (groupName.trim() || 'Nouveau groupe') : null;

      const { data: newConv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          name,
          is_group: isGroup,
          created_by: user.id,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      // Ajouter tous les participants + soi-même
      const participantsToAdd = Array.from(new Set([...selectedUserIds, user.id])).map((uid) => ({
        conversation_id: newConv.id,
        user_id: uid,
      }));

      await supabase.from('conversation_participants').insert(participantsToAdd);

      setConversations((prev) => [newConv, ...prev]);
      setActiveConv(newConv);
      setShowNewModal(false);
      setSelectedUserIds([]);
      setGroupName('');
    } catch (err) {
      console.error(err);
    }
  }

  // Obtenir le titre d'affichage d'une conversation
  function getConvTitle(c: Conversation): string {
    if (c.name) return c.name;
    // Si c'est un message direct, trouver le nom de l'autre personne
    return 'Message privé';
  }

  // --- VUE 1 : DANS UNE CONVERSATION (CHAT ROOM) ---
  if (activeConv) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] max-w-lg mx-auto bg-gray-50">
        {/* EN-TÊTE DE LA CONVERSATION */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-xs sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveConv(null)}
              className="p-1.5 -ml-1 text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs">
              {activeConv.is_group ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-gray-900 leading-tight">
                {getConvTitle(activeConv)}
              </h2>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                En direct
              </span>
            </div>
          </div>
        </div>

        {/* LISTE DES MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
          {messages.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              Aucun message pour l'instant. Dites bonjour ! 👋
            </div>
          ) : (
            messages.map((m) => {
              const isMine = m.sender_id === user?.id;
              const sender = profilesMap[m.sender_id];
              const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  {!isMine && (
                    <span className="text-[11px] font-bold text-gray-500 mb-0.5 ml-2">
                      {sender?.full_name || 'Membre'}
                    </span>
                  )}
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm shadow-xs break-words ${
                      isMine
                        ? 'bg-primary-600 text-white rounded-br-xs'
                        : 'bg-white text-gray-900 border border-gray-100 rounded-bl-xs'
                    }`}
                  >
                    <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    <div
                      className={`text-[9px] mt-1 text-right ${
                        isMine ? 'text-orange-100' : 'text-gray-400'
                      }`}
                    >
                      {timeStr}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* BARRE DE SAISIE */}
        <form
          onSubmit={handleSendMessage}
          className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto bg-white/95 backdrop-blur-md border-t border-gray-200 p-2.5 flex items-center gap-2 z-40"
        >
          <input
            type="text"
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Écrivez un message..."
            className="flex-1 px-4 py-2.5 rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50/70"
          />
          <button
            type="submit"
            disabled={!newMessageText.trim()}
            className="p-2.5 bg-primary-600 text-white rounded-full hover:bg-primary-700 active:bg-primary-800 transition disabled:opacity-40 shadow-xs"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // --- VUE 2 : LISTE DES CONVERSATIONS ---
  return (
    <div className="pb-32">
      <Header title="Messagerie Familiale" />

      <div className="p-4 space-y-4">
        {/* BANNIÈRE NOUVELLE CONVERSATION */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Vos conversations</h2>
            <p className="text-xs text-gray-500">Discussions de groupe et messages privés</p>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="py-2 px-3.5 bg-primary-600 text-white font-bold rounded-xl text-xs hover:bg-primary-700 transition flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau chat</span>
          </button>
        </div>

        {/* LISTE DES CONVERSATIONS */}
        {loading ? (
          <div className="text-center py-10 text-gray-400 text-xs">Chargement des messages...</div>
        ) : conversations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-8 text-center space-y-3">
            <MessageCircle className="w-10 h-10 text-primary-400 mx-auto" />
            <h3 className="font-bold text-sm text-gray-900">Aucune discussion pour le moment</h3>
            <p className="text-xs text-gray-500">
              Créez une discussion avec la famille ou envoyez un message privé à un membre.
            </p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-2 py-2 px-4 bg-primary-600 text-white font-bold rounded-xl text-xs"
            >
              Démarrer une discussion
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveConv(c)}
                className="w-full text-left bg-white rounded-2xl p-3.5 border border-gray-100 hover:border-orange-200 transition shadow-xs flex items-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-100 text-primary-700 flex items-center justify-center flex-shrink-0 font-bold">
                  {c.is_group ? <Users className="w-6 h-6" /> : <User className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-gray-900 truncate">
                      {getConvTitle(c)}
                    </h3>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    Ouvrir la conversation en temps réel...
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MODAL NOUVELLE CONVERSATION */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white">
              <h3 className="font-bold text-base text-gray-900">Nouvelle discussion</h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-700 p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
              {/* CHOIX DES MEMBRES */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-2">
                  Sélectionnez les membres à inviter :
                </label>
                <div className="max-h-48 overflow-y-auto space-y-1.5 border border-gray-100 rounded-2xl p-2">
                  {allProfiles
                    .filter((p) => p.id !== user?.id)
                    .map((p) => {
                      const isSelected = selectedUserIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedUserIds((prev) =>
                              isSelected ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition ${
                            isSelected ? 'bg-primary-50 text-primary-700 font-bold' : 'hover:bg-gray-50'
                          }`}
                        >
                          <span>{p.full_name}</span>
                          <span className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300'
                          }`}>
                            {isSelected && '✓'}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* NOM DU GROUPE (SI PLUSIEURS MEMBRES) */}
              {selectedUserIds.length > 1 && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nom du groupe (optionnel) :
                  </label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Ex: Les Vacances, Projet travaux..."
                    className="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="p-3.5 bg-gray-50 border-t border-gray-100 flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={selectedUserIds.length === 0}
                onClick={handleCreateConversation}
                className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-xs font-bold hover:bg-primary-700 transition disabled:opacity-40 shadow-sm"
              >
                Démarrer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-gray-400">
          Chargement de la messagerie...
        </div>
      }
    >
      <MessagesContent />
    </Suspense>
  );
}
