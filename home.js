

// Home page functionality

class HomePage {
  constructor() {
    this.currentUser = null;
    this.questions = [];
    this.filteredQuestions = [];
    this.searchDebounced = utils.debounce(this.performSearch.bind(this), CONFIG.DEBOUNCE_DELAY);
    this.init();
  }

  async init() {
    // Initialize UI components
    utils.initializeUI();

    // Check authentication
    this.currentUser = await utils.checkAuth();
    if (!this.currentUser) return;

    // Setup event listeners
    this.setupEventListeners();

    // Load initial data
    await this.loadQuestions();

    // Setup realtime subscriptions
    this.setupRealtime();
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

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput) {
      searchInput.addEventListener('input', () => this.searchDebounced());
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.performSearch());
    }

    // Filter functionality
    const sortFilter = document.getElementById('sortFilter');
    const tagFilter = document.getElementById('tagFilter');

    if (sortFilter) {
      sortFilter.addEventListener('change', () => this.applyFilters());
    }

    if (tagFilter) {
      tagFilter.addEventListener('input', () => this.searchDebounced());
      tagFilter.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.applyFilters();
        }
      });
    }
  }

  setupRealtime() {
    // Subscribe to new questions
    realtimeManager.subscribeToQuestions({
      onInsert: (question) => {
        this.handleNewQuestion(question);
      },
      onUpdate: (updatedQuestion, oldQuestion) => {
        this.handleQuestionUpdate(updatedQuestion, oldQuestion);
      },
      onDelete: (deletedQuestion) => {
        this.handleQuestionDelete(deletedQuestion);
      },
      onConnected: () => {
        console.log('Connected to questions realtime');
      }
    });
  }

  async loadQuestions() {
    const container = document.getElementById('questionsContainer');
    utils.showLoading(container, 'Loading questions...');

    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          user_profiles!questions_user_id_fkey (
            display_name,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.questions = data || [];
      this.filteredQuestions = [...this.questions];
      this.renderQuestions();

    } catch (error) {
      utils.handleError(error, 'Failed to load questions');
      utils.showEmptyState(
        container,
        'Failed to Load Questions',
        'There was an error loading the questions. Please try again.',
        {
          text: 'Retry',
          action: 'window.location.reload()'
        }
      );
    }
  }

  renderQuestions() {
    const container = document.getElementById('questionsContainer');
    
    if (!this.filteredQuestions.length) {
      utils.showEmptyState(
        container,
        'No Questions Found',
        this.hasActiveFilters() 
          ? 'Try adjusting your search or filters to find more questions.'
          : 'Be the first to ask a question and start the discussion!',
        !this.hasActiveFilters() ? {
          text: 'Ask Question',
          action: 'document.querySelector(\'#askQuestionBtn\').click()'
        } : null
      );
      return;
    }

    container.innerHTML = this.filteredQuestions
      .map(question => this.renderQuestionCard(question))
      .join('');
  }

  renderQuestionCard(question) {
    const author = question.user_profiles || {};
    const displayName = author.display_name || author.email?.split('@')[0] || 'Anonymous';
    const tags = utils.formatTags(question.tags);
    const timeAgo = utils.formatRelativeTime(question.created_at);

    return `
      <div class="question-card" onclick="window.location.href='question.html?id=${question.id}'">
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
            <div class="meta-item">
              <span>👤 ${utils.escapeHtml(displayName)}</span>
            </div>
            <div class="meta-item">
              <span>💬 0 answers</span>
            </div>
          </div>
          <div class="question-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }

  performSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const tagFilter = document.getElementById('tagFilter').value.trim().toLowerCase();
    const tagFilters = tagFilter ? utils.parseTags(tagFilter) : [];

    this.filteredQuestions = this.questions.filter(question => {
      // Text search
      const matchesSearch = !searchTerm || 
        question.title.toLowerCase().includes(searchTerm) ||
        question.description?.toLowerCase().includes(searchTerm);

      // Tag filter
      const matchesTags = tagFilters.length === 0 ||
        tagFilters.some(filterTag => 
          question.tags?.some(questionTag => 
            questionTag.toLowerCase().includes(filterTag)
          )
        );

      return matchesSearch && matchesTags;
    });

    this.applyFilters();
  }

  applyFilters() {
    const sortFilter = document.getElementById('sortFilter').value;

    // Sort filtered questions
    this.filteredQuestions.sort((a, b) => {
      switch (sortFilter) {
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    this.renderQuestions();
  }

  hasActiveFilters() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    const tagFilter = document.getElementById('tagFilter').value.trim();
    return searchTerm || tagFilter;
  }

  openQuestionModal() {
    const modal = document.getElementById('questionModal');
    modal.classList.remove('hidden');
    
    // Focus on title input
    const titleInput = document.getElementById('questionTitle');
    if (titleInput) {
      setTimeout(() => titleInput.focus(), 100);
    }
  }

  async handleQuestionSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('questionTitle').value.trim();
    const description = document.getElementById('questionDescription').value.trim();
    const tagsInput = document.getElementById('questionTags').value.trim();
    
    if (!title) {
      utils.showNotification('Please enter a question title', 'error');
      return;
    }

    const tags = utils.parseTags(tagsInput);
    
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

      // Close modal and reset form
      this.closeQuestionModal();
      document.getElementById('questionForm').reset();
      
      utils.showNotification('Question posted successfully!', 'success');

    } catch (error) {
      utils.handleError(error, 'Failed to post question. Please try again.');
    }
  }

  closeQuestionModal() {
    const modal = document.getElementById('questionModal');
    modal.classList.add('hidden');
  }

  handleNewQuestion(question) {
    // Add to questions array
    this.questions.unshift(question);
    
    // Check if it matches current filters
    this.performSearch();
    
    // Show notification for new questions from others
    if (question.user_id !== this.currentUser.id) {
      utils.showNotification('New question posted!', 'success');
    }
  }

  handleQuestionUpdate(updatedQuestion, oldQuestion) {
    // Find and update the question in our array
    const index = this.questions.findIndex(q => q.id === updatedQuestion.id);
    if (index !== -1) {
      this.questions[index] = updatedQuestion;
      this.performSearch(); // Re-apply filters and render
    }
  }

  handleQuestionDelete(deletedQuestion) {
    // Remove from questions array
    this.questions = this.questions.filter(q => q.id !== deletedQuestion.id);
    this.performSearch(); // Re-apply filters and render
  }
}

// Global functions for modal control
window.closeQuestionModal = function() {
  const modal = document.getElementById('questionModal');
  modal.classList.add('hidden');
};

// Initialize home page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new HomePage();
});
