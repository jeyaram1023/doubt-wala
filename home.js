// home.js

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

    // ✅ Check authentication
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      utils.showNotification("Please log in first.", "error");
      return;
    }
    this.currentUser = user;

    // ✅ Ensure user exists in user_profiles
    await this.ensureUserProfile(user);

    // Setup events
    this.setupEventListeners();

    // Load questions
    await this.loadQuestions();

    // Setup realtime
    this.setupRealtime();
  }

  async ensureUserProfile(user) {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!data) {
        await supabase.from("user_profiles").insert({
          id: user.id,
          display_name: user.email.split("@")[0],
          email: user.email,
        });
        console.log("User profile created");
      }
    } catch (err) {
      console.error("Error ensuring profile:", err.message);
    }
  }

  setupEventListeners() {
    const askQuestionBtn = document.getElementById("askQuestionBtn");
    if (askQuestionBtn) {
      askQuestionBtn.addEventListener("click", () => this.openQuestionModal());
    }

    const questionForm = document.getElementById("questionForm");
    if (questionForm) {
      questionForm.addEventListener("submit", (e) => this.handleQuestionSubmit(e));
    }

    const searchInput = document.getElementById("searchInput");
    const searchBtn = document.getElementById("searchBtn");

    if (searchInput) {
      searchInput.addEventListener("input", () => this.searchDebounced());
      searchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          this.performSearch();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener("click", () => this.performSearch());
    }
  }

  setupRealtime() {
    realtimeManager.subscribeToQuestions({
      onInsert: (q) => this.handleNewQuestion(q),
      onUpdate: (u, o) => this.handleQuestionUpdate(u, o),
      onDelete: (d) => this.handleQuestionDelete(d),
    });
  }

  async loadQuestions() {
    const container = document.getElementById("questionsContainer");
    utils.showLoading(container, "Loading questions...");

    try {
      const { data, error } = await supabase
        .from("questions")
        .select(`
          *,
          user_profiles (
            display_name,
            email
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      this.questions = data || [];
      this.filteredQuestions = [...this.questions];
      this.renderQuestions();
    } catch (err) {
      utils.handleError(err, "Failed to load questions");
      utils.showEmptyState(
        container,
        "Failed to Load Questions",
        "There was an error loading the questions. Please try again.",
        {
          text: "Retry",
          action: "window.location.reload()",
        }
      );
    }
  }

  renderQuestions() {
    const container = document.getElementById("questionsContainer");

    if (!this.filteredQuestions.length) {
      utils.showEmptyState(
        container,
        "No Questions Found",
        "Be the first to ask a question!",
        {
          text: "Ask Question",
          action: "document.querySelector('#askQuestionBtn').click()",
        }
      );
      return;
    }

    container.innerHTML = this.filteredQuestions
      .map((q) => this.renderQuestionCard(q))
      .join("");
  }

  renderQuestionCard(question) {
    const author = question.user_profiles || {};
    const displayName = author.display_name || author.email?.split("@")[0] || "Anonymous";
    const tags = utils.formatTags(question.tags);
    const timeAgo = utils.formatRelativeTime(question.created_at);

    return `
      <div class="question-card" onclick="window.location.href='question.html?id=${question.id}'">
        <div class="question-header">
          <h3>${utils.escapeHtml(question.title)}</h3>
          ${question.description ? <p>${utils.escapeHtml(question.description)}</p> : ""}
        </div>
        ${tags.length ? `<div class="question-tags">${tags.map(t => <span class="tag">${t}</span>).join("")}</div>` : ""}
        <div class="question-footer">
          <span>👤 ${displayName}</span>
          <span>🕒 ${timeAgo}</span>
        </div>
      </div>
    `;
  }

  async handleQuestionSubmit(e) {
    e.preventDefault();

    const title = document.getElementById("questionTitle").value.trim();
    const description = document.getElementById("questionDescription").value.trim();
    const tagsInput = document.getElementById("questionTags").value.trim();

    if (!title) {
      utils.showNotification("Please enter a question title", "error");
      return;
    }

    const tags = utils.parseTags(tagsInput);

    try {
      const { error } = await supabase.from("questions").insert({
        title,
        description,
        tags,
        user_id: this.currentUser.id, // 👈 logged in user id
      });

      if (error) throw error;

      this.closeQuestionModal();
      document.getElementById("questionForm").reset();
      utils.showNotification("Question posted successfully!", "success");
    } catch (err) {
      utils.handleError(err, "Failed to post question. Please try again.");
    }
  }

  openQuestionModal() {
    document.getElementById("questionModal").classList.remove("hidden");
  }

  closeQuestionModal() {
    document.getElementById("questionModal").classList.add("hidden");
  }

  handleNewQuestion(q) {
    this.questions.unshift(q);
    this.performSearch();
    if (q.user_id !== this.currentUser.id) {
      utils.showNotification("New question posted!", "success");
    }
  }

  handleQuestionUpdate(u, o) {
    const index = this.questions.findIndex((q) => q.id === u.id);
    if (index !== -1) {
      this.questions[index] = u;
      this.performSearch();
    }
  }

  handleQuestionDelete(d) {
    this.questions = this.questions.filter((q) => q.id !== d.id);
    this.performSearch();
  }

  performSearch() {
    const searchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
    this.filteredQuestions = this.questions.filter((q) =>
      q.title.toLowerCase().includes(searchTerm) ||
      q.description?.toLowerCase().includes(searchTerm)
    );
    this.renderQuestions();
  }
}

document.addEventListener("DOMContentLoaded", () => new HomePage());
