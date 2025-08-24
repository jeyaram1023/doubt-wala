// Question page functionality

class QuestionPage {
  constructor() {
    this.currentUser = null;
    this.question = null;
    this.answers = [];
    this.userVotes = new Map(); // Map of answer_id -> vote_type
    this.currentEditingAnswer = null;
    this.init();
  }

  async init() {
    // Initialize UI components
    utils.initializeUI();

    // Check authentication
    this.currentUser = await utils.checkAuth();
    if (!this.currentUser) return;

    // Get question ID from URL
    this.questionId = utils.getUrlParam('id');
    if (!this.questionId) {
      utils.showNotification('Question not found', 'error');
      window.location.href = 'home.html';
      return;
    }

    // Setup event listeners
    this.setupEventListeners();

    // Load question and answers
    await this.loadQuestion();
    await this.loadAnswers();
    await this.loadUserVotes();

    // Setup realtime subscriptions
    this.setupRealtime();
  }

  setupEventListeners() {
    // Answer form
    const answerForm = document.getElementById('answerForm');
    if (answerForm) {
      answerForm.addEventListener('submit', (e) => this.handleAnswerSubmit(e));
    }

    // Sort answers
    const answerSort = document.getElementById('answerSort');
    if (answerSort) {
      answerSort.addEventListener('change', () => this.sortAndRenderAnswers());
    }

    // Edit question form
    const editQuestionForm = document.getElementById('editQuestionForm');
    if (editQuestionForm) {
      editQuestionForm.addEventListener('submit', (e) => this.handleEditQuestionSubmit(e));
    }

    // Edit answer form
    const editAnswerForm = document.getElementById('editAnswerForm');
    if (editAnswerForm) {
      editAnswerForm.addEventListener('submit', (e) => this.handleEditAnswerSubmit(e));
    }
  }

  setupRealtime() {
    // Subscribe to answers for this question
    realtimeManager.subscribeToAnswers(this.questionId, {
      onInsert: (answer) => {
        this.handleNewAnswer(answer);
      },
      onUpdate: (updatedAnswer, oldAnswer) => {
        this.handleAnswerUpdate(updatedAnswer, oldAnswer);
      },
      onDelete: (deletedAnswer) => {
        this.handleAnswerDelete(deletedAnswer);
      }
    });

    // Subscribe to votes changes
    realtimeManager.subscribeToVotes({
      onVoteChange: (payload) => {
        this.handleVoteChange(payload);
      }
    });
  }

  async loadQuestion() {
    const container = document.getElementById('questionContainer');
    utils.showLoading(container, 'Loading question...');

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
        .eq('id', this.questionId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Question not found');

      this.question = data;
      this.renderQuestion();

    } catch (error) {
      utils.handleError(error, 'Failed to load question');
      utils.showEmptyState(
        container,
        'Question Not Found',
        'The question you\'re looking for doesn\'t exist or has been removed.',
        {
          text: 'Go Back Home',
          action: 'window.location.href = "home.html"'
        }
      );
    }
  }

  async loadAnswers() {
    try {
      const { data, error } = await supabase
        .from('answers')
        .select(`
          *,
          user_profiles!answers_user_id_fkey (
            display_name,
            email
          )
        `)
        .eq('question_id', this.questionId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.answers = data || [];
      this.sortAndRenderAnswers();

    } catch (error) {
      utils.handleError(error, 'Failed to load answers');
    }
  }

  async loadUserVotes() {
    if (!this.currentUser) return;

    try {
      const { data, error } = await supabase
        .from('votes')
        .select('answer_id, vote_type')
        .eq('user_id', this.currentUser.id);

      if (error) throw error;

      this.userVotes.clear();
      data?.forEach(vote => {
        this.userVotes.set(vote.answer_id, vote.vote_type);
      });

    } catch (error) {
      console.error('Failed to load user votes:', error);
    }
  }

  renderQuestion() {
    const container = document.getElementById('questionContainer');
    if (!this.question) return;

    const author = this.question.user_profiles || {};
    const displayName = author.display_name || author.email?.split('@')[0] || 'Anonymous';
    const tags = utils.formatTags(this.question.tags);
    const timeAgo = utils.formatRelativeTime(this.question.created_at);
    const canEdit = utils.canUserEdit(this.question, this.currentUser);

    container.innerHTML = `
      <div class="question-header">
        <h1 class="question-title">${utils.escapeHtml(this.question.title)}</h1>
        ${this.question.description ? `
          <div class="question-description">${utils.escapeHtml(this.question.description)}</div>
        ` : ''}
        
        ${tags.length > 0 ? `
          <div class="question-tags">
            ${tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="question-meta">
          <div class="question-author">
            <span>👤 ${utils.escapeHtml(displayName)}</span>
            <span>• ${timeAgo}</span>
          </div>
          
          ${canEdit ? `
            <div class="question-actions">
              <button class="btn-icon" onclick="openEditQuestionModal()" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteQuestion()" title="Delete">🗑️</button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  sortAndRenderAnswers() {
    const sortBy = document.getElementById('answerSort').value;
    
    // Sort answers
    const sortedAnswers = [...this.answers].sort((a, b) => {
      switch (sortBy) {
        case 'votes':
          return b.votes - a.votes;
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'newest':
        default:
          return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    this.renderAnswers(sortedAnswers);
  }

  renderAnswers(answersToRender = this.answers) {
    const container = document.getElementById('answersContainer');
    const titleElement = document.getElementById('answersTitle');
    
    // Update answers count
    if (titleElement) {
      const count = answersToRender.length;
      titleElement.textContent = `${count} Answer${count !== 1 ? 's' : ''}`;
    }

    if (!answersToRender.length) {
      utils.showEmptyState(
        container,
        'No Answers Yet',
        'Be the first to help by sharing your knowledge!'
      );
      return;
    }

    container.innerHTML = answersToRender
      .map(answer => this.renderAnswerCard(answer))
      .join('');
  }

  renderAnswerCard(answer) {
    const author = answer.user_profiles || {};
    const displayName = author.display_name || author.email?.split('@')[0] || 'Anonymous';
    const timeAgo = utils.formatRelativeTime(answer.created_at);
    const canEdit = utils.canUserEdit(answer, this.currentUser);
    const userVote = this.userVotes.get(answer.id);
    const canVote = this.currentUser.id !== answer.user_id;

    return `
      <div class="answer-card" data-answer-id="${answer.id}">
        <div class="answer-header">
          <div class="answer-author">
            <span>👤 ${utils.escapeHtml(displayName)}</span>
            <span>• ${timeAgo}</span>
          </div>
          
          ${canEdit ? `
            <div class="answer-actions">
              <button class="btn-icon" onclick="openEditAnswerModal('${answer.id}')" title="Edit">✏️</button>
              <button class="btn-icon" onclick="deleteAnswer('${answer.id}')" title="Delete">🗑️</button>
            </div>
          ` : ''}
        </div>
        
        <div class="answer-content">${utils.escapeHtml(answer.content)}</div>
        
        <div class="answer-footer">
          <div class="vote-controls">
            <button class="vote-btn ${userVote === 'up' ? 'upvoted' : ''}" 
                    onclick="vote('${answer.id}', 'up')" 
                    ${!canVote ? 'disabled' : ''}
                    title="${canVote ? 'Upvote' : 'Cannot vote on own answer'}">
              ↑
            </button>
            <span class="vote-count ${answer.votes > 0 ? 'positive' : answer.votes < 0 ? 'negative' : ''}">${answer.votes}</span>
            <button class="vote-btn ${userVote === 'down' ? 'downvoted' : ''}" 
                    onclick="vote('${answer.id}', 'down')" 
                    ${!canVote ? 'disabled' : ''}
                    title="${canVote ? 'Downvote' : 'Cannot vote on own answer'}">
              ↓
            </button>
          </div>
          
          <div class="answer-time">${timeAgo}</div>
        </div>
      </div>
    `;
  }

  async handleAnswerSubmit(e) {
    e.preventDefault();
    
    const content = document.getElementById('answerContent').value.trim();
    
    if (!content) {
      utils.showNotification('Please enter your answer', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('answers')
        .insert({
          question_id: this.questionId,
          content,
          user_id: this.currentUser.id
        });

      if (error) throw error;

      // Reset form
      document.getElementById('answerForm').reset();
      
      utils.showNotification('Answer posted successfully!', 'success');

    } catch (error) {
      utils.handleError(error, 'Failed to post answer. Please try again.');
    }
  }

  async vote(answerId, voteType) {
    if (!this.currentUser) return;

    try {
      const existingVote = this.userVotes.get(answerId);
      
      if (existingVote === voteType) {
        // Remove vote
        const { error } = await supabase
          .from('votes')
          .delete()
          .eq('answer_id', answerId)
          .eq('user_id', this.currentUser.id);

        if (error) throw error;
        
        this.userVotes.delete(answerId);
      } else {
        // Add or update vote
        const { error } = await supabase
          .from('votes')
          .upsert({
            answer_id: answerId,
            user_id: this.currentUser.id,
            vote_type: voteType
          }, {
            onConflict: 'answer_id,user_id'
          });

        if (error) throw error;
        
        this.userVotes.set(answerId, voteType);
      }

      // Reload answers to get updated vote counts
      await this.loadAnswers();

    } catch (error) {
      utils.handleError(error, 'Failed to vote. Please try again.');
    }
  }

  openEditQuestionModal() {
    const modal = document.getElementById('editQuestionModal');
    
    // Populate form with current values
    document.getElementById('editQuestionTitle').value = this.question.title;
    document.getElementById('editQuestionDescription').value = this.question.description || '';
    document.getElementById('editQuestionTags').value = this.question.tags ? this.question.tags.join(', ') : '';
    
    modal.classList.remove('hidden');
  }

  async handleEditQuestionSubmit(e) {
    e.preventDefault();
    
    const title = document.getElementById('editQuestionTitle').value.trim();
    const description = document.getElementById('editQuestionDescription').value.trim();
    const tagsInput = document.getElementById('editQuestionTags').value.trim();
    
    if (!title) {
      utils.showNotification('Please enter a question title', 'error');
      return;
    }

    const tags = utils.parseTags(tagsInput);
    
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          title,
          description,
          tags,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.questionId);

      if (error) throw error;

      this.closeEditQuestionModal();
      await this.loadQuestion(); // Reload to show changes
      
      utils.showNotification('Question updated successfully!', 'success');

    } catch (error) {
      utils.handleError(error, 'Failed to update question. Please try again.');
    }
  }

  openEditAnswerModal(answerId) {
    const answer = this.answers.find(a => a.id === answerId);
    if (!answer) return;

    this.currentEditingAnswer = answerId;
    const modal = document.getElementById('editAnswerModal');
    
    // Populate form with current content
    document.getElementById('editAnswerContent').value = answer.content;
    
    modal.classList.remove('hidden');
  }

  async handleEditAnswerSubmit(e) {
    e.preventDefault();
    
    if (!this.currentEditingAnswer) return;
    
    const content = document.getElementById('editAnswerContent').value.trim();
    
    if (!content) {
      utils.showNotification('Please enter your answer', 'error');
      return;
    }

    try {
      const { error } = await supabase
        .from('answers')
        .update({
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.currentEditingAnswer);

      if (error) throw error;

      this.closeEditAnswerModal();
      await this.loadAnswers(); // Reload to show changes
      
      utils.showNotification('Answer updated successfully!', 'success');

    } catch (error) {
      utils.handleError(error, 'Failed to update answer. Please try again.');
    }
  }

  async deleteQuestion() {
    if (!confirm('Are you sure you want to delete this question? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', this.questionId);

      if (error) throw error;

      utils.showNotification('Question deleted successfully', 'success');
      
      // Redirect to home after a short delay
      setTimeout(() => {
        window.location.href = 'home.html';
      }, 1500);

    } catch (error) {
      utils.handleError(error, 'Failed to delete question. Please try again.');
    }
  }

  async deleteAnswer(answerId) {
    if (!confirm('Are you sure you want to delete this answer? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('answers')
        .delete()
        .eq('id', answerId);

      if (error) throw error;

      utils.showNotification('Answer deleted successfully', 'success');

    } catch (error) {
      utils.handleError(error, 'Failed to delete answer. Please try again.');
    }
  }

  closeEditQuestionModal() {
    const modal = document.getElementById('editQuestionModal');
    modal.classList.add('hidden');
  }

  closeEditAnswerModal() {
    const modal = document.getElementById('editAnswerModal');
    modal.classList.add('hidden');
    this.currentEditingAnswer = null;
  }

  handleNewAnswer(answer) {
    // Add to answers array
    this.answers.push(answer);
    this.sortAndRenderAnswers();
    
    // Show notification for answers from others
    if (answer.user_id !== this.currentUser.id) {
      utils.showNotification('New answer added!', 'success');
    }
  }

  handleAnswerUpdate(updatedAnswer, oldAnswer) {
    // Find and update the answer in our array
    const index = this.answers.findIndex(a => a.id === updatedAnswer.id);
    if (index !== -1) {
      this.answers[index] = updatedAnswer;
      this.sortAndRenderAnswers();
    }
  }

  handleAnswerDelete(deletedAnswer) {
    // Remove from answers array
    this.answers = this.answers.filter(a => a.id !== deletedAnswer.id);
    this.sortAndRenderAnswers();
  }

  handleVoteChange(payload) {
    // Reload answers to get updated vote counts
    this.loadAnswers();
  }
}

// Global functions for modal and action controls
window.openEditQuestionModal = function() {
  window.questionPageInstance?.openEditQuestionModal();
};

window.closeEditQuestionModal = function() {
  window.questionPageInstance?.closeEditQuestionModal();
};

window.openEditAnswerModal = function(answerId) {
  window.questionPageInstance?.openEditAnswerModal(answerId);
};

window.closeEditAnswerModal = function() {
  window.questionPageInstance?.closeEditAnswerModal();
};

window.vote = function(answerId, voteType) {
  window.questionPageInstance?.vote(answerId, voteType);
};

window.deleteQuestion = function() {
  window.questionPageInstance?.deleteQuestion();
};

window.deleteAnswer = function(answerId) {
  window.questionPageInstance?.deleteAnswer(answerId);
};

// Initialize question page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.questionPageInstance = new QuestionPage();
});
