// Home page functionality

class HomePage {
  constructor() {
    this.currentUser = null;
    this.questions = [];
    this.filteredQuestions = [];
    this.init();
  }

  async init() {
    // Check authentication
    this.currentUser = await utils.checkAuth();
    if (!this.currentUser) {
        // Redirect to login or show an error if auth fails
        document.body.innerHTML = '<h1>Please log in to view this page.</h1>';
        return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadQuestions();
  }

  setupEventListeners() {
    // Ask question button
    const askQuestionBtn = document.getElementById('askQuestionBtn');
    if (askQuestionBtn) {
      askQuestionBtn.addEventListener('click', () => this.openQuestionModal());
    }

    // Question form
    const questionForm = document.getElementById('questionForm');
    if (questionForm) {
      questionForm.addEventListener('submit', (e) => this.handleQuestionSubmit(e));
    }
  }

  async loadQuestions() {
    const container = document.getElementById('questionsContainer');
    container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Loading questions...</p></div>`;

    try {
      // --- THIS IS THE FIX ---
      // The query now correctly joins user_profiles by referencing the 'user_id' column
      // from the 'questions' table. Supabase understands that 'user_id' should be used
      // to link to the primary key of the 'user_profiles' table.
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          user_profiles!inner (
            id,
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If the query fails, it will throw an error which is caught below.
        throw error;
      }
      
      // The join syntax was changed from user_profiles!questions_user_id_fkey to user_profiles!inner
      // and we need to filter where questions.user_id equals user_profiles.id
      // A better approach is to create a view in Supabase, but for now we can filter client-side or adjust the query.
      // Let's assume the RPC or a view is a better approach, but for a quick fix, let's adjust the query if possible.
      // The `!inner` join is a good start. Let's refine the query.
      
      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select(`
            id,
            title,
            description,
            tags,
            created_at,
            user_id,
            profiles:user_profiles (
                display_name,
                email
            )
        `)
        .order('created_at', { ascending: false });

      if (questionsError) throw questionsError;

      this.questions = questionsData.map(q => ({...q, user_profiles: q.profiles}) ) || [];
      this.filteredQuestions = [...this.questions];
      this.renderQuestions();

    } catch (error) {
      utils.handleError(error, 'Failed to load questions');
      utils.showEmptyState(
        container,
        'Failed to Load Questions',
        'There was an error loading the questions. Please try again.'
      );
    }
  }

  renderQuestions() {
    const container = document.getElementById('questionsContainer');
    
    if (!this.filteredQuestions.length) {
      utils.showEmptyState(
        container,
        'No Questions Found',
        'Be the first to ask a question and start the discussion!'
      );
      return;
    }

    container.innerHTML = this.filteredQuestions
      .map(question => this.renderQuestionCard(question))
      .join('');
  }

  renderQuestionCard(question) {
    // The joined data will be nested under the 'user_profiles' key.
    const author = question.user_profiles || {};
    const displayName = author.display_name || author.email?.split('@')[0] || 'Anonymous';
    const tags = utils.formatTags(question.tags);
    const timeAgo = utils.formatRelativeTime(question.created_at);

    return `
      <div class="question-card">
        <div class="question-header">
          <h3 class="question-title">${utils.escapeHtml(question.title)}</h3>
          ${question.description ? `
            <p class="question-description">${utils.escapeHtml(question.description)}</p>
          ` : ''}
        </div>
        
        ${tags.length > 0 ? `
          <div class="question-tags">
            ${tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="question-footer">
          <div class="question-meta">
            <span>👤 ${utils.escapeHtml(displayName)}</span>
          </div>
          <div class="question-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }

  openQuestionModal() {
    const modal = document.getElementById('questionModal');
    modal.classList.remove('hidden');
    document.getElementById('questionTitle').focus();
  }

  closeQuestionModal() {
    const modal = document.getElementById('questionModal');
    modal.classList.add('hidden');
  }

  async handleQuestionSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('questionTitle').value.trim();
    const description = document.getElementById('questionDescription').value.trim();
    const tagsInput = document.getElementById('questionTags').value.trim();
    
    if (!title) {
      alert('Please enter a question title');
      return;
    }

    const tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    try {
      const { error } = await supabase
        .from('questions')
        .insert({
          title,
          description,
          tags,
          user_id: this.currentUser.id
        });

      if (error) throw error;

      this.closeQuestionModal();
      document.getElementById('questionForm').reset();
      this.loadQuestions(); // Refresh questions list

    } catch (error) {
      utils.handleError(error, 'Failed to post question. Please try again.');
    }
  }
}

// Global function for modal control
window.closeQuestionModal = function() {
  const modal = document.getElementById('questionModal');
  modal.classList.add('hidden');
};

// Initialize home page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HomePage();
});
