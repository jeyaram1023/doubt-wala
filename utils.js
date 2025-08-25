import { supabase, CONFIG } from './config.js';

export const utils = {
  // Simple UI initializer
  initializeUI() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      });
    }
  },

  // Check authentication state
  async checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = 'index.html';
      return null;
    }
    return session.user;
  },

  // Debounce function to limit the rate of function execution
  debounce(func, delay) {
    let timeout;
    return function(...args) {
      const context = this;
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(context, args), delay);
    };
  },

  // Show a loading indicator
  showLoading(container, message) {
    if (container) {
      container.innerHTML = `
        <div class="loading-state">
          <div class="spinner"></div>
          <p>${message}</p>
        </div>`;
    }
  },

  // Show an empty state message
  showEmptyState(container, title, message, button) {
    if (container) {
        let buttonHtml = '';
        if (button) {
            // Store the action in a way it can be called
            const actionId = `action-${Date.now()}`;
            window[actionId] = button.action;
            buttonHtml = `<button class="btn btn-primary" onclick="${actionId}()">
                ${button.text}
            </button>`;
        }
        container.innerHTML = `
            <div class="empty-state">
                <h3>${title}</h3>
                <p>${message}</p>
                ${buttonHtml}
            </div>`;
    }
  },
  
  // Generic error handler
  handleError(error, message) {
    console.error(message, error);
    this.showNotification(message, 'error');
  },

  // Show a notification toast
  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    if (!notification || !notificationText) return;

    notificationText.textContent = message;
    notification.className = `notification show ${type}`;
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, CONFIG.NOTIFICATION_TIMEOUT);
  },

  // Parse comma-separated tags into an array
  parseTags(tagsInput) {
    if (!tagsInput) return [];
    return tagsInput.split(',').map(tag => tag.trim()).filter(Boolean);
  },

  // Format tags array for display
  formatTags(tags) {
    return Array.isArray(tags) ? tags : [];
  },

  // Format date to a relative time string (e.g., "5 minutes ago")
  formatRelativeTime(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 60) return "just now";
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  },
  
  // Escape HTML to prevent XSS
  escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return str.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  },

  // Basic email validation
  isValidEmail(email) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  }
};
