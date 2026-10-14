'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/authContext';
import { supabase, isSupabaseConfigured, Message, FamilyAlert, FamilyTask } from '@/lib/supabase';
import { sendLocalNotification } from '@/lib/notifications';

function parsePollText(content: string): string | null {
  if (!content || !content.startsWith('POLL:')) return null;
  try {
    const data = JSON.parse(content.slice(5));
    return `📊 Sondage : ${data.question}`;
  } catch {
    return '📊 Nouveau sondage';
  }
}

export default function GlobalNotificationListener() {
  const { user } = useAuth();
  const profilesCache = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!isSupabaseConfigured() || !user) return;

    // 1. Précharger les noms des profils pour afficher "Laetitia : ..." au lieu d'un ID
    async function loadProfileNames() {
      const { data } = await supabase.from('profiles').select('id, full_name');
      if (data) {
        data.forEach((p) => {
          profilesCache.current[p.id] = p.full_name || 'Un membre de la famille';
        });
      }
    }
    loadProfileNames();

    // 2. Écoute globale des nouveaux messages
    const messagesChannel = supabase
      .channel('global_messages_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as Message;
          if (!newMsg || newMsg.sender_id === user.id) return;

          // Vérifier si l'utilisateur est déjà sur la conversation active visible
          const isViewingThisConv =
            typeof window !== 'undefined' &&
            !document.hidden &&
            window.location.pathname === '/messages' &&
            window.location.search.includes(`conv=${newMsg.conversation_id}`);

          if (isViewingThisConv) {
            // L'utilisateur est déjà dans la discussion active, le composant messages gère l'affichage
            return;
          }

          const senderName = profilesCache.current[newMsg.sender_id] || 'Nouveau message familial';
          const pollText = parsePollText(newMsg.content);
          const bodyText = pollText || newMsg.content;

          sendLocalNotification(senderName, {
            body: bodyText,
            url: `/messages?conv=${newMsg.conversation_id}`,
            tag: `msg-${newMsg.conversation_id}`,
            sound: true,
          });
        }
      )
      .subscribe();

    // 3. Écoute globale des nouvelles alertes familiales
    const alertsChannel = supabase
      .channel('global_alerts_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_alerts' },
        (payload) => {
          const newAlert = payload.new as FamilyAlert;
          if (!newAlert || newAlert.created_by === user.id || !newAlert.is_active) return;

          const levelEmoji =
            newAlert.level === 'urgent' ? '🔥 URGENT' : newAlert.level === 'warning' ? '⚠️ Attention' : 'ℹ️ Info';
          const title = `Alerte Familiale (${levelEmoji})`;

          sendLocalNotification(title, {
            body: newAlert.message,
            url: '/',
            tag: `alert-${newAlert.id}`,
            sound: true,
          });
        }
      )
      .subscribe();

    // 4. Écoute globale des tâches assignées
    const tasksChannel = supabase
      .channel('global_tasks_listener')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'family_tasks' },
        (payload) => {
          const newTask = payload.new as FamilyTask;
          if (!newTask || newTask.created_by === user.id) return;

          // Si assignée directement à l'utilisateur
          if (newTask.assigned_to === user.id) {
            sendLocalNotification('Nouvelle tâche assignée ! 📋', {
              body: newTask.title,
              url: '/taches',
              tag: `task-${newTask.id}`,
              sound: true,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(alertsChannel);
      supabase.removeChannel(tasksChannel);
    };
  }, [user]);

  return null;
}
