// Configuration
// API Configuration
// IMPORTANT: Replace 'YOUR_PRODUCTION_URL' with your actual deployed backend URL
// Example: https://your-app-name.vercel.app or https://your-app.onrender.com
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3000/api/generate-exam'
    : 'https://YOUR_PRODUCTION_URL/api/generate-exam';

// State Management
const state = {
    currentView: 'upload-view',
    theme: 'light',
    examData: [],
    userAnswers: {}, // { questionIndex: optionIndex }
    currentQuestionIndex: 0,
    timerInterval: null,
    timeRemaining: 0, // Changed from secondsElapsed
    uploadedFileName: '',
    finalTime: '',
    timeLimit: 0 // Added timeLimit
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    views: {
        upload: document.getElementById('upload-view'),
        exam: document.getElementById('exam-view'),
        results: document.getElementById('results-view')
    },
    upload: {
        dropZone: document.getElementById('drop-zone'),
        fileInput: document.getElementById('file-input'),
        browseBtn: document.getElementById('browse-btn'),
        loading: document.getElementById('loading-overlay'),
        browseBtn: document.getElementById('browse-btn'),
        loading: document.getElementById('loading-overlay'),
        error: document.getElementById('error-message'),
        timeLimitSelect: document.getElementById('time-limit') // Added selector
    },
    exam: {
        questionText: document.getElementById('question-text'),
        optionsContainer: document.getElementById('options-container'),
        optionsContainer: document.getElementById('options-container'),
        prevBtn: document.getElementById('prev-btn'),
        skipBtn: document.getElementById('skip-btn'), // Added skip button
        nextBtn: document.getElementById('next-btn'),
        submitBtn: document.getElementById('submit-btn'),
        progressBar: document.getElementById('progress-bar'),
        counter: document.getElementById('question-counter'),
        timer: document.getElementById('timer')
    },
    results: {
        scorePercent: document.getElementById('score-percent'),
        scoreDetails: document.getElementById('score-details'),
        reviewList: document.getElementById('review-list'),
        answerSummaryTable: document.getElementById('answer-summary-table'),
        restartBtn: document.getElementById('restart-btn'),
        backBtn: document.getElementById('back-btn'),
        examFilename: document.getElementById('exam-filename'),
        examTime: document.getElementById('exam-time')
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
});

// Theme Handling
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
}

// Navigation
function switchView(viewName) {
    // Hide all views
    Object.values(elements.views).forEach(el => el.classList.remove('active'));
    Object.values(elements.views).forEach(el => el.classList.add('hidden'));

    // Show target view
    elements.views[viewName.replace('-view', '')].classList.remove('hidden');
    elements.views[viewName.replace('-view', '')].classList.add('active');
    state.currentView = viewName;
}

// File Helper
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result.split(',')[1];
            resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
// Gemini API Logic (REST)
async function generateExamFromGemini(file) {
    try {
        const base64Data = await fileToBase64(file);

        const prompt = `
            You are an OCR TEXT CORRECTOR. Fix errors and reconstruct text EXACTLY without changing meaning.
            
            === YOUR TASK ===
            Extract ALL exam questions from the image and correct OCR errors.
            DO NOT limit to 5 questions - extract EVERY question you find in the document.
            
            === OCR CORRECTIONS ===
            1. Fix C++ syntax errors:
               - "<}" → "<<"
               - ">}" → ">>"
               - "cout<" → "cout <<"
               - "cin>" → "cin >>"
               - "::" (scope operator)
               - Correct braces { }
               - Fix spacing in code
            
            2. Fix broken lines:
               - Merge split sentences
               - Reconstruct broken words
               - Join text that belongs together
            
            3. Fix symbols and punctuation:
               - Correct misread characters
               - Fix spacing
               - Clean formatting
            
            === STRICT RULES ===
            - DO NOT change logic, values, or answers
            - DO NOT add or invent anything
            - DO NOT modify which answer is correct
            - Preserve the SAME question and SAME answer from source
            - Extract explanation as-is from source (or write "Answer from source" if missing)
            - Extract ALL questions (not just 5)
            
            === OUTPUT FORMAT ===
            Return ONLY valid JSON:
            [
                {
                    "id": 1,
                    "question": "Corrected question text with code in \`\`\`blocks\`\`\`",
                    "choices": {
                        "A": "Corrected choice A",
                        "B": "Corrected choice B",
                        "C": "Corrected choice C",
                        "D": "Corrected choice D"
                    },
                    "correctAnswer": "B",
                    "explanation": "Explanation from source"
                }
            ]
            
            Extract and correct ONLY. Do not interpret or validate. Extract ALL questions found.
        `;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: file.type,
                            data: base64Data
                        }
                    }
                ]
            }]
        };

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error?.message || 'API Request Failed');
        }

        const result = await response.json();
        let text = result.candidates[0].content.parts[0].text;

        // POST-PROCESSING: Fix any remaining corruption
        text = text.replace(/<}/g, '<<');
        text = text.replace(/>}/g, '>>');
        text = text.replace(/cout</g, 'cout <<');
        text = text.replace(/cin>/g, 'cin >>');

        // Clean up markdown code blocks if present
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const rawData = JSON.parse(cleanText);

        // Convert new format to internal format
        return rawData.map((q, idx) => {
            // Handle new format with choices object
            let options = [];
            let correctIndex = 0;

            if (q.choices && typeof q.choices === 'object') {
                // New format: {"A": "text", "B": "text", ...}
                options = [q.choices.A, q.choices.B, q.choices.C, q.choices.D];
                correctIndex = ['A', 'B', 'C', 'D'].indexOf(q.correctAnswer);
                if (correctIndex === -1) correctIndex = 0;
            } else if (Array.isArray(q.options)) {
                // Old format fallback
                options = q.options;
                correctIndex = q.correct_answer_index || 0;
            }

            return {
                question: q.question,
                options: options,
                correctIndex: correctIndex,
                explanation: q.analysis_trace
            };
        });

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw new Error("Failed to generate exam. Please try again. " + error.message);
    }
}

// File Upload Logic
async function handleFileSelect(file) {
    if (!file) return;

    // Validation
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!validTypes.includes(file.type)) {
        showError('Invalid file type. Please upload a PDF or Image.');
        return;
    }

    if (file.size > maxSize) {
        showError('File too large. Maximum size is 10MB.');
        return;
    }

    // Store filename
    state.uploadedFileName = file.name;

    // Processing
    elements.upload.loading.classList.remove('hidden');
    elements.upload.error.classList.add('hidden');

    try {
        const examData = await generateExamFromGemini(file);
        startExam(examData);
    } catch (err) {
        showError(err.message);
    } finally {
        elements.upload.loading.classList.add('hidden');
    }
}

function showError(msg) {
    elements.upload.error.textContent = msg;
    elements.upload.error.classList.remove('hidden');
}

// Exam Logic
function startExam(data) {
    state.examData = data;
    state.currentQuestionIndex = 0;
    state.userAnswers = {};

    // Set time limit from selector (in seconds)
    const selectedMinutes = parseInt(elements.upload.timeLimitSelect.value, 10);
    state.timeLimit = selectedMinutes * 60;
    state.timeRemaining = state.timeLimit;

    startTimer();
    renderQuestion();
    switchView('exam-view');
}

function renderQuestion() {
    const question = state.examData[state.currentQuestionIndex];
    elements.exam.questionText.innerHTML = formatText(question.question);
    elements.exam.optionsContainer.innerHTML = '';

    question.options.forEach((opt, index) => {
        const div = document.createElement('div');
        div.className = `option-item ${state.userAnswers[state.currentQuestionIndex] === index ? 'selected' : ''}`;
        div.textContent = opt;
        div.onclick = () => selectAnswer(index);
        elements.exam.optionsContainer.appendChild(div);
    });

    updateExamControls();
}

function selectAnswer(index) {
    state.userAnswers[state.currentQuestionIndex] = index;
    renderQuestion(); // Re-render to update styling and controls
}

function updateExamControls() {
    const isFirst = state.currentQuestionIndex === 0;
    const isLast = state.currentQuestionIndex === state.examData.length - 1;
    const hasAnswer = state.userAnswers.hasOwnProperty(state.currentQuestionIndex);

    elements.exam.prevBtn.disabled = isFirst;

    elements.exam.prevBtn.disabled = isFirst;

    // Skip Button Logic
    // If it's the last question, "Skip" acts like "Submit" (or we can hide it and rely on Submit)
    // Let's keep it simple: Skip is always available unless we are on the last question where it might be redundant if we have Submit
    // Actually, user might want to skip the last question too (submit without answering)
    // But typically "Next" becomes "Submit" on the last page.
    // Let's hide Skip on the last question to avoid confusion, or make it "Finish"

    if (isLast) {
        elements.exam.nextBtn.classList.add('hidden');
        elements.exam.skipBtn.classList.add('hidden'); // Hide skip on last question, user can just Submit (even if empty? No, submit requires answer usually. But if they want to skip?)
        // If they want to skip the last question, they can't if Submit is disabled.
        // Let's allow Submit even if empty? No, the requirement says "skip button".
        // If I skip the last question, it should submit.
        // So let's show Skip on the last question too, and it calls submit.
        elements.exam.skipBtn.classList.remove('hidden');
        elements.exam.skipBtn.textContent = "Skip & Submit";

        elements.exam.submitBtn.classList.remove('hidden');
        elements.exam.submitBtn.disabled = !hasAnswer;
    } else {
        elements.exam.nextBtn.classList.remove('hidden');
        elements.exam.skipBtn.classList.remove('hidden');
        elements.exam.skipBtn.textContent = "Skip";

        elements.exam.submitBtn.classList.add('hidden');
        elements.exam.nextBtn.disabled = !hasAnswer;
    }

    // Progress Bar
    const progress = ((state.currentQuestionIndex + 1) / state.examData.length) * 100;
    elements.exam.progressBar.style.width = `${progress}%`;
    elements.exam.counter.textContent = `Question ${state.currentQuestionIndex + 1} of ${state.examData.length}`;
}

function nextQuestion() {
    // Double check validation
    if (!state.userAnswers.hasOwnProperty(state.currentQuestionIndex)) return;

    if (state.currentQuestionIndex < state.examData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    }
}

function prevQuestion() {
    if (state.currentQuestionIndex > 0) {
        state.currentQuestionIndex--;
        renderQuestion();
    }
}

function skipQuestion() {
    if (state.currentQuestionIndex < state.examData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else {
        // Last question skipped
        submitExam();
    }
}

function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);

    updateTimerDisplay(); // Initial display

    state.timerInterval = setInterval(() => {
        state.timeRemaining--;

        if (state.timeRemaining <= 0) {
            clearInterval(state.timerInterval);
            state.timeRemaining = 0;
            submitExam(); // Auto-submit
        }

        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(state.timeRemaining / 60).toString().padStart(2, '0');
    const secs = (state.timeRemaining % 60).toString().padStart(2, '0');
    elements.exam.timer.textContent = `${mins}:${secs}`;

    // Optional: Visual warning when time is low
    if (state.timeRemaining < 60) {
        elements.exam.timer.classList.add('warning');
    } else {
        elements.exam.timer.classList.remove('warning');
    }
}

function submitExam() {
    // Allow submit even if answer not selected (for auto-submit or skip)
    // if (!state.userAnswers.hasOwnProperty(state.currentQuestionIndex)) return; 
    // Commented out validation because we might be auto-submitting or skipping


    clearInterval(state.timerInterval);

    // Store final time (Time Taken)
    const timeTaken = state.timeLimit - state.timeRemaining;
    const mins = Math.floor(timeTaken / 60).toString().padStart(2, '0');
    const secs = (timeTaken % 60).toString().padStart(2, '0');
    state.finalTime = `${mins}:${secs}`;

    calculateResults();
    switchView('results-view');
}

// Helper to format text (markdown-like)
function formatText(text) {
    if (!text) return '';

    // 1. Handle Code Blocks (```code```)
    // We replace them with <pre><code>...</code></pre>
    // We use a placeholder to avoid messing up other replacements inside code
    const codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
        codeBlocks.push(code.trim()); // Store code
        return `__CODE_BLOCK_${codeBlocks.length - 1}__`; // Placeholder
    });

    // 2. Handle Line Breaks (outside code blocks)
    text = text.replace(/\n/g, '<br>');

    // 3. Restore Code Blocks
    text = text.replace(/__CODE_BLOCK_(\d+)__/g, (match, index) => {
        // Escape HTML in code to prevent rendering
        const code = codeBlocks[index]
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        return `<pre><code>${code}</code></pre>`;
    });

    return text;
}

// Results Logic
function calculateResults() {
    let correctCount = 0;
    elements.results.reviewList.innerHTML = '';

    state.examData.forEach((q, idx) => {
        const userAns = state.userAnswers[idx];
        const isCorrect = userAns === q.correctIndex;

        if (isCorrect) correctCount++;

        const item = document.createElement('div');
        item.className = 'review-item';

        let questionStatus = '';
        if (userAns === undefined) {
            questionStatus = '<span style="color: orange; font-weight: bold; margin-left: 10px;">(Skipped)</span>';
        }

        let optionsHtml = '';
        q.options.forEach((opt, optIdx) => {
            let className = 'review-option';
            if (optIdx === q.correctIndex) className += ' correct';
            else if (optIdx === userAns && !isCorrect) className += ' wrong';

            optionsHtml += `<div class="${className}">${opt}</div>`;
        });

        item.innerHTML = `
            <div class="review-question">${idx + 1}. ${formatText(q.question)} ${questionStatus}</div>
            <div class="review-options">${optionsHtml}</div>
            <div class="review-explanation" style="margin-top: 10px; font-size: 0.9em; color: #666;">
                <strong>Explanation:</strong> ${formatText(q.explanation || 'No explanation provided.')}
            </div>
        `;
        elements.results.reviewList.appendChild(item);
    });

    // Score Calculation
    // Ensure we don't divide by zero
    const total = state.examData.length || 1;
    const percentage = Math.round((correctCount / total) * 100);

    elements.results.scorePercent.textContent = percentage;
    elements.results.scoreDetails.textContent = `${correctCount} out of ${state.examData.length} correct`;

    // Update metadata
    elements.results.examFilename.textContent = state.uploadedFileName || 'Exam.pdf';
    elements.results.examTime.textContent = state.finalTime || '00:00';

    // Generate Answer Summary Table
    generateAnswerSummary();
}

// Generate Answer Summary Table
function generateAnswerSummary() {
    const table = document.createElement('table');
    table.className = 'summary-table';

    // Table Header
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Question #</th>
            <th>Correct Answer</th>
        </tr>
    `;
    table.appendChild(thead);

    // Table Body
    const tbody = document.createElement('tbody');
    state.examData.forEach((q, idx) => {
        const row = document.createElement('tr');
        const correctAnswerLetter = ['A', 'B', 'C', 'D'][q.correctIndex];
        row.innerHTML = `
            <td>${idx + 1}</td>
            <td class="answer-cell">${correctAnswerLetter}</td>
        `;
        tbody.appendChild(row);
    });
    table.appendChild(tbody);

    elements.results.answerSummaryTable.innerHTML = '';
    elements.results.answerSummaryTable.appendChild(table);
}

// Event Listeners
function setupEventListeners() {
    elements.themeToggle.addEventListener('click', toggleTheme);

    // File Upload
    elements.upload.browseBtn.addEventListener('click', () => elements.upload.fileInput.click());
    elements.upload.fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));

    // Drag & Drop
    const dropZone = elements.upload.dropZone;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('drag-over'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('drag-over'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt.files[0];
        handleFileSelect(file);
    });

    // Exam Controls
    elements.exam.nextBtn.addEventListener('click', nextQuestion);
    elements.exam.skipBtn.addEventListener('click', skipQuestion); // Added listener
    elements.exam.prevBtn.addEventListener('click', prevQuestion);
    elements.exam.submitBtn.addEventListener('click', submitExam);
    elements.results.restartBtn.addEventListener('click', () => switchView('upload-view'));
    elements.results.backBtn.addEventListener('click', () => switchView('upload-view'));
}
