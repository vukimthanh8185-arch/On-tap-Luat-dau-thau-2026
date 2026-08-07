const topics = window.STUDY_DATA?.topics || [];
const meta = window.STUDY_DATA?.generatedFrom || {};

let currentTopic = 0;
let currentTab = "theory";
const answered = new Map();

const topicList = document.getElementById("topicList");
const searchInput = document.getElementById("searchInput");
const topicIndex = document.getElementById("topicIndex");
const topicTitle = document.getElementById("topicTitle");
const theoryPanel = document.getElementById("theoryPanel");
const practicePanel = document.getElementById("practicePanel");
const theoryTab = document.getElementById("theoryTab");
const practiceTab = document.getElementById("practiceTab");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");

function totalQuestions() {
  return topics.reduce((sum, topic) => sum + topic.questions.length, 0);
}

function answeredCount() {
  return answered.size;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function updateProgress() {
  const total = totalQuestions();
  const done = answeredCount();
  progressText.textContent = `${done}/${total}`;
  progressBar.style.width = total ? `${(done / total) * 100}%` : "0%";
}

function renderTheoryTables(section) {
  return (section.tables || [])
    .map(
      (table) => `
        <div class="theory-table-wrap">
          <table class="theory-table">
            <thead>
              <tr>${(table.headers || []).map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${(table.rows || [])
                .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
                .join("")}
            </tbody>
          </table>
        </div>
      `
    )
    .join("");
}

function renderTopics(filter = "") {
  const keyword = filter.trim().toLowerCase();
  topicList.innerHTML = "";

  topics.forEach((topic, index) => {
    const haystack = [
      topic.title,
      ...topic.theory.flatMap((item) => [item.heading, ...(item.points || [])]),
      ...topic.questions.flatMap((q) => [q.question, q.originalTopic || "", ...(q.options || [])])
    ]
      .join(" ")
      .toLowerCase();

    if (keyword && !haystack.includes(keyword)) return;

    const correctInTopic = topic.questions.filter((_, qIndex) => {
      const key = questionKey(index, qIndex);
      return answered.get(key) === topic.questions[qIndex].answer;
    }).length;
    const answeredInTopic = topic.questions.filter((_, qIndex) => answered.has(questionKey(index, qIndex))).length;

    const btn = document.createElement("button");
    btn.className = `topic-btn ${index === currentTopic ? "active" : ""}`;
    btn.type = "button";
    btn.innerHTML = `
      <span class="topic-number">${index + 1}</span>
      <span>
        <span class="topic-name">${escapeHtml(topic.title)}</span>
        <span class="topic-meta">${topic.questions.length} câu · đã làm ${answeredInTopic}/${topic.questions.length} · đúng ${correctInTopic}</span>
      </span>
    `;
    btn.addEventListener("click", () => {
      currentTopic = index;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    topicList.appendChild(btn);
  });

  if (!topicList.children.length) {
    topicList.innerHTML = `<div class="empty-state">Không tìm thấy chủ đề phù hợp.</div>`;
  }
}

function renderTheory(topic) {
  theoryPanel.innerHTML = `
    <div class="practice-summary">
      <span class="pill">${topic.theory.length} mục lý thuyết</span>
      <span class="pill">${topic.questions.length} câu thực hành</span>
      <span class="pill">Nguồn: PDF đáp án + slide + văn bản luật</span>
    </div>
    <div class="theory-grid">
      ${topic.theory
        .map(
          (section) => `
        <article class="theory-card">
          <h3>${escapeHtml(section.heading)}</h3>
          ${
            (section.points || []).length
              ? `<ul>${(section.points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>`
              : ""
          }
          ${renderTheoryTables(section)}
          ${section.note ? `<div class="callout">${escapeHtml(section.note)}</div>` : ""}
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

function questionKey(topicIndexValue, questionIndex) {
  return `${topicIndexValue}-${questionIndex}`;
}

function renderPractice(topic) {
  const answeredInTopic = topic.questions.filter((_, qIndex) => answered.has(questionKey(currentTopic, qIndex))).length;
  const correctInTopic = topic.questions.filter((q, qIndex) => answered.get(questionKey(currentTopic, qIndex)) === q.answer).length;

  practicePanel.innerHTML = `
    <div class="practice-summary">
      <span class="pill">${topic.questions.length} câu hỏi</span>
      <span class="pill">Đã làm ${answeredInTopic}/${topic.questions.length}</span>
      <span class="pill">Đúng ${correctInTopic}</span>
      <button class="mini-btn" type="button" id="resetTopicBtn">Làm lại chủ đề này</button>
    </div>
    <div class="question-list">
      ${topic.questions.map((q, qIndex) => renderQuestion(q, qIndex)).join("")}
    </div>
  `;

  const resetBtn = document.getElementById("resetTopicBtn");
  resetBtn.addEventListener("click", resetCurrentTopic);

  topic.questions.forEach((q, qIndex) => {
    q.options.forEach((_, optionIndex) => {
      const input = document.getElementById(`q-${qIndex}-o-${optionIndex}`);
      if (input) input.addEventListener("change", () => selectAnswer(qIndex, optionIndex));
    });
  });
}

function renderQuestion(q, qIndex) {
  const key = questionKey(currentTopic, qIndex);
  const chosen = answered.get(key);
  const hasAnswered = typeof chosen === "number";
  const isCorrect = chosen === q.answer;
  const sourceLine = [q.originalTopic, q.source ? `Nguồn: ${q.source}` : null, q.number ? `Câu gốc: ${q.number}` : null]
    .filter(Boolean)
    .join(" · ");

  return `
    <article class="question-card" id="card-${qIndex}">
      <p class="question-source">${escapeHtml(sourceLine)}</p>
      <h3>Câu ${qIndex + 1}. ${escapeHtml(q.question)}</h3>
      <div class="options">
        ${(q.options || [])
          .map((option, optionIndex) => {
            const selectedClass =
              hasAnswered && optionIndex === chosen
                ? isCorrect
                  ? "correct"
                  : "wrong"
                : hasAnswered && optionIndex === q.answer
                  ? "correct"
                  : "";
            return `
              <label class="option ${selectedClass}" for="q-${qIndex}-o-${optionIndex}">
                <input
                  id="q-${qIndex}-o-${optionIndex}"
                  type="radio"
                  name="q-${qIndex}"
                  ${hasAnswered ? "disabled" : ""}
                  ${chosen === optionIndex ? "checked" : ""}
                />
                <span><strong>${String.fromCharCode(65 + optionIndex)}.</strong> ${escapeHtml(option)}</span>
              </label>
            `;
          })
          .join("")}
      </div>
      <div class="feedback ${hasAnswered ? "show" : ""} ${isCorrect ? "correct" : "wrong"}" id="feedback-${qIndex}">
        ${
          hasAnswered
            ? `<strong>${isCorrect ? "Đúng rồi." : "Chưa đúng."} Đáp án đúng là ${String.fromCharCode(
                65 + q.answer
              )}.</strong><span>${escapeHtml(q.explanation)}</span>`
            : ""
        }
      </div>
    </article>
  `;
}

function selectAnswer(qIndex, optionIndex) {
  const key = questionKey(currentTopic, qIndex);
  if (answered.has(key)) return;
  answered.set(key, optionIndex);
  renderPractice(topics[currentTopic]);
  renderTopics(searchInput.value);
  updateProgress();
  const card = document.getElementById(`card-${qIndex}`);
  card?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetCurrentTopic() {
  topics[currentTopic].questions.forEach((_, qIndex) => answered.delete(questionKey(currentTopic, qIndex)));
  render();
}

function setTab(tab) {
  currentTab = tab;
  theoryTab.classList.toggle("active", tab === "theory");
  practiceTab.classList.toggle("active", tab === "practice");
  theoryPanel.classList.toggle("active", tab === "theory");
  practicePanel.classList.toggle("active", tab === "practice");
}

function render() {
  if (!topics.length) {
    topicTitle.textContent = "Chưa có dữ liệu ôn tập";
    theoryPanel.innerHTML = `<div class="empty-state">Không tìm thấy dữ liệu. Hãy kiểm tra file data.js.</div>`;
    practicePanel.innerHTML = "";
    updateProgress();
    return;
  }

  const topic = topics[currentTopic];
  topicIndex.textContent = `Phần ${currentTopic + 1}/${topics.length} · Tổng ${meta.questionCount || totalQuestions()} câu`;
  topicTitle.textContent = topic.title;
  renderTopics(searchInput.value);
  renderTheory(topic);
  renderPractice(topic);
  setTab(currentTab);
  updateProgress();
}

theoryTab.addEventListener("click", () => setTab("theory"));
practiceTab.addEventListener("click", () => setTab("practice"));
searchInput.addEventListener("input", (event) => renderTopics(event.target.value));

render();
