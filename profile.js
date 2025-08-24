// Profile page functionality

class ProfilePage {
  constructor() {
    this.currentUser = null;
    this.userProfile = null;
    this.userQuestions = [];
    this.userAnswers = [];
    this.activeTab = 'questions';
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

    // Load user data
    await this.loadUserProfile();
    await this.loadUserQuestions();
    await this.loadUserAnswers();
  }

  setupEventListeners() {
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        const tab = button.dataset.tab;
        this.switchTab(tab);
      });
    });
  }

  async loadUserProfile() {
    try {
      // Try to get profile from user_profiles table first
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw profileError;
      }

      this.userProfile = profile || {
        id: this.currentUser.id,
        email: this.currentUser.email,
        display_name: this.currentUser.email?.split('@')[0] || 'User',
        created_at: this.currentUser.created_at
      };

      this.renderProfile();

    } catch (error) {
      utils.handleError(error, 'Failed to load profile');
      console.error('Profile loading error:', error);
    }
  }

  async loadUserQuestions() {
    const container = document.getElementById('userQuestionsContainer');
    utils.showLoading(container, 'Loading your questions...');

    try {
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          answers!answers_question_id_fkey (count)
        `)
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.userQuestions = data || [];
      
      if (this.activeTab === 'questions') {
        this.renderUserQuestions();
      }

      // Update stats
      this.updateStats();

    } catch (error) {
      utils.handleError(error, 'Failed to load your questions');
      utils.showEmptyState(
        container,
        'Failed to Load Questions',
        'There was an error loading your questions.'
      );
    }
  }

  async loadUserAnswers() {
    const container = document.getElementById('userAnswersContainer');
    utils.showLoading(container, 'Loading your answers...');

    try {
      const { data, error } = await supabase
        .from('answers')
        .select(`
          *,
          questions!answers_question_id_fkey (
            id,
            title
          )
        `)
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.userAnswers = data || [];
      
      if (this.activeTab === 'answers') {
        this.renderUserAnswers();
      }

      // Update stats
      this.updateStats();

    } catch (error) {
      utils.handleError(error, 'Failed to load your answers');
      utils.showEmptyState(
        container,
        'Failed to Load Answers',
        'There was an error loading your answers.'
      );
    }
  }

  renderProfile() {
    // Update user name
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
      userNameElement.textContent = this.userProfile.display_name || 'User';
    }

    // Update user email
    const userEmailElement = document.getElementById('userEmail');
    if (userEmailElement) {
      userEmailElement.textContent = this.userProfile.email || 'No email';
    }

    // Update join date
    const joinDateElement = document.getElementById('joinDate');
    if (joinDateElement) {
      joinDateElement.textContent = utils.formatDate(this.userProfile.created_at);
    }

    // Update avatar
    const userAvatarElement = document.getElementById('userAvatar');
    if (userAvatarElement) {
      userAvatarElement.textContent = utils.getUserAvatar(this.currentUser);
    }
  }

  renderUserQuestions() {
    const container = document.getElementById('userQuestionsContainer');

    if (!this.userQuestions.length) {
      utils.showEmptyState(
        container,
        'No Questions Yet',
        'You haven\'t asked any questions yet. Start by asking your first question!',
        {
          text: 'Ask Question',
          action: 'window.location.href = "home.html"'
        }
      );
      return;
    }

    container.innerHTML = this.userQuestions
      .map(question => this.renderQuestionCard(question))
      .join('');
  }

  renderUserAnswers() {
    const container = document.getElementById('userAnswersContainer');

    if (!this.userAnswers.length) {
      utils.showEmptyState(
        container,
        'No Answers Yet',
        'You haven\'t answered any questions yet. Help others by sharing your knowledge!',
        {
          text: 'Browse Questions',
          action: 'window.location.href = "home.html"'
        }
      );
      return;
    }

    container.innerHTML = this.userAnswers
      .map(answer => this.renderAnswerCard(answer))
      .join('');
  }

  renderQuestionCard(question) {
    const tags = utils.formatTags(question.tags);
    const timeAgo = utils.formatRelativeTime(question.created_at);
    const answerCount = question.answers?.[0]?.count || 0;

    return `
      <div class="profile-question-card" onclick="window.location.href='question.html?id=${question.id}'">
        <h4 class="profile-question-title">${utils.escapeHtml(question.title)}</h4>
        
        ${question.description ? `
          <p class="profile-question-description">${utils.escapeHtml(question.description)}</p>
        ` : ''}
        
        ${tags.length > 0 ? `
          <div class="profile-question-tags">
            ${tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="profile-question-footer">
          <span>${answerCount} answer${answerCount !== 1 ? 's' : ''}</span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;
  }

  renderAnswerCard(answer) {
    const timeAgo = utils.formatRelativeTime(answer.created_at);
    const question = answer.questions;
    const voteClass = answer.votes > 0 ? 'positive' : answer.votes < 0 ? 'negative' : '';

    return `
      <div class="profile-answer-card">
        <div class="profile-answer-question">
          Answer to: <a href="question.html?id=${question.id}">${utils.escapeHtml(question.title)}</a>
        </div>
        
        <div class="profile-answer-content">${utils.escapeHtml(answer.content)}</div>
        
        <div class="profile-answer-footer">
          <span class="profile-answer-votes ${voteClass}">
            ${answer.votes > 0 ? '↑' : answer.votes < 0 ? '↓' : '•'} ${Math.abs(answer.votes)} vote${Math.abs(answer.votes) !== 1 ? 's' : ''}
          </span>
          <span>${timeAgo}</span>
        </div>
      </div>
    `;
  }

  switchTab(tabName) {
    this.activeTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Tab`);
      content.classList.toggle('hidden', content.id !== `${tabName}Tab`);
    });

    // Render appropriate content
    if (tabName === 'questions') {
      this.renderUserQuestions();
    } else if (tabName === 'answers') {
      this.renderUserAnswers();
    }
  }

  updateStats() {
    // Update questions count
    const questionsCountElement = document.getElementById('questionsCount');
    if (questionsCountElement) {
      questionsCountElement.textContent = this.userQuestions.length;
    }

    // Update answers count
    const answersCountElement = document.getElementById('answersCount');
    if (answersCountElement) {
      answersCountElement.textContent = this.userAnswers.length;
    }
  }
}

// Initialize profile page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ProfilePage();
});
