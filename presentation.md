# 🎓 AI Test Bank Generator: Project Presentation

---

## 1. The Problem
**"Studying is hard. Creating practice tests is harder."**

*   Students have tons of PDFs, notes, and slides.
*   Manually creating flashcards or quizzes takes hours.
*   Existing tools are often paid, require complex logins, or don't understand specific course material.

---

## 2. The Solution
**AI Test Bank Generator**

A **secure, instant, and intelligent** web application that transforms any study document into an interactive exam in seconds.

*   **Input**: Drag & Drop any PDF or Image.
*   **Process**: AI analyzes text, code, and diagrams.
*   **Output**: A graded, interactive mock exam with explanations.

---

## 3. Under the Hood: The Tech Stack
We built this using a **Serverless, Client-Side Architecture**.

### 🎨 Frontend (The Interface)
*   **HTML5**: Semantic structure for accessibility.
*   **CSS3 (Vanilla)**: Custom design system with CSS Variables for **Dark/Light Mode**. No heavy frameworks (like Bootstrap) to keep it fast.
*   **JavaScript (ES6+)**: Handles all logic, state management, and file processing directly in the browser.

### 🧠 The Brain (AI)
*   **Google Gemini 2.0 Flash**:
    *   Chosen for its speed and **multimodal capabilities** (understanding both text and images).
    *   **REST API**: We communicate directly from the browser using `fetch()`, bypassing the need for a backend server.

---

## 4. Innovation: Security & Privacy
Since we don't have a backend server, we had to be creative with security.

### 🔒 API Key Protection
*   **Problem**: API keys in frontend code are usually visible to anyone.
*   **Solution**: We implemented **Client-Side Obfuscation**. The key is encrypted in the source code and only decrypted in memory at the exact moment of the request.

### 🚫 Anti-Cheat Mechanism
*   **Problem**: Tech-savvy students can inspect the "Network Tab" to see the answer key coming from the AI.
*   **Solution**: **Response Obfuscation**.
    *   The AI does **not** send the correct answer index (e.g., "0").
    *   It sends a **Mathematical Hash** (e.g., `key_hash: 63`).
    *   The app calculates `(63 / 7) - 9 = 0` to grade the exam.
    *   This effectively "encrypts" the answer key from casual snoopers.

---

## 5. Key Features
1.  **Context-Aware Questions**: The AI detects code snippets or diagrams and includes them in the question (it doesn't just ask "What is the output?" without showing the code).
2.  **Step-by-Step Reasoning**: We force the AI to generate an explanation trace to ensure accuracy before selecting an answer.
3.  **Zero-Install**: It's a single HTML file. Runs anywhere, offline-capable (once loaded).

---

## 6. Conclusion
The **AI Test Bank Generator** demonstrates how powerful modern AI models like **Gemini 2.0** can be combined with standard web technologies to solve real student problems securely and efficiently.

**Thank You! Any Questions?**
