// Home page functionality

import { supabase, CONFIG } from './config.js';
import { utils } from './utils.js';
import { realtimeManager } from './realtime.js';

class HomePage {
  constructor() {
    this.currentUser = null;
    this.questions = [];
    this.filteredQuestions = [];
    this.searchDebounced = utils.debounce(this.performSearch.bind(this), CONFIG.DEBOUNCE_DELAY);
    this.init();
  }

  async init() {
    utils.initializeUI();
    this.currentUser = await utils.checkAuth();
    if (!this.currentUser) return;

    this.setupEventListeners();
    await this.loadQuestions();
    this.setupRealtime();
  }

  setupEventListeners() {
    document.getElementById('askQuestionBtn')?.addEventListener('click', () => this.openQuestionModal());
    document.getElementById('questionForm')?.addEventListener('submit', (e) => this.handleQuestionSubmit(e));
    
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.searchDebounced());
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.performSearch();
        }
      });
    }

    document.getElementById('searchBtn')?.addEventListener('click', () => this.performSearch());
    document.getElementById('sortFilter')?.addEventListener('change', () => this.applyFilters());

    const tagFilter = document.getElementById('tagFilter');
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
    realtimeManager.subscribeToQuestions({
      onInsert: (question) => this.handleNewQuestion(question),
      onUpdate: (updatedQuestion) => this.handleQuestionUpdate(updatedQuestion),
      onDelete: (deletedQuestion) => this.handleQuestionDelete(deletedQuestion),
      onConnected: () => console.log('Connected to questions realtime'),
    });
  }

  async loadQuestions() {
    const container = document.getElementById('questionsContainer');
    utils.showLoading(container, 'Loading questions...');

    try {
      // ##### FIX APPLIED HERE #####
      // Switched from 'user_profiles!questions_user_id_fkey(...)' to the more robust 'user_profiles(...)'
      // This lets Supabase infer the relationship without relying on a specific foreign key constraint name.
      const { data, error } = await supabase
        .from('questions')
        .select(`
          *,
          user_profiles (
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
          action: () => window.location.reload()
        }
      );
    }
  }

  renderQuestions() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;

    if (!this.filteredQuestions.length) {
      utils.showEmptyState(
        container,
        'No Questions Found',
        this.hasActiveFilters() 
          ? 'Try adjusting your search or filters.' 
          : 'Be the first to ask a question!',
        !this.hasActiveFilters() ? {
          text: 'Ask Question',
          action: () => document.getElementById('askQuestionBtn')?.click()
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
          ${question.description ? `<p class="question-description">${utils.escapeHtml(question.description)}</p>` : ''}
        </div>
        ${tags.length > 0 ? `<div class="question-tags">${tags.map(tag => `<span class="tag">${utils.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
        <div class="question-footer">
          <div class="question-meta">
            <span class="meta-item">👤 ${utils.escapeHtml(displayName)}</span>
            <span class="meta-item">💬 0 answers</span>
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
      const matchesSearch = !searchTerm || 
        question.title.toLowerCase().includes(searchTerm) ||
        question.description?.toLowerCase().includes(searchTerm);

      const matchesTags = tagFilters.length === 0 ||
        tagFilters.some(filterTag => 
          question.tags?.some(questionTag => questionTag.toLowerCase().includes(filterTag))
        );

      return matchesSearch && matchesTags;
    });

    this.applyFilters();
  }

  applyFilters() {
    const sortFilter = document.getElementById('sortFilter').value;
    this.filteredQuestions.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortFilter === 'oldest' ? dateA - dateB : dateB - dateA;
    });
    this.renderQuestions();
  }

  hasActiveFilters() {
    return document.getElementById('searchInput').value.trim() || document.getElementById('tagFilter').value.trim();
  }

  openQuestionModal() {
    document.getElementById('questionModal')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('questionTitle')?.focus(), 100);
  }

  closeQuestionModal() {
    document.getElementById('questionModal')?.classList.add('hidden');
    document.getElementById('questionForm')?.reset();
  }

  async handleQuestionSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('questionTitle').value.trim();
    if (!title) {
      utils.showNotification('Title is required.', 'error');
      return;
    }
    const description = document.getElementById('questionDescription').value.trim();
    const tagsInput = document.getElementById('questionTags').value.trim();
    const tags = utils.parseTags(tagsInput);

    try {
      const { error } = await supabase.from('questions').insert({
        title,
        description,
        tags,
        user_id: this.currentUser.id
      });
      if (error) throw error;
      this.closeQuestionModal();
      utils.showNotification('Question posted successfully!', 'success');
    } catch (error) {
      utils.handleError(error, 'Failed to post question.');
    }
  }

  handleNewQuestion(question) {
    this.questions.unshift(question);
    this.performSearch();
    if (question.user_id !== this.currentUser.id) {
      utils.showNotification('A new question was posted!', 'info');
    }
  }

  handleQuestionUpdate(updatedQuestion) {
    const index = this.questions.findIndex(q => q.id === updatedQuestion.id);
    if (index !== -1) {
      this.questions[index] = { ...this.questions[index], ...updatedQuestion };
      this.performSearch();
    }
  }

  handleQuestionDelete(deletedQuestion) {
    this.questions = this.questions.filter(q => q.id !== deletedQuestion.id);
    this.performSearch();
  }
}

window.closeQuestionModal = function() {
  document.getElementById('questionModal')?.classList.add('hidden');
};

document.addEventListener('DOMContentLoaded', () => {
  new HomePage();
});
