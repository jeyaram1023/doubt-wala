import { supabase } from './config.js';

class RealtimeManager {
  constructor() {
    this.channels = [];
  }

  subscribeToQuestions({ onInsert, onUpdate, onDelete, onConnected }) {
    const channel = supabase.channel('public:questions');
    
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, (payload) => {
        console.log('New question received:', payload.new);
        onInsert(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, (payload) => {
        console.log('Question updated:', payload.new);
        onUpdate(payload.new, payload.old);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'questions' }, (payload) => {
        console.log('Question deleted:', payload.old);
        onDelete(payload.old);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          onConnected();
        }
      });
      
    this.channels.push(channel);
    return channel;
  }

  unsubscribeAll() {
    this.channels.forEach(channel => supabase.removeChannel(channel));
    this.channels = [];
  }
}

export const realtimeManager = new RealtimeManager();
