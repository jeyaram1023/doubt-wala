
// Utility Functions

// Format date to relative time
function formatRelativeTime(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

// Format date to readable string
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// Show notification
function showNotification(message, type = 'success') {
  const notification = document.getElementById('notification');
  const notificationText = document.getElementById('notificationText');
  
  if (!notification || !notificationText) return;

  // Remove previous type classes
  notification.classList.remove('success', 'error', 'warning');
  
  // Add new type class
  notification.classList.add(type);
  
  notificationText.textContent = message;
  notification.classList.remove('hidden');

  // Auto-hide after timeout
  setTimeout(() => {
    hideNotification();
  }, CONFIG.NOTIFICATION_TIMEOUT);
}

// Hide notification
function hideNotification() {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.classList.add('hidden');
  }
}

// Debounce function
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Get user display name or email
function getUserDisplayName(user) {
  if (!user) return 'Anonymous';
  return user.user_metadata?.full_name || 
         user.user_metadata?.name || 
         user.email?.split('@')[0] || 
         'User';
}

// Generate user avatar initials
function getUserAvatar(user) {
  if (!user) return '👤';
  const name = getUserDisplayName(user);
  return name.charAt(0).toUpperCase();
}

// Check if user can edit content
function canUserEdit(content, currentUser) {
  return currentUser && content.user_id === currentUser.id;
}

// Parse tags from string
function parseTags(tagsString) {
  if (!tagsString) return [];
  return tagsString.split(',')
    .map(tag => tag.trim())
    .filter(tag => tag.length > 0)
    .map(tag => tag.toLowerCase());
}

// Format tags for display
function formatTags(tags) {
  if (!tags || !Array.isArray(tags)) return [];
  return tags.filter(tag => tag && tag.trim().length > 0);
}

// Validate email
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Get URL parameters
function getUrlParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Set URL parameter without page reload
function setUrlParam(param, value) {
  const url = new URL(window.location);
  if (value) {
    url.searchParams.set(param, value);
  } else {
    url.searchParams.delete(param);
  }
  window.history.replaceState({}, '', url);
}

// Handle errors gracefully
function handleError(error, userMessage = 'Something went wrong. Please try again.') {
  console.error('Error:', error);
  showNotification(userMessage, 'error');
}

// Loading states
function showLoading(container, message = 'Loading...') {
  if (!container) return;
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

// Empty states
function showEmptyState(container, title, message, actionButton = null) {
  if (!container) return;
  
  let actionHtml = '';
  if (actionButton) {
    actionHtml = `<button class="btn btn-primary" onclick="${actionButton.action}">${escapeHtml(actionButton.text)}</button>`;
  }
  
  container.innerHTML = `
    <div class="empty-state">
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(message)}</p>
      ${actionHtml}
    </div>
  `;
}

// Initialize notification close button
function initNotification() {
  const notificationClose = document.querySelector('.notification-close');
  if (notificationClose) {
    notificationClose.addEventListener('click', hideNotification);
  }
}

// Initialize modal close functionality
function initModals() {
  // Close modals when clicking outside or on close button
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      e.target.classList.add('hidden');
    }
    if (e.target.classList.contains('modal-close')) {
      e.target.closest('.modal').classList.add('hidden');
    }
  });

  // Close modals with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal:not(.hidden)');
      if (openModal) {
        openModal.classList.add('hidden');
      }
    }
  });
}

// Initialize logout functionality
function initLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      } catch (error) {
        handleError(error, 'Failed to log out. Please try again.');
      }
    });
  }
}

// Initialize common UI components
function initializeUI() {
  initNotification();
  initModals();
  initLogout();
}

// Check authentication and redirect if needed
async function checkAuth(redirectToLogin = true) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user && redirectToLogin) {
      window.location.href = 'index.html';
      return null;
    }
    
    return user;
  } catch (error) {
    console.error('Auth check error:', error);
    if (redirectToLogin) {
      window.location.href = 'index.html';
    }
    return null;
  }
}

// Truncate text
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Export utility functions for global use
window.utils = {
  formatRelativeTime,
  formatDate,
  showNotification,
  hideNotification,
  debounce,
  escapeHtml,
  getUserDisplayName,
  getUserAvatar,
  canUserEdit,
  parseTags,
  formatTags,
  isValidEmail,
  getUrlParam,
  setUrlParam,
  handleError,
  showLoading,
  showEmptyState,
  initializeUI,
  checkAuth,
  truncateText
};
