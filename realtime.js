
// Real-time functionality using Supabase Realtime

class RealtimeManager {
  constructor() {
    this.subscriptions = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  // Subscribe to questions table changes
  subscribeToQuestions(callbacks) {
    const subscription = supabase
      .channel('questions-channel')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'questions' 
        }, 
        (payload) => {
          console.log('New question:', payload.new);
          if (callbacks.onInsert) callbacks.onInsert(payload.new);
        }
      )
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'questions' 
        }, 
        (payload) => {
          console.log('Question updated:', payload.new);
          if (callbacks.onUpdate) callbacks.onUpdate(payload.new, payload.old);
        }
      )
      .on('postgres_changes', 
        { 
          event: 'DELETE', 
          schema: 'public', 
          table: 'questions' 
        }, 
        (payload) => {
          console.log('Question deleted:', payload.old);
          if (callbacks.onDelete) callbacks.onDelete(payload.old);
        }
      )
      .subscribe((status) => {
        console.log('Questions subscription status:', status);
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
          if (callbacks.onConnected) callbacks.onConnected();
        }
      });

    this.subscriptions.set('questions', subscription);
    return subscription;
  }

  // Subscribe to answers table changes
  subscribeToAnswers(questionId, callbacks) {
    const channelName = questionId ? `answers-${questionId}` : 'answers-channel';
    
    let channel = supabase.channel(channelName);
    
    if (questionId) {
      // Subscribe to answers for a specific question
      channel = channel
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'answers',
            filter: `question_id=eq.${questionId}`
          }, 
          (payload) => {
            console.log('New answer:', payload.new);
            if (callbacks.onInsert) callbacks.onInsert(payload.new);
          }
        )
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'answers',
            filter: `question_id=eq.${questionId}`
          }, 
          (payload) => {
            console.log('Answer updated:', payload.new);
            if (callbacks.onUpdate) callbacks.onUpdate(payload.new, payload.old);
          }
        )
        .on('postgres_changes', 
          { 
            event: 'DELETE', 
            schema: 'public', 
            table: 'answers',
            filter: `question_id=eq.${questionId}`
          }, 
          (payload) => {
            console.log('Answer deleted:', payload.old);
            if (callbacks.onDelete) callbacks.onDelete(payload.old);
          }
        );
    } else {
      // Subscribe to all answers
      channel = channel
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'answers' 
          }, 
          (payload) => {
            console.log('New answer:', payload.new);
            if (callbacks.onInsert) callbacks.onInsert(payload.new);
          }
        )
        .on('postgres_changes', 
          { 
            event: 'UPDATE', 
            schema: 'public', 
            table: 'answers' 
          }, 
          (payload) => {
            console.log('Answer updated:', payload.new);
            if (callbacks.onUpdate) callbacks.onUpdate(payload.new, payload.old);
          }
        )
        .on('postgres_changes', 
          { 
            event: 'DELETE', 
            schema: 'public', 
            table: 'answers' 
          }, 
          (payload) => {
            console.log('Answer deleted:', payload.old);
            if (callbacks.onDelete) callbacks.onDelete(payload.old);
          }
        );
    }

    const subscription = channel.subscribe((status) => {
      console.log('Answers subscription status:', status);
      if (status === 'SUBSCRIBED') {
        this.reconnectAttempts = 0;
        if (callbacks.onConnected) callbacks.onConnected();
      }
    });

    this.subscriptions.set(channelName, subscription);
    return subscription;
  }

  // Subscribe to votes table changes
  subscribeToVotes(callbacks) {
    const subscription = supabase
      .channel('votes-channel')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'votes' 
        }, 
        (payload) => {
          console.log('Vote change:', payload);
          if (callbacks.onVoteChange) callbacks.onVoteChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('Votes subscription status:', status);
        if (status === 'SUBSCRIBED') {
          this.reconnectAttempts = 0;
          if (callbacks.onConnected) callbacks.onConnected();
        }
      });

    this.subscriptions.set('votes', subscription);
    return subscription;
  }

  // Unsubscribe from a specific channel
  unsubscribe(channelName) {
    const subscription = this.subscriptions.get(channelName);
    if (subscription) {
      supabase.removeChannel(subscription);
      this.subscriptions.delete(channelName);
      console.log(`Unsubscribed from ${channelName}`);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    for (const [channelName, subscription] of this.subscriptions) {
      supabase.removeChannel(subscription);
      console.log(`Unsubscribed from ${channelName}`);
    }
    this.subscriptions.clear();
  }

  // Handle reconnection
  async handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    // Wait before reconnecting
    await new Promise(resolve => 
      setTimeout(resolve, CONFIG.REALTIME_RECONNECT_DELAY * this.reconnectAttempts)
    );

    // Resubscribe to all channels
    const channelNames = Array.from(this.subscriptions.keys());
    this.unsubscribeAll();

    // This would need to be customized based on the specific callbacks
    // For now, just log the attempt
    console.log('Reconnection logic would be implemented here');
  }

  // Get connection status
  getConnectionStatus() {
    return supabase.realtime.connection_state;
  }

  // Check if connected
  isConnected() {
    return this.getConnectionStatus() === 'open';
  }
}

// Create global instance
const realtimeManager = new RealtimeManager();

// Handle connection state changes
supabase.realtime.onOpen(() => {
  console.log('Realtime connection opened');
  realtimeManager.reconnectAttempts = 0;
});

supabase.realtime.onClose(() => {
  console.log('Realtime connection closed');
  // Attempt to reconnect
  setTimeout(() => {
    realtimeManager.handleReconnect();
  }, CONFIG.REALTIME_RECONNECT_DELAY);
});

supabase.realtime.onError((error) => {
  console.error('Realtime connection error:', error);
});

// Export for global use
window.realtimeManager = realtimeManager;
