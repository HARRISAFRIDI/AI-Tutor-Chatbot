const signupPanel = document.querySelector("#signup-panel");
const signupForm = document.querySelector("#signup-form");
const signupName = document.querySelector("#signup-name");
const signupEmail = document.querySelector("#signup-email");
const signupButton = document.querySelector("#signup-button");
const signupStatus = document.querySelector("#signup-status");
const learnerIntro = document.querySelector("#learner-intro");
const workspace = document.querySelector("#workspace");
const identitySummary = document.querySelector("#identity-summary");
const courseSelect = document.querySelector("#course");
const chatSessionSelect = document.querySelector("#chat-session");
const newSessionButton = document.querySelector("#new-session-button");
const sessionList = document.querySelector("#session-list");
const sessionSearch = document.querySelector("#session-search");
const settingsButton = document.querySelector("#settings-button");
const profileButton = document.querySelector("#profile-button");
const settingsDialog = document.querySelector("#settings-dialog");
const themeSelect = document.querySelector("#theme-select");
const logoutButton = document.querySelector("#logout-button");
const mobileMenuButton = document.querySelector("#mobile-menu-button");
const sidebarOverlay = document.querySelector("#sidebar-overlay");
const chatContext = document.querySelector("#chat-context");
const composerWrapper = document.querySelector("#composer-wrapper");

/** Always keep the question input bar visible — call after any subject/session change. */
function ensureComposerVisible() {
  composerWrapper.classList.remove("hidden");
  composerWrapper.style.removeProperty("display");
}
const form = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const askButton = document.querySelector("#ask-button");
const formStatus = document.querySelector("#form-status");
const answerTitle = document.querySelector("#answer-title");
const answerContent = document.querySelector("#answer-content");
const sourceBadge = document.querySelector("#source-badge");
const metadata = document.querySelector("#metadata");
const adminPanel = document.querySelector("#admin-panel");
const courseForm = document.querySelector("#course-form");
const uploadForm = document.querySelector("#upload-form");
const uploadCourse = document.querySelector("#upload-course");
const lectureCourse = document.querySelector("#lecture-course");
const progressStudent = document.querySelector("#progress-student");
const courseStatus = document.querySelector("#course-status");
const uploadStatus = document.querySelector("#upload-status");
const adminViews = document.querySelectorAll("[data-admin-section]");
const adminNavItems = document.querySelectorAll("[data-admin-view]");

let currentStudent = JSON.parse(
  localStorage.getItem("tutor_student") || "null",
);
let availableCourses = [];
let currentSessionId = null;
let currentCourseId = null;
let loadedSessions = [];
let sessionLoadToken = 0;
let lastSubmittedQuestion = "";
let renderedMessages = [];
const API_BASE_URL = window.location.origin;

function showTutorWorkspace() {
  if (!currentStudent) return;
  signupPanel.classList.add("hidden");
  if (currentStudent.is_admin) {
    learnerIntro.classList.add("hidden");
    workspace.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    setAdminView("dashboard");
  } else {
    learnerIntro.classList.remove("hidden");
    workspace.classList.remove("hidden");
    adminPanel.classList.add("hidden");
    identitySummary.innerHTML = `<strong>${currentStudent.name}</strong><span>${currentStudent.email}</span>`;
  }
  loadOptions();
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupButton.disabled = true;
  signupButton.querySelector("span").textContent = "Creating...";
  signupStatus.textContent = "Creating your study identity...";

  try {
    const response = await fetch("/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: signupName.value.trim(),
        email: signupEmail.value.trim(),
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Signup failed.");
    currentStudent = result;
    localStorage.setItem("tutor_student", JSON.stringify(currentStudent));
    showTutorWorkspace();
  } catch (error) {
    signupStatus.textContent = error.message;
  } finally {
    signupButton.disabled = false;
    signupButton.querySelector("span").textContent = "Sign up";
  }
});

async function loadOptions() {
  try {
    const coursesResponse = await fetch("/courses");

    if (!coursesResponse.ok) {
      throw new Error("Could not load the tutor setup.");
    }

    availableCourses = (await coursesResponse.json()).courses;

    currentCourseId =
      localStorage.getItem("tutor_course_id") ||
      availableCourses[0]?.id ||
      null;

    courseSelect.innerHTML = availableCourses.length
      ? availableCourses
          .map(
            (course) =>
              `<option value="${course.id}" data-course-name="${course.name}">${course.code || "Course"} · ${course.name}</option>`,
          )
          .join("")
      : '<option value="">No courses found</option>';
    courseSelect.value = currentCourseId || "";
    uploadCourse.innerHTML = availableCourses.length
      ? availableCourses
          .map(
            (course) =>
              `<option value="${course.id}">${course.code || "Course"} · ${course.name}</option>`,
          )
          .join("")
      : '<option value="">No courses found</option>';
    lectureCourse.innerHTML = uploadCourse.innerHTML;
    formStatus.textContent = availableCourses.length
      ? "Ready when you are."
      : "No courses found.";
    await loadChatSessions();
  } catch (error) {
    courseSelect.innerHTML = '<option value="">Unable to load courses</option>';
    formStatus.textContent = error.message;
  }
}

async function loadChatSessions() {
  if (!currentStudent || !courseSelect.value) return;
  currentCourseId = courseSelect.value;
  localStorage.setItem("tutor_course_id", currentCourseId);
  const response = await fetch(
    `${API_BASE_URL}/chat-sessions?student_id=${currentStudent.id}&course_id=${currentCourseId}`,
  );
  if (!response.ok) return;
  const result = await response.json();
  loadedSessions = result.sessions;
  chatSessionSelect.innerHTML =
    '<option value="">New session</option>' +
    result.sessions
      .map(
        (session) =>
          `<option value="${session.id}">${session.title} (${session.message_count} messages)</option>`,
      )
      .join("");
  chatSessionSelect.value = currentSessionId || "";
  renderSessionList();
}

function renderSessionList() {
  const query = sessionSearch.value.trim().toLowerCase();
  const sessions = loadedSessions.filter((session) =>
    session.title.toLowerCase().includes(query),
  );
  const groups = { Today: [], Yesterday: [], "Previous 7 Days": [], Older: [] };
  sessions.forEach((session) =>
    groups[getSessionGroup(session.updated_at)].push(session),
  );
  sessionList.innerHTML = Object.entries(groups)
    .filter(([, items]) => items.length)
    .map(
      ([label, items]) =>
        `<div class="session-group"><p>${label}</p>${items.map(renderSessionItem).join("")}</div>`,
    )
    .join("");
}

function renderSessionItem(session) {
  return `<div class="session-row"><button class="session-item${session.id === currentSessionId ? " active" : ""}" type="button" data-session-id="${session.id}"><span>${escapeHtml(session.title)}</span><small>${session.message_count} messages</small></button><button class="session-menu-button" type="button" data-session-menu="${session.id}" aria-label="Actions for ${escapeHtml(session.title)}">⋮</button></div>`;
}

function getSessionGroup(value) {
  const date = new Date(value);
  const today = new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const sessionDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const days = Math.round((day - sessionDay) / 86400000);
  return days === 0
    ? "Today"
    : days === 1
      ? "Yesterday"
      : days <= 7
        ? "Previous 7 Days"
        : "Older";
}

function renderMessages(messages) {
  renderedMessages = messages;
  const messagesArea = document.querySelector("#messages-area");
  if (!messages.length) {
    answerContent.className = "answer-content welcome-state";
    answerContent.innerHTML = `<div class="welcome-hero">
      <div class="welcome-icon">✦</div>
      <h3>What would you like to learn today?</h3>
      <p>Ask anything about your course material and I\'ll find the answer from your lecture notes.</p>
    </div>`;
    if (messagesArea) {
      messagesArea.scrollTo({
        top: 0,
        behavior: "auto",
      });
    }
    return;
  }
  answerContent.className = "answer-content";
  answerContent.innerHTML = messages
    .map((message, index) => {
      const source =
        message.answer_source === "rag"
          ? "Course Material"
          : "General Knowledge";
      return `<article class="message ${message.role}" data-message-index="${index}"><p class="message-label">${message.role === "user" ? "You" : "AI Tutor"}</p>${message.role === "assistant" ? `<p class="message-source">${source}</p>` : ""}<div class="message-body">${message.role === "assistant" ? renderMarkdown(message.content) : escapeHtml(message.content).replaceAll("\n", "<br>")}</div>${message.role === "assistant" ? '<div class="message-actions"><button type="button" data-feedback="like" aria-label="Like answer">♡</button><button type="button" data-feedback="dislike" aria-label="Dislike answer">♧</button><button type="button" data-copy-message aria-label="Copy answer">Copy</button><button type="button" data-regenerate>Regenerate</button></div>' : ""}</article>`;
    })
    .join("");
  if (messagesArea) {
    messagesArea.scrollTop = messagesArea.scrollHeight;
    requestAnimationFrame(() => {
      messagesArea.scrollTo({
        top: messagesArea.scrollHeight,
        behavior: "auto",
      });
    });
  }
}

function renderMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/^### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
  html = html.replace(/^(?:- |\* )(.+)$/gm, "<li>$1</li>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (list) => `<ul>${list}</ul>`);
  return html
    .replace(/\n{2,}/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+?)(?=<h|<ul|$)/, "<p>$1</p>");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function loadChatSessionMessages() {
  if (!currentSessionId) return;
  const requestedSessionId = currentSessionId;
  const requestToken = ++sessionLoadToken;
  const response = await fetch(
    `/chat-sessions/${requestedSessionId}/messages?student_id=${currentStudent.id}`,
  );
  if (!response.ok) return;
  const result = await response.json();
  if (
    requestToken !== sessionLoadToken ||
    currentSessionId !== requestedSessionId
  ) {
    return;
  }
  const latestAnswer = [...result.messages]
    .reverse()
    .find((message) => message.role === "assistant");
  answerTitle.textContent = result.session.title || "Conversation";
  renderMessages(result.messages);
  if (latestAnswer) {
    sourceBadge.textContent =
      latestAnswer.answer_source === "rag"
        ? "Course Material"
        : "General Knowledge";
    sourceBadge.classList.remove("hidden");
  }
}

function formatApiError(detail, fallback) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.detail || JSON.stringify(item))
      .join("; ");
  }
  if (detail && typeof detail === "object") {
    return detail.msg || detail.detail || JSON.stringify(detail);
  }
  return fallback;
}

async function adminFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "X-Admin-Id": currentStudent.id, ...(options.headers || {}) },
  });
  const contentType = response.headers.get("content-type") || "";
  const result = contentType.includes("application/json")
    ? await response.json()
    : {};
  if (!response.ok)
    throw new Error(
      formatApiError(
        result.detail,
        `Admin request failed (${response.status}).`,
      ),
    );
  return result;
}

function setAdminView(viewName) {
  adminViews.forEach((view) =>
    view.classList.toggle("active", view.dataset.adminSection === viewName),
  );
  adminNavItems.forEach((item) =>
    item.classList.toggle("active", item.dataset.adminView === viewName),
  );
  const loaders = {
    dashboard: loadAdminDashboard,
    courses: loadAdminCourses,
    lectures: loadAdminLectures,
    students: loadAdminStudents,
    progress: loadAdminProgress,
    system: loadAdminSystem,
    activity: loadAdminActivity,
  };
  if (loaders[viewName]) loaders[viewName]();
}

async function loadAdminDashboard() {
  try {
    const result = await adminFetch("/admin/dashboard");
    document.querySelector("#dashboard-stats").innerHTML = Object.entries(
      result.stats,
    )
      .map(
        ([label, value]) =>
          `<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`,
      )
      .join("");
    document.querySelector("#dashboard-status").textContent =
      `RAG index: ${result.rag.index} · Database: ${result.rag.database}`;
  } catch (error) {
    document.querySelector("#dashboard-status").textContent = error.message;
  }
}

async function loadAdminCourses() {
  try {
    const result = await adminFetch("/admin/courses");
    document.querySelector("#course-list").innerHTML = result.courses.length
      ? `<table><thead><tr><th>Course</th><th>Code</th><th>Documents</th><th>Chunks</th><th></th></tr></thead><tbody>${result.courses.map((course) => `<tr><td><strong>${course.name}</strong><small>${course.description || ""}</small></td><td>${course.code || "—"}</td><td>${course.documents}</td><td>${course.chunks}</td><td><button class="table-action" data-edit-course="${course.id}">Edit</button><button class="table-action danger" data-delete-course="${course.id}">Delete</button></td></tr>`).join("")}</tbody></table>`
      : '<p class="empty-admin">No courses yet.</p>';
  } catch (error) {
    document.querySelector("#course-list").textContent = error.message;
  }
}

async function loadAdminLectures() {
  if (!lectureCourse.value) {
    document.querySelector("#lecture-list").innerHTML =
      '<p class="empty-admin">Select a course to view lectures.</p>';
    return;
  }
  try {
    const result = await adminFetch(
      `/admin/courses/${lectureCourse.value}/documents`,
    );
    document.querySelector("#lecture-list").innerHTML = result.documents.length
      ? `<table><thead><tr><th>Lecture</th><th>Chunks</th><th>Uploaded</th><th></th></tr></thead><tbody>${result.documents.map((document) => `<tr><td><strong>${document.title}</strong><small>${document.file_name}</small></td><td>${document.chunks}</td><td>${document.created_at ? new Date(document.created_at).toLocaleDateString() : "—"}</td><td><button class="table-action" data-reindex-document="${document.id}">Re-index</button><button class="table-action" data-replace-document="${document.id}">Replace</button><button class="table-action danger" data-delete-document="${document.id}">Delete</button></td></tr>`).join("")}</tbody></table>`
      : '<p class="empty-admin">No lectures uploaded for this course.</p>';
  } catch (error) {
    document.querySelector("#lecture-list").textContent = error.message;
  }
}

async function loadAdminStudents() {
  try {
    const result = await adminFetch("/admin/students");
    progressStudent.innerHTML = result.students
      .map(
        (student) =>
          `<option value="${student.id}">${student.name} · ${student.email}</option>`,
      )
      .join("");
    document.querySelector("#student-list").innerHTML = result.students.length
      ? `<table><thead><tr><th>Student</th><th>Role</th><th>Conversations</th><th>Messages</th><th></th></tr></thead><tbody>${result.students.map((student) => `<tr><td><strong>${student.name}</strong><small>${student.email}</small></td><td>${student.is_admin ? "Admin" : "Student"}</td><td>${student.conversations}</td><td>${student.messages}</td><td><button class="table-action" data-progress-student="${student.id}">Progress</button><button class="table-action" data-manage-student="${student.id}">Manage</button></td></tr>`).join("")}</tbody></table>`
      : '<p class="empty-admin">No students yet.</p>';
  } catch (error) {
    document.querySelector("#student-list").textContent = error.message;
  }
}

async function loadAdminProgress() {
  if (!progressStudent.value) return;
  try {
    const result = await adminFetch(
      `/admin/students/${progressStudent.value}/progress`,
    );
    const student = result.student;
    document.querySelector("#progress-card").innerHTML =
      `<div class="progress-card-inner"><strong>${student.name}</strong><span>${student.email}</span><div><b>${student.conversations}</b><small>Conversations</small></div><div><b>${student.messages}</b><small>Messages</small></div><p>Last activity: ${student.last_activity ? new Date(student.last_activity).toLocaleString() : "No activity"}</p></div>`;
  } catch (error) {
    document.querySelector("#progress-card").textContent = error.message;
  }
}

async function loadAdminSystem() {
  try {
    const result = await adminFetch("/admin/dashboard");
    document.querySelector("#system-status").innerHTML =
      `<div class="system-row"><span>RAG status</span><strong>${result.rag.index}</strong></div><div class="system-row"><span>Database</span><strong>${result.rag.database}</strong></div><div class="system-row"><span>Indexed documents</span><strong>${result.stats.documents}</strong></div><div class="system-row"><span>Indexed chunks</span><strong>${result.stats.chunks}</strong></div><div class="system-row"><span>Stored messages</span><strong>${result.stats.messages}</strong></div>`;
  } catch (error) {
    document.querySelector("#system-status").textContent = error.message;
  }
}

async function loadAdminActivity() {
  try {
    const result = await adminFetch("/admin/activity");
    document.querySelector("#activity-list").innerHTML = result.activity.length
      ? `<table><thead><tr><th>Time</th><th>Student</th><th>Course</th><th>Role</th><th>Content</th></tr></thead><tbody>${result.activity.map((entry) => `<tr><td>${new Date(entry.created_at).toLocaleString()}</td><td>${entry.student_name}</td><td>${entry.course_code}</td><td>${entry.role}</td><td>${entry.content}</td></tr>`).join("")}</tbody></table>`
      : '<p class="empty-admin">No activity recorded.</p>';
  } catch (error) {
    document.querySelector("#activity-list").textContent = error.message;
  }
}

async function refreshAdminData() {
  await loadOptions();
  setAdminView(
    document.querySelector("[data-admin-section].active")?.dataset
      .adminSection || "dashboard",
  );
}

adminNavItems.forEach((item) =>
  item.addEventListener("click", () => setAdminView(item.dataset.adminView)),
);
document
  .querySelectorAll("[data-refresh-admin]")
  .forEach((button) => button.addEventListener("click", refreshAdminData));
lectureCourse.addEventListener("change", loadAdminLectures);
progressStudent.addEventListener("change", loadAdminProgress);

document
  .querySelector("#course-list")
  .addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-course]");
    const deleteButton = event.target.closest("[data-delete-course]");
    try {
      if (editButton) {
        const course = availableCourses.find(
          (item) => item.id === editButton.dataset.editCourse,
        );
        const name = prompt("Course name", course?.name || "");
        const code = prompt("Course code", course?.code || "");
        const description = prompt("Description", course?.description || "");
        if (name === null || code === null || description === null) return;
        await adminFetch(`/admin/courses/${editButton.dataset.editCourse}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, code, description }),
        });
        await refreshAdminData();
      }
      if (
        deleteButton &&
        confirm(
          "Delete this course and its lectures, conversations, and enrollments?",
        )
      ) {
        await adminFetch(
          `/admin/courses/${deleteButton.dataset.deleteCourse}`,
          { method: "DELETE" },
        );
        await refreshAdminData();
      }
    } catch (error) {
      alert(error.message);
    }
  });

document.querySelector("#student-list").addEventListener("click", (event) => {
  const progressButton = event.target.closest("[data-progress-student]");
  const manageButton = event.target.closest("[data-manage-student]");
  if (progressButton) {
    progressStudent.value = progressButton.dataset.progressStudent;
    setAdminView("progress");
  }
  if (manageButton) manageStudent(manageButton.dataset.manageStudent);
});

async function manageStudent(studentId) {
  const students = await adminFetch("/admin/students");
  const student = students.students.find((item) => item.id === studentId);
  if (!student) return;
  const name = prompt("Student name", student.name);
  const email = prompt("Student email", student.email);
  const isAdmin = confirm(
    "Make this student an admin? Click Cancel for regular student.",
  );
  if (name === null || email === null) return;
  try {
    await adminFetch(`/admin/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, is_admin: isAdmin }),
    });
    await loadAdminStudents();
  } catch (error) {
    alert(error.message);
  }
}

document
  .querySelector("#lecture-list")
  .addEventListener("click", async (event) => {
    const reindexButton = event.target.closest("[data-reindex-document]");
    const deleteButton = event.target.closest("[data-delete-document]");
    const replaceButton = event.target.closest("[data-replace-document]");
    try {
      if (reindexButton)
        await adminFetch(
          `/admin/documents/${reindexButton.dataset.reindexDocument}/reindex`,
          { method: "POST" },
        );
      if (
        deleteButton &&
        confirm("Delete this lecture and all indexed chunks?")
      )
        await adminFetch(
          `/admin/documents/${deleteButton.dataset.deleteDocument}`,
          { method: "DELETE" },
        );
      if (replaceButton) {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".pdf,application/pdf";
        input.onchange = async () => {
          const data = new FormData();
          data.append("file", input.files[0]);
          await adminFetch(
            `/admin/documents/${replaceButton.dataset.replaceDocument}`,
            { method: "PUT", body: data },
          );
          await loadAdminLectures();
        };
        input.click();
      }
      await loadAdminLectures();
    } catch (error) {
      alert(error.message);
    }
  });

function showAnswer(result) {
  // Remove the thinking indicator
  const thinkingMsg = answerContent.querySelector(".thinking-msg");
  if (thinkingMsg) thinkingMsg.remove();

  const source =
    result.answer_source === "rag" ? "Course Material" : "General Knowledge";
  const answerText = result.answer || "The tutor returned an empty answer.";

  // Track this message for copy/feedback/regenerate
  const messageIndex = renderedMessages.length;
  renderedMessages = renderedMessages.concat([
    { role: "user", content: lastSubmittedQuestion },
    {
      role: "assistant",
      content: answerText,
      answer_source: result.answer_source,
    },
  ]);

  // Append the assistant reply article
  const assistantEl = document.createElement("article");
  assistantEl.className = "message assistant";
  assistantEl.dataset.messageIndex = String(messageIndex + 1);
  assistantEl.innerHTML = `<p class="message-label">AI Tutor</p><p class="message-source">${source}</p><div class="message-body">${renderMarkdown(answerText)}</div><div class="message-actions"><button type="button" data-feedback="like" aria-label="Like answer">♡</button><button type="button" data-feedback="dislike" aria-label="Dislike answer">♧</button><button type="button" data-copy-message aria-label="Copy answer">Copy</button><button type="button" data-regenerate>Regenerate</button></div>`;
  answerContent.appendChild(assistantEl);

  const messagesArea = document.querySelector("#messages-area");
  if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;

  sourceBadge.textContent =
    result.answer_source === "rag" ? "Course Material" : "General Knowledge";
  sourceBadge.classList.remove("hidden");
  metadata.classList.remove("hidden");
  document.querySelector("#chunks").textContent = result.retrieved_chunks;
  document.querySelector("#score").textContent = Number(
    result.retrieval_score,
  ).toFixed(3);
  document.querySelector("#quality").textContent = result.quality_passed
    ? "Passed"
    : "Review";
  document.querySelector("#saved").textContent = result.message_saved
    ? "Yes"
    : "No";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  lastSubmittedQuestion = questionInput.value.trim();
  if (!lastSubmittedQuestion) return;

  askButton.disabled = true;
  askButton.querySelector("span").textContent = "Thinking...";
  formStatus.textContent = "Searching your course material...";

  // Show a thinking indicator appended to existing messages
  const messagesArea = document.querySelector("#messages-area");
  answerContent.className = "answer-content";
  const thinkingEl = document.createElement("article");
  thinkingEl.className = "message assistant thinking-msg";
  thinkingEl.innerHTML = `<p class="message-label">AI Tutor</p><div class="message-body"><span class="thinking-dots"><span></span><span></span><span></span></span></div>`;
  // Append user message then thinking
  const userEl = document.createElement("article");
  userEl.className = "message user";
  userEl.innerHTML = `<p class="message-label">You</p><div class="message-body">${escapeHtml(lastSubmittedQuestion).replaceAll("\n", "<br>")}</div>`;
  answerContent.appendChild(userEl);
  answerContent.appendChild(thinkingEl);
  if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
  sourceBadge.classList.add("hidden");
  metadata.classList.add("hidden");

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: currentStudent.id,
        course_id: courseSelect.value,
        course_name: availableCourses.find(
          (course) => course.id === courseSelect.value,
        )?.name,
        session_id: currentSessionId,
        question: lastSubmittedQuestion,
      }),
    });
    const contentType = response.headers.get("content-type") || "";
    const result = contentType.includes("application/json")
      ? await response.json()
      : null;
    if (!response.ok) {
      throw new Error(
        formatApiError(
          result?.detail,
          `Tutor request failed (${response.status}). Please try again.`,
        ),
      );
    }
    currentSessionId = result.session_id;
    await loadChatSessions();
    chatSessionSelect.value = currentSessionId;
    showAnswer(result);
    questionInput.value = "";
    questionInput.style.height = "auto";
    formStatus.textContent = result.message_saved
      ? "Answer saved to your study history."
      : "Answer ready; history was not saved.";
  } catch (error) {
    // Remove the thinking indicator if present
    const thinkingMsg = answerContent.querySelector(".thinking-msg");
    if (thinkingMsg) thinkingMsg.remove();
    // Append an error message bubble
    const errEl = document.createElement("article");
    errEl.className = "message assistant";
    errEl.innerHTML = `<p class="message-label">AI Tutor</p><div class="message-body" style="color:#9b493c;background:#f7dfd8;border-color:#eab99d">${escapeHtml(error.message)}</div>`;
    answerContent.appendChild(errEl);
    const messagesArea = document.querySelector("#messages-area");
    if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
    formStatus.textContent = "Try again in a moment.";
  } finally {
    askButton.disabled = false;
    askButton.querySelector("span").textContent = "Send";
  }
});

sessionList.addEventListener("click", async (event) => {
  const menuButton = event.target.closest("[data-session-menu]");
  if (menuButton) {
    event.stopPropagation();
    const session = loadedSessions.find(
      (item) => item.id === menuButton.dataset.sessionMenu,
    );
    if (!session) return;
    const action = window.prompt(
      `Manage "${session.title}"\nType rename or delete:`,
      "rename",
    );
    if (action?.toLowerCase() === "rename") {
      const title = window
        .prompt("New conversation title:", session.title)
        ?.trim();
      if (title) await renameSession(session.id, title);
    } else if (action?.toLowerCase() === "delete") {
      await deleteSession(session.id);
    }
    return;
  }
  const sessionItem = event.target.closest("[data-session-id]");
  if (!sessionItem) return;
  currentSessionId = sessionItem.dataset.sessionId;
  chatSessionSelect.value = currentSessionId;
  ensureComposerVisible();
  await loadChatSessions();
  await loadChatSessionMessages();
});

courseSelect.addEventListener("change", async () => {
  currentCourseId = courseSelect.value;
  localStorage.setItem("tutor_course_id", currentCourseId);
  currentSessionId = null;
  ensureComposerVisible();
  questionInput.value = "";
  questionInput.style.height = "auto";
  formStatus.textContent = "Ready for a question in this course.";
  answerTitle.textContent = "";
  chatContext.textContent =
    getSelectedCourse()?.name || "Course material assistant";
  sourceBadge.classList.add("hidden");
  metadata.classList.add("hidden");
  renderMessages([]);
  questionInput.focus();
  await loadChatSessions();
});

chatSessionSelect.addEventListener("change", async () => {
  currentSessionId = chatSessionSelect.value || null;
  ensureComposerVisible();
  await loadChatSessions();
  if (currentSessionId) {
    await loadChatSessionMessages();
  } else {
    answerTitle.textContent = "";
    sourceBadge.classList.add("hidden");
    renderMessages([]);
  }
});

newSessionButton.addEventListener("click", async () => {
  sessionLoadToken += 1;
  const studentId = currentStudent?.id;
  const courseId = courseSelect.value || currentCourseId;
  if (!studentId || !courseId) {
    formStatus.textContent = "Select a course before starting a chat.";
    return;
  }
  const response = await fetch(
    `${API_BASE_URL}/chat-sessions?student_id=${encodeURIComponent(studentId)}&course_id=${encodeURIComponent(courseId)}`,
    { method: "POST" },
  );
  if (!response.ok) {
    let detail = "Could not start a new chat.";
    try {
      const error = await response.json();
      detail = formatApiError(error.detail, detail);
    } catch {
      // Keep the friendly fallback when the server does not return JSON.
    }
    formStatus.textContent = detail;
    return;
  }
  const result = await response.json();
  currentCourseId = courseId;
  currentSessionId = result.session.id;
  loadedSessions = [result.session, ...loadedSessions];
  chatSessionSelect.value = currentSessionId;
  sessionSearch.value = "";
  renderSessionList();
  ensureComposerVisible();
  answerTitle.textContent = "";
  chatContext.textContent =
    getSelectedCourse()?.name || "Course material assistant";
  sourceBadge.classList.add("hidden");
  metadata.classList.add("hidden");
  renderMessages([]);
  formStatus.textContent = "Ready for a new question.";
  questionInput.value = "";
  questionInput.style.height = "auto";
  questionInput.focus();
});

async function renameSession(sessionId, title) {
  const response = await fetch(
    `${API_BASE_URL}/chat-sessions/${sessionId}?student_id=${currentStudent.id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    },
  );
  if (!response.ok) return;
  const session = loadedSessions.find((item) => item.id === sessionId);
  if (session) session.title = title;
  renderSessionList();
  if (currentSessionId === sessionId) answerTitle.textContent = title;
}

async function deleteSession(sessionId) {
  if (
    !window.confirm(
      "Delete this conversation?\n\nThis action cannot be undone.",
    )
  )
    return;
  const response = await fetch(
    `${API_BASE_URL}/chat-sessions/${sessionId}?student_id=${currentStudent.id}`,
    { method: "DELETE" },
  );
  if (!response.ok) return;
  loadedSessions = loadedSessions.filter((session) => session.id !== sessionId);
  if (currentSessionId === sessionId) {
    currentSessionId = null;
    renderMessages([]);
    answerTitle.textContent = "";
    sourceBadge.classList.add("hidden");
    metadata.classList.add("hidden");
  }
  renderSessionList();
}

function getSelectedCourse() {
  return availableCourses.find((course) => course.id === currentCourseId);
}

sessionSearch.addEventListener("input", renderSessionList);

answerContent.addEventListener("click", async (event) => {
  const message = event.target.closest(".message.assistant");
  if (!message) return;
  const messageData = renderedMessages[Number(message.dataset.messageIndex)];
  if (!messageData) return;
  if (event.target.closest("[data-copy-message]")) {
    const copyButton = event.target.closest("[data-copy-message]");
    try {
      await navigator.clipboard.writeText(messageData.content);
      copyButton.textContent = "Copied";
      window.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1200);
    } catch {
      formStatus.textContent = "Copy was blocked by the browser.";
    }
  }
  const feedback = event.target.closest("[data-feedback]");
  if (feedback) {
    localStorage.setItem(
      `tutor_feedback_${messageData.content.slice(0, 30)}`,
      feedback.dataset.feedback,
    );
    feedback.classList.add("selected");
  }
  if (event.target.closest("[data-regenerate]")) {
    const userMessage = [...renderedMessages]
      .reverse()
      .find((item) => item.role === "user")?.content;
    if (userMessage) {
      questionInput.value = userMessage;
      form.requestSubmit();
    }
  }
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

questionInput.addEventListener("input", () => {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("tutor_theme", theme);
}

themeSelect.value = localStorage.getItem("tutor_theme") || "system";
applyTheme(themeSelect.value);
themeSelect.addEventListener("change", () => applyTheme(themeSelect.value));
settingsButton.addEventListener("click", () => settingsDialog.showModal());
profileButton.addEventListener("click", () =>
  window.alert(
    `${currentStudent?.name || "Student"}\n${currentStudent?.email || ""}`,
  ),
);

logoutButton.addEventListener("click", () => {
  if (!window.confirm("Log out of University AI Tutor?")) return;
  localStorage.removeItem("tutor_student");
  currentStudent = null;
  currentSessionId = null;
  loadedSessions = [];
  renderSessionList();
  renderMessages([]);
  signupPanel.classList.remove("hidden");
  learnerIntro.classList.remove("hidden");
  workspace.classList.add("hidden");
  adminPanel.classList.add("hidden");
  questionInput.value = "";
  formStatus.textContent = "Ready when you are.";
});

function toggleSidebar(open) {
  document.body.classList.toggle("sidebar-open", open);
  sidebarOverlay.classList.toggle("hidden", !open);
}

mobileMenuButton.addEventListener("click", () => toggleSidebar(true));
sidebarOverlay.addEventListener("click", () => toggleSidebar(false));

courseForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  courseStatus.textContent = "Creating course...";
  const response = await fetch("/admin/courses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Id": currentStudent.id,
    },
    body: JSON.stringify({
      name: document.querySelector("#course-name").value.trim(),
      code: document.querySelector("#course-code").value.trim(),
      description: document.querySelector("#course-description").value.trim(),
    }),
  });
  const result = await response.json();
  courseStatus.textContent = response.ok
    ? "Course created."
    : formatApiError(result.detail, "Course creation failed.");
  if (response.ok) {
    courseForm.reset();
    await loadOptions();
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = document.querySelector("#pdf-file").files[0];
  if (!file) return;
  uploadStatus.textContent = "Uploading and indexing PDF...";
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `/admin/courses/${uploadCourse.value}/documents`,
    {
      method: "POST",
      headers: { "X-Admin-Id": currentStudent.id },
      body: formData,
    },
  );
  const result = await response.json();
  uploadStatus.textContent = response.ok
    ? `${result.chunks_indexed} chunks indexed successfully.`
    : formatApiError(result.detail, "PDF upload failed.");
  if (response.ok) uploadForm.reset();
});

showTutorWorkspace();
