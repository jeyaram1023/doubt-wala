// Authentication functionality

class AuthManager {
  constructor() {
    this.initializeAuth();
  }

  async initializeAuth() {
    // Check if we're already authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // User is already logged in, redirect to home
      window.location.href = '/doubt-wala/home.html';
      return;
    }

    // Handle auth state changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session);
      
      if (event === 'SIGNED_IN' && session) {
        // Create or update user profile
        await this.createUserProfile(session.user);
        
        // Show success message
        utils.showNotification('Successfully signed in! Redirecting...', 'success');
        
        // Redirect to home page
        setTimeout(() => {
          window.location.href = '/doubt-wala/home.html';
        }, 1500);
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('User signed out');
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    const authForm = document.getElementById('authForm');
    const emailInput = document.getElementById('email');
    const authButton = document.getElementById('authButton');

    if (authForm) {
      authForm.addEventListener('submit', (e) => this.handleAuth(e));
    }

    if (emailInput) {
      emailInput.addEventListener('input', () => {
        this.validateEmail();
      });
    }
  }

  async handleAuth(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const authButton = document.getElementById('authButton');

    if (!this.validateEmail(email)) {
      this.showMessage('Please enter a valid email address.', 'error');
      return;
    }

    try {
      // Disable button and show loading state
      authButton.disabled = true;
      authButton.innerHTML = '<span>Sending...</span>';

      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          // Corrected for GitHub Pages deployment
          emailRedirectTo: "https://jeyaram1023.github.io/doubt-wala/home.html"
        }
      });

      if (error) {
        throw error;
      }

      this.showMessage(
        'Check your email! We\'ve sent you a secure sign-in link.', 
        'success'
      );

      // Keep button disabled but change text
      authButton.innerHTML = '<span>Check Your Email</span>';

    } catch (error) {
      console.error('Auth error:', error);
      this.showMessage(
        error.message || 'Failed to send magic link. Please try again.', 
        'error'
      );
      
      // Re-enable button
      authButton.disabled = false;
      authButton.innerHTML = '<span>Send Magic Link</span>';
    }
  }

  validateEmail(email = null) {
    const emailInput = document.getElementById('email');
    const emailValue = email || emailInput.value.trim();
    
    const isValid = utils.isValidEmail(emailValue);
    
    if (emailInput) {
      emailInput.style.borderColor = isValid || !emailValue 
        ? 'var(--gray-300)' 
        : 'var(--error-500)';
    }
    
    return isValid;
  }

  showMessage(message, type) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;

    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove('hidden');

    // Auto-hide error messages after 5 seconds
    if (type === 'error') {
      setTimeout(() => {
        messageDiv.classList.add('hidden');
      }, 5000);
    }
  }

  async createUserProfile(user) {
    try {
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (existingProfile) {
        // Update existing profile
        await supabase
          .from('user_profiles')
          .update({
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } else {
        // Create new profile
        const { error } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name || user.email?.split('@')[0]
          });

        if (error && error.code !== '23505') { // Ignore unique constraint violations
          console.error('Error creating user profile:', error);
        }
      }
    } catch (error) {
      console.error('Error managing user profile:', error);
      // Don't throw error as this shouldn't block authentication
    }
  }
}

// Initialize authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new AuthManager();
});
