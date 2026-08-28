import express from "express";
import { errorHandler } from "./middleware/errorHandler";
import { basicSecurityHeaders, corsMiddleware, createIpRateLimitMiddleware } from "./middleware/security";
import authRoutes from "./modules/auth/auth.routes";
import courseRoutes from "./modules/courses/course.routes";
import noteRoutes from "./modules/notes/note.routes";
import fileRoutes from "./modules/files/file.routes";
import aiRoutes from "./modules/ai/ai.routes";
import examRoutes from "./modules/exams/exam.routes";
import timetableRoutes from "./modules/timetable/timetable.routes";

const app = express();
const authAndAiRateLimit = createIpRateLimitMiddleware();
app.use(basicSecurityHeaders);
app.use(corsMiddleware);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
  });
});

/* -------- API ROUTES -------- */
app.use("/api/auth", authAndAiRateLimit, authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/files", fileRoutes);
app.use("/api", examRoutes);
app.use("/api/ai", authAndAiRateLimit, aiRoutes);
app.use("/api/timetable", timetableRoutes);

if (process.env.NODE_ENV !== "production") {
app.get("/dev", (_req, res) => {
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Backend Dev Dashboard</title>
    <style>
      body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; color: #111827; }
      h1 { margin: 0 0 12px; }
      h2 { margin: 0 0 8px; font-size: 18px; }
      .section { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 14px; }
      .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
      label { display: block; margin-top: 8px; font-size: 13px; color: #374151; }
      input, select, textarea { width: 100%; max-width: 420px; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; }
      textarea { min-height: 90px; }
      button { padding: 6px 10px; border: 1px solid #d1d5db; background: #111827; color: #ffffff; border-radius: 4px; cursor: pointer; }
      button.secondary { background: #ffffff; color: #111827; }
      ul { margin: 8px 0 0 18px; padding: 0; }
      li { margin-bottom: 6px; }
      pre { background: #0f172a; color: #e5e7eb; padding: 10px; border-radius: 6px; overflow: auto; }
      .hint { font-size: 12px; color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>Backend Dev Dashboard</h1>
    <p class="hint">Development-only UI to test existing endpoints. All requests include Authorization header.</p>

    <div class="section">
      <h2>Auth</h2>
      <label for="token">JWT Token</label>
      <div class="row">
        <input id="token" type="text" placeholder="Paste JWT token here" />
        <button class="secondary" onclick="saveToken()">Save Token</button>
      </div>
    </div>

    <div class="section">
      <h2>Dev Login (Test Only)</h2>
      <label for="login-email">Email</label>
      <input id="login-email" type="email" autocomplete="email" />
      <label for="login-password">Password</label>
      <input id="login-password" type="password" autocomplete="current-password" />
      <div class="row">
        <button onclick="devLogin()">Login</button>
        <span id="login-status" class="hint"></span>
      </div>
    </div>

    <div class="section">
      <h2>Dev Register (Test Only)</h2>
      <label for="register-fullname">Full Name</label>
      <input id="register-fullname" type="text" autocomplete="name" />
      <label for="register-email">Student Email</label>
      <input id="register-email" type="email" autocomplete="email" />
      <label for="register-password">Password</label>
      <input id="register-password" type="password" autocomplete="new-password" />
      <div class="row">
        <button onclick="devRegister()">Register</button>
        <span id="register-status" class="hint"></span>
      </div>
    </div>

    <div class="section">
      <h2>Courses</h2>
      <label for="course-title">Title</label>
      <input id="course-title" type="text" />
      <label for="course-code">Code (optional)</label>
      <input id="course-code" type="text" />
      <div class="row">
        <button onclick="createCourse()">Create Course</button>
        <button class="secondary" onclick="listCourses()">List Courses</button>
      </div>
      <label for="course-select">Selected Course</label>
      <div class="row">
        <select id="course-select"></select>
        <button class="secondary" onclick="deleteSelectedCourse()">Delete Selected Course</button>
      </div>
      <ul id="course-list"></ul>
    </div>

    <div class="section">
      <h2>Notes (Selected Course)</h2>
      <label for="note-course-select">Course</label>
      <select id="note-course-select"></select>
      <label for="note-title">Note Title</label>
      <input id="note-title" type="text" />
      <label for="note-content">Note Content</label>
      <textarea id="note-content"></textarea>
      <div class="row">
        <button onclick="createNote()">Create Note</button>
        <button class="secondary" onclick="listNotes()">List Notes</button>
      </div>
      <ul id="note-list"></ul>
    </div>

    <div class="section">
      <h2>Files (Selected Course)</h2>
      <label for="file-course-select">Course</label>
      <select id="file-course-select"></select>
      <label for="file-input">File</label>
      <input id="file-input" type="file" />
      <label>
        <input id="file-private" type="checkbox" checked />
        Private file
      </label>
      <div class="row">
        <button onclick="uploadFile()">Upload File</button>
        <button class="secondary" onclick="listFiles()">List Files</button>
      </div>
      <ul id="file-list"></ul>
    </div>

    <div class="section">
      <h2>Exams (Selected Course)</h2>
      <label for="exam-course-select">Course</label>
      <select id="exam-course-select"></select>
      <label for="exam-title">Exam Title</label>
      <input id="exam-title" type="text" />
      <label for="exam-date">Exam Date</label>
      <input id="exam-date" type="date" />
      <div class="row">
        <button onclick="createExam()">Create Exam</button>
        <button class="secondary" onclick="listExams()">List Exams</button>
      </div>
      <ul id="exam-list"></ul>
    </div>

    <div class="section">
      <h2>AI</h2>
      <label for="ai-input">Input (not used by backend, for reference)</label>
      <textarea id="ai-input" placeholder="Optional notes for your test run"></textarea>
      <div class="row">
        <button onclick="aiRequest('/api/ai/summarize')">Summarize</button>
        <button onclick="aiRequest('/api/ai/notes')">Generate Notes</button>
        <button onclick="aiRequest('/api/ai/quiz')">Generate Quiz</button>
      </div>
      <pre id="ai-output">{}</pre>
    </div>

    <div class="section">
      <h2>Raw Response</h2>
      <pre id="output">{}</pre>
    </div>

    <script>
      const outputEl = document.getElementById("output");
      const aiOutputEl = document.getElementById("ai-output");
      const tokenInput = document.getElementById("token");
      const selectIds = ["course-select", "note-course-select", "file-course-select", "exam-course-select"];
      let token = localStorage.getItem("dev_token") || "";

      tokenInput.value = token;

      function saveToken() {
        token = tokenInput.value.trim();
        localStorage.setItem("dev_token", token);
        showResponse("token saved", { token: token ? "set" : "empty" });
      }

      function showLoginStatus(message) {
        const el = document.getElementById("login-status");
        if (el) {
          el.textContent = message;
        }
      }

      function showRegisterStatus(message) {
        const el = document.getElementById("register-status");
        if (el) {
          el.textContent = message;
        }
      }

      async function devLogin() {
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        if (!email || !password) {
          showLoginStatus("Email and password required");
          return;
        }

        const result = await requestJson("POST", "/api/auth/login", { email, password });
        showResponse("POST /api/auth/login", result);

        const newToken = result?.data?.accessToken || result?.data?.token;
        if (result.ok && newToken) {
          tokenInput.value = newToken;
          saveToken();
          showLoginStatus("Login successful");
          return;
        }

        showLoginStatus("Login failed");
      }

      async function devRegister() {
        const fullName = document.getElementById("register-fullname").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;

        if (!fullName || !email || !password) {
          showRegisterStatus("Full name, email, and password required");
          return;
        }

        const result = await requestJson("POST", "/api/auth/register", { fullName, email, password });
        showResponse("POST /api/auth/register", result);

        const newToken = result?.data?.token;
        if (result.ok && newToken) {
          tokenInput.value = newToken;
          saveToken();
          showRegisterStatus("Registration successful");
          return;
        }

        showRegisterStatus("Registration failed");
      }

      async function requestJson(method, url, body, isForm) {
        const headers = { "Authorization": "Bearer " + token };
        const options = { method, headers };
        if (body) {
          if (isForm) {
            options.body = body;
          } else {
            headers["Content-Type"] = "application/json";
            options.body = JSON.stringify(body);
          }
        }
        const res = await fetch(url, options);
        const text = await res.text();
        let data = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = { raw: text };
          }
        }
        return { ok: res.ok, status: res.status, data };
      }

      function showResponse(action, payload) {
        outputEl.textContent = action + "\\n" + JSON.stringify(payload, null, 2);
      }

      function showAiResponse(action, payload) {
        aiOutputEl.textContent = action + "\\n" + JSON.stringify(payload, null, 2);
      }

      function fillSelect(select, courses) {
        select.innerHTML = "";
        if (!courses.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "No courses";
          select.appendChild(opt);
          return;
        }
        courses.forEach((course) => {
          const opt = document.createElement("option");
          opt.value = course.id;
          opt.textContent = course.title + (course.code ? " (" + course.code + ")" : "");
          select.appendChild(opt);
        });
      }

      function updateCourseSelects(courses) {
        selectIds.forEach((id) => {
          const select = document.getElementById(id);
          if (select) fillSelect(select, courses);
        });
      }

      function renderList(listEl, items, format) {
        listEl.innerHTML = "";
        if (!items.length) {
          const li = document.createElement("li");
          li.textContent = "No items";
          listEl.appendChild(li);
          return;
        }
        items.forEach((item) => listEl.appendChild(format(item)));
      }

      async function createCourse() {
        const title = document.getElementById("course-title").value.trim();
        const code = document.getElementById("course-code").value.trim();
        const result = await requestJson("POST", "/api/courses", { title, code: code || undefined });
        showResponse("POST /api/courses", result);
        await listCourses();
      }

      async function listCourses() {
        const result = await requestJson("GET", "/api/courses");
        showResponse("GET /api/courses", result);
        const courses = Array.isArray(result.data && result.data.data) ? result.data.data : [];
        updateCourseSelects(courses);
        renderList(document.getElementById("course-list"), courses, (course) => {
          const li = document.createElement("li");
          li.textContent = course.title + (course.code ? " (" + course.code + ")" : "");
          const btn = document.createElement("button");
          btn.className = "secondary";
          btn.textContent = "Delete";
          btn.onclick = () => deleteCourse(course.id);
          li.appendChild(document.createTextNode(" "));
          li.appendChild(btn);
          return li;
        });
      }

      async function deleteCourse(courseId) {
        const result = await requestJson("DELETE", "/api/courses/" + courseId);
        showResponse("DELETE /api/courses/" + courseId, result);
        await listCourses();
      }

      async function deleteSelectedCourse() {
        const courseId = document.getElementById("course-select").value;
        if (!courseId) {
          showResponse("delete selected course", { error: "Select a course first" });
          return;
        }
        await deleteCourse(courseId);
      }

      async function createNote() {
        const courseId = document.getElementById("note-course-select").value;
        const title = document.getElementById("note-title").value.trim();
        const content = document.getElementById("note-content").value.trim();
        if (!courseId) {
          showResponse("create note", { error: "Select a course first" });
          return;
        }
        const result = await requestJson("POST", "/api/notes", { courseId, title, content, isPrivate: true });
        showResponse("POST /api/notes", result);
        await listNotes();
      }

      async function listNotes() {
        const courseId = document.getElementById("note-course-select").value;
        if (!courseId) {
          showResponse("list notes", { error: "Select a course first" });
          return;
        }
        const result = await requestJson("GET", "/api/notes?courseId=" + encodeURIComponent(courseId));
        showResponse("GET /api/notes", result);
        const notes = Array.isArray(result.data && result.data.data) ? result.data.data : [];
        renderList(document.getElementById("note-list"), notes, (note) => {
          const li = document.createElement("li");
          li.textContent = note.title + " [" + note.id + "]";
          const btn = document.createElement("button");
          btn.className = "secondary";
          btn.textContent = "Delete";
          btn.onclick = () => deleteNote(note.id);
          li.appendChild(document.createTextNode(" "));
          li.appendChild(btn);
          return li;
        });
      }

      async function deleteNote(noteId) {
        const result = await requestJson("DELETE", "/api/notes/" + noteId);
        showResponse("DELETE /api/notes/" + noteId, result);
        await listNotes();
      }

      async function uploadFile() {
        const courseId = document.getElementById("file-course-select").value;
        const fileInput = document.getElementById("file-input");
        const isPrivate = document.getElementById("file-private").checked;
        if (!courseId || !fileInput.files.length) {
          showResponse("upload file", { error: "Select a course and a file" });
          return;
        }
        const form = new FormData();
        form.append("courseId", courseId);
        form.append("isPrivate", isPrivate ? "true" : "false");
        form.append("file", fileInput.files[0]);
        const result = await requestJson("POST", "/api/files/upload", form, true);
        showResponse("POST /api/files/upload", result);
        await listFiles();
      }

      async function listFiles() {
        const courseId = document.getElementById("file-course-select").value;
        if (!courseId) {
          showResponse("list files", { error: "Select a course first" });
          return;
        }
        const result = await requestJson("GET", "/api/files?courseId=" + encodeURIComponent(courseId));
        showResponse("GET /api/files", result);
        const files = Array.isArray(result.data && result.data.data) ? result.data.data : [];
        renderList(document.getElementById("file-list"), files, (file) => {
          const li = document.createElement("li");
          li.textContent = file.fileName + " [" + file.id + "]";
          const btn = document.createElement("button");
          btn.className = "secondary";
          btn.textContent = "Delete";
          btn.onclick = () => deleteFile(file.id);
          li.appendChild(document.createTextNode(" "));
          li.appendChild(btn);
          return li;
        });
      }

      async function deleteFile(fileId) {
        const result = await requestJson("DELETE", "/api/files/" + fileId);
        showResponse("DELETE /api/files/" + fileId, result);
        await listFiles();
      }

      async function createExam() {
        const courseId = document.getElementById("exam-course-select").value;
        const title = document.getElementById("exam-title").value.trim();
        const date = document.getElementById("exam-date").value;
        if (!courseId) {
          showResponse("create exam", { error: "Select a course first" });
          return;
        }
        const result = await requestJson("POST", "/api/courses/" + courseId + "/exams", { title, date });
        showResponse("POST /api/courses/" + courseId + "/exams", result);
        await listExams();
      }

      async function listExams() {
        const courseId = document.getElementById("exam-course-select").value;
        if (!courseId) {
          showResponse("list exams", { error: "Select a course first" });
          return;
        }
        const result = await requestJson("GET", "/api/courses/" + courseId + "/exams");
        showResponse("GET /api/courses/" + courseId + "/exams", result);
        const exams = Array.isArray(result.data && result.data.data) ? result.data.data : [];
        renderList(document.getElementById("exam-list"), exams, (exam) => {
          const li = document.createElement("li");
          li.textContent = exam.title + " [" + exam.id + "]";
          const btn = document.createElement("button");
          btn.className = "secondary";
          btn.textContent = "Delete";
          btn.onclick = () => deleteExam(exam.id);
          li.appendChild(document.createTextNode(" "));
          li.appendChild(btn);
          return li;
        });
      }

      async function deleteExam(examId) {
        const result = await requestJson("DELETE", "/api/exams/" + examId);
        showResponse("DELETE /api/exams/" + examId, result);
        await listExams();
      }

      async function aiRequest(endpoint) {
        const text = document.getElementById("ai-input").value;
        const result = await requestJson("POST", endpoint, { text });
        showAiResponse("POST " + endpoint, result);
      }
    </script>
  </body>
</html>`);
});
}

app.get("/", (_req, res) => {
  const now = new Date().toISOString();
  res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Exam Preparation Backend</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #f8fafc; color: #0f172a; }
      .wrap { max-width: 840px; margin: 48px auto; padding: 0 20px; }
      .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; box-shadow: 0 6px 18px rgba(15, 23, 42, 0.06); }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #16a34a; color: #ffffff; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      h2 { margin: 24px 0 8px; font-size: 18px; }
      p { margin: 8px 0; color: #475569; }
      ul { margin: 8px 0 0 18px; color: #475569; }
      code { background: #f1f5f9; padding: 2px 6px; border-radius: 6px; font-size: 13px; color: #0f172a; }
      a { color: #2563eb; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
      .group { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <span class="badge">RUNNING</span>
        <h1>Exam Preparation Backend</h1>
        <p>Backend status: running</p>
        <p>Timestamp: ${now}</p>

        <h2>API Groups</h2>
        <div class="grid">
          <div class="group"><strong>Auth</strong><br /><code>/api/auth</code></div>
          <div class="group"><strong>Courses</strong><br /><code>/api/courses</code></div>
          <div class="group"><strong>Exams</strong><br /><code>/api/courses</code> and <code>/api/exams</code></div>
          <div class="group"><strong>Files</strong><br /><code>/api/files</code></div>
        </div>

        <h2>Example Endpoints</h2>
        <ul>
          <li><code>POST /api/auth/register</code></li>
          <li><code>POST /api/auth/login</code></li>
          <li><code>GET /api/courses</code></li>
          <li><code>POST /api/courses</code></li>
          <li><code>GET /api/courses/:courseId/exams</code></li>
          <li><code>POST /api/courses/:courseId/exams</code></li>
          <li><code>PATCH /api/exams/:examId</code></li>
          <li><code>DELETE /api/exams/:examId</code></li>
          <li><code>GET /api/files?courseId=:courseId</code></li>
        </ul>

        <h2>Quick Links</h2>
        <p><a href="/health">GET /health</a> · <a href="/api">GET /api</a> · <a href="/dev">Developer Test Dashboard</a></p>
      </div>
    </div>
  </body>
</html>`);
});

app.get("/api", (_req, res) => {
  res.json({
    groups: {
      auth: ["/api/auth/register", "/api/auth/login", "/api/auth/me"],
      courses: ["/api/courses", "/api/courses/:courseId"],
      exams: [
        "/api/courses/:courseId/exams",
        "/api/exams/:examId",
      ],
      files: [
        "/api/files",
        "/api/files/upload",
        "/api/files/:fileId/download",
      ],
    },
    auth: "Authorization: Bearer <token> required for protected endpoints",
  });
});

app.use((_req, res) => res.status(404).json({ error: { message: "Not Found" } }));
app.use(errorHandler);

export default app;
