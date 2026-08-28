 import React, { useState, useEffect, useReducer } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from "react-router-dom";
import "./App.css";
import { PromptInputBox } from "./components/ui/ai-prompt-box";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, RotateCcw, X } from "lucide-react";
import {
  API_BASE,
  apiRequest,
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  setAuthSession,
} from "./api";
import { ToastProvider, useToast } from "./ToastContext";

// ── Simple Markdown → HTML renderer ─────────────────────────────────────────
const renderMarkdown = (text) => {
  if (!text) return "";
  let html = text
    // Remove speech blocks from visual output
    .replace(/<speech>[\s\S]*?<\/speech>/gi, '')
    // Escape HTML entities
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Code blocks (```)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // Headers
    .replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>')
    // Bold & Italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="md-hr"/>')
    // Unordered list items (- or *)
    .replace(/^[\s]*[-*]\s+(.+)$/gm, '<li class="md-li">$1</li>')
    // Numbered list items
    .replace(/^\d+[.)]\s+(.+)$/gm, '<li class="md-li md-li-num">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li class="md-li">[\s\S]*?<\/li>\s*)+)/g, '<ul class="md-ul">$1</ul>')
    .replace(/((?:<li class="md-li md-li-num">[\s\S]*?<\/li>\s*)+)/g, '<ol class="md-ol">$1</ol>')
    // Paragraphs: wrap remaining lines
    .replace(/^(?!<[a-z])((?!<\/?\w).+)$/gm, '<p class="md-p">$1</p>');
  return html;
};

const normalizeAssistantText = (text) => {
  if (typeof text !== "string") return text;
  return fixEncoding(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/^[\t ]*[•●▪◦‣▸]\s+/gm, "- ")
    .trim();
};

const MarkdownOutput = ({ text }) => {
  return (
    <div
      className="md-rendered"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(normalizeAssistantText(text)) }}
    />
  );
};
const fixEncoding = (text) => {
  if (typeof text !== 'string') return text;
  return text
    .replace(/Â/g, "")
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â‰¡/g, "-")
    .replace(/â€\s+/g, " - ")
    .replace(/â€$/g, "")
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€�/g, '"')
    .replace(/â€/g, '"')
    .replace(/â€˜/g, "'")
    .replace(/â€¦/g, "...")
    .replace(/â€¢/g, "•")
    .replace(/\s+-\s+/g, " - ");
};

const AuthPage = ({ onSuccess, theme, toggleTheme }) => {
  const toast = useToast();
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError("");
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail.endsWith("@std.neu.edu.tr")) {
      setError("Email must end with @std.neu.edu.tr");
      return;
    }
    if (mode === "signup" && !fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters");
      return;
    }

    const endpoint = mode === "signup" ? "/api/auth/register" : "/api/auth/login";
    const payload =
      mode === "signup"
        ? { fullName: fullName.trim(), email: normalizedEmail, password }
        : { email: normalizedEmail, password };

    try {
      setIsSubmitting(true);
      const result = await apiRequest(endpoint, {
        method: "POST",
        body: payload,
        auth: false,
      });
      if (!result?.token) {
        throw new Error("Authentication failed");
      }
      setAuthSession(result.token, result.user);
      toast.success(mode === "signup" ? "Account created successfully!" : "Logged in successfully!");
      onSuccess(result.user);
    } catch (err) {
      const status = err?.status ? ` (HTTP ${err.status})` : "";
      const message = err?.message ? `${err.message}${status}` : `Authentication failed${status}`;
      console.error("[Auth] request failed", {
        mode,
        endpoint,
        status: err?.status,
        message: err?.message,
      });
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`auth-page-modern ${theme}`}>
      {/* Header */}
      <header className="auth-header-modern">
        <button type="button" className="auth-theme-toggle" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {theme === "dark" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>
      </header>

      <div className="auth-container-modern">
        {/* Login Card */}
        <div className="auth-card-modern">
          <div className="auth-tabs-modern">
            <button className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError(""); }}>Login</button>
            <button className={mode === "signup" ? "active" : ""} onClick={() => { setMode("signup"); setError(""); }}>Sign Up</button>
          </div>

          {error && <p className="auth-error-modern">{error}</p>}

          <div className="auth-form-modern">
            {mode === "signup" && (
              <div className="auth-field-modern">
                <label>Full Name</label>
                <div className="auth-input-wrapper-modern">
                  <span className="auth-input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                  </span>
                  <input
                    placeholder="Full Name"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </div>
              </div>
            )}
            <div className="auth-field-modern">
              <label>Email</label>
              <div className="auth-input-wrapper-modern">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"></path></svg>
                </span>
                <input
                  placeholder="student@std.neu.edu.tr"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
              <div className="auth-field-help-modern">Must be a valid @std.neu.edu.tr address</div>
            </div>

            <div className="auth-field-modern">
              <label>Password</label>
              <div className="auth-input-wrapper-modern">
                <span className="auth-input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
                <input
                  type="password"
                  placeholder="........"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>
              <div className="auth-field-footer-modern">
                <span>Min. 4 characters</span>
              </div>
            </div>

            <button className="auth-submit-modern" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Please wait..." : (mode === "login" ? "Login" : "Sign Up")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Exam Countdown Widget ──────────────────────────────────────────────────────
const getCountdown = (dateStr) => {
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diff = target - now;
  if (diff <= 0) return null; // past
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, diff };
};

export const ExamCountdownWidget = ({ onAuthError }) => {
  const [exams, setExams] = useState([]);
  const [, tick] = useReducer(n => n + 1, 0); // force re-render every second

  useEffect(() => {
    const load = async () => {
      try {
        const courseRes = await apiRequest("/api/courses/joined");
        const coursesList = courseRes.data || [];
        if (!coursesList.length) return;
        const groups = await Promise.all(
          coursesList.map(c => apiRequest(`/api/courses/${encodeURIComponent(c.id)}/exams`).catch(() => ({ data: [] })))
        );
        const all = groups.flatMap(g => g.data || []);
        const upcoming = all
          .filter(e => e.date && new Date(e.date).getTime() > Date.now())
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map(e => ({ ...e, course: coursesList.find(c => c.id === e.courseId) }));
        setExams(upcoming);
      } catch (err) {
        if (err?.status === 401) { clearAuthSession(); onAuthError(); }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live ticker — re-render every second
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (!exams.length) return null;

  return (
    <div className="dash-section" style={{ marginTop: '30px' }}>
      <div className="dash-section-header">
        <h2 style={{ margin: 0 }}> Upcoming Exams</h2>
      </div>
      <div className="exam-grid">
        {exams.slice(0, 5).map((exam, index) => {
          const cd = getCountdown(exam.date);
          if (!cd) return null;
          const urgency = cd.days <= 3 ? "urgent" : cd.days <= 7 ? "soon" : "safe";
          return (
            <div key={exam.id} className={`exam-card animated-row urgency-${urgency}`} style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="ec-card-left">
                <div className="ec-course-badge">{exam.course?.code || "Course"}</div>
                <p className="ec-exam-title">{exam.title}</p>
                {exam.description && <p className="ec-exam-desc">{exam.description}</p>}
                <p className="ec-exam-date">
                   {new Date(exam.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <div className="ec-card-right">
                <div className="ec-days-left">
                  <span className="num" style={{ color: urgency === 'urgent' ? '#ef4444' : urgency === 'soon' ? '#eab308' : 'var(--text-color)' }}>
                    {cd.days}
                  </span>
                  <span className="lbl">days left</span>
                </div>
                <div className="ec-timer" style={{ display: 'flex', gap: '8px' }}>
                  <div className="ec-unit">
                    <span className="ec-num">{String(cd.hours).padStart(2, "0")}</span>
                    <span className="ec-label">hr</span>
                  </div>
                  <div className="ec-unit">
                    <span className="ec-num">{String(cd.mins).padStart(2, "0")}</span>
                    <span className="ec-label">min</span>
                  </div>
                  <div className="ec-unit">
                    <span className="ec-num ec-secs">{String(cd.secs).padStart(2, "0")}</span>
                    <span className="ec-label">sec</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const DashboardCalendar = ({ onAuthError }) => {
  const [exams, setExams] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiRequest("/api/courses/joined");
        if (!res.data?.length) return;
        const groups = await Promise.all(
          res.data.map(c => apiRequest(`/api/courses/${encodeURIComponent(c.id)}/exams`).catch(() => ({ data: [] })))
        );
        setExams(groups.flatMap(g => g.data || []));
      } catch (err) {
        if (err?.status === 401) { clearAuthSession(); onAuthError(); }
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="dash-section dash-calendar-widget" style={{ marginTop: '30px' }}>
      <div className="dash-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}> Exam Calendar</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="secondary-btn" onClick={prevMonth}>◀</button>
          <span style={{ fontWeight: 'bold', minWidth: '120px', textAlign: 'center' }}>{monthNames[month]} {year}</span>
          <button className="secondary-btn" onClick={nextMonth}></button>
        </div>
      </div>
      <div className="cal-grid">
        {days.map(d => <div key={d} className="cal-head-day">{d}</div>)}
        {Array.from({ length: firstDayIndex }).map((_, i) => <div key={`empty-${i}`} className="cal-cell empty" />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
          const dayExams = exams.filter(e => {
            const ed = new Date(e.date);
            return ed.getDate() === day && ed.getMonth() === month && ed.getFullYear() === year;
          });
          return (
            <div key={day} className={`cal-cell ${isToday ? 'today' : ''} ${dayExams.length ? 'has-exam' : ''}`}>
              <div className="cal-day-num">{day}</div>
              {dayExams.map(ex => (
                <div key={ex.id} className="cal-exam-badge" title={ex.title}>{ex.title}</div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const WelcomeAI = ({ onLogout, theme, toggleTheme, onAuthError, searchQuery }) => {
  const navigate = useNavigate();
  const user = getAuthUser();
  const firstName = user?.fullName?.split(" ")[0] || "Student";
  const [courses, setCourses] = useState([]);
  const [stats, setStats] = useState({
    notes: 0,
    files: 0,
    exams: 0,
    aiOutputs: 0,
    upcomingThisWeek: 0,
    weeklyStudyMinutes: 0,
    dayLoadMinutes: [0, 0, 0, 0, 0, 0, 0],
  });
  const [allExams, setAllExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const parseMinutes = (value) => {
    if (typeof value !== "string") return null;
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  useEffect(() => {
    let mounted = true;
    const loadDashboard = async () => {
      try {
        const courseRes = await apiRequest("/api/courses/joined");
        const courseList = courseRes.data || [];
        if (!mounted) return;
        setCourses(courseList);

        const ids = courseList.map((c) => c.id);
        const [noteGroups, fileGroups, examGroups, timetableRes, aiOutputsRes] = await Promise.all([
          Promise.all(ids.map((id) => apiRequest(`/api/notes?courseId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })))),
          Promise.all(ids.map((id) => apiRequest(`/api/files?courseId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })))),
          Promise.all(ids.map((id) => apiRequest(`/api/courses/${encodeURIComponent(id)}/exams`).catch(() => ({ data: [] })))),
          apiRequest("/api/timetable").catch(() => ({ data: [] })),
          apiRequest("/api/ai/outputs").catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;

        const examsList = examGroups.flatMap((g, idx) => (g.data || []).map((e) => ({ ...e, course: courseList[idx] })));
        const timetableEntries = timetableRes.data || [];
        const aiOutputs = aiOutputsRes.data || [];
        const upcomingThisWeek = examsList.filter((exam) => {
          const days = Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000);
          return days >= 0 && days <= 7;
        }).length;
        const dayLoadMinutes = [0, 0, 0, 0, 0, 0, 0];
        timetableEntries.forEach((entry) => {
          const day = Number(entry.dayOfWeek);
          const start = parseMinutes(entry.startTime);
          const end = parseMinutes(entry.endTime);
          if (!Number.isInteger(day) || day < 0 || day > 6 || start === null || end === null || end <= start) return;
          dayLoadMinutes[day] += end - start;
        });
        const weeklyStudyMinutes = dayLoadMinutes.reduce((sum, val) => sum + val, 0);

        setAllExams(examsList);
        setStats({
          notes: noteGroups.reduce((sum, g) => sum + (g.data?.length || 0), 0),
          files: fileGroups.reduce((sum, g) => sum + (g.data?.length || 0), 0),
          exams: examsList.length,
          aiOutputs: aiOutputs.length,
          upcomingThisWeek,
          weeklyStudyMinutes,
          dayLoadMinutes,
        });
      } catch (err) {
        if (err?.status === 401) { clearAuthSession(); onLogout(); }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadDashboard();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCourses = courses.filter(c =>
    !searchQuery ||
    c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.code && c.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredExams = allExams.filter(e =>
    !searchQuery ||
    e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (e.course && e.course.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const examPressureLevel = stats.upcomingThisWeek >= 4 ? "High" : stats.upcomingThisWeek >= 2 ? "Medium" : "Low";
  const examPressureClass = stats.upcomingThisWeek >= 4 ? "dash-pressure-high" : stats.upcomingThisWeek >= 2 ? "dash-pressure-medium" : "dash-pressure-low";
  const weeklyHours = (stats.weeklyStudyMinutes / 60).toFixed(1);
  const dayLoadWeek = [
    { key: "Mon", idx: 1 },
    { key: "Tue", idx: 2 },
    { key: "Wed", idx: 3 },
    { key: "Thu", idx: 4 },
    { key: "Fri", idx: 5 },
  ];
  const maxWorkload = Math.max(...dayLoadWeek.map((day) => stats.dayLoadMinutes[day.idx] || 0), 1);


  return (
    <div className={`dash-page ${theme}`}>
      {/* Welcome Banner */}
      <motion.div
        className="dash-welcome-banner"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        <h1 style={{ fontSize: '26px', marginBottom: '10px', fontWeight: 800, position: 'relative', zIndex: 1 }}>Welcome back, {firstName}!</h1>
        <p style={{ fontSize: '15px', marginBottom: '22px', maxWidth: '560px', lineHeight: 1.6, position: 'relative', zIndex: 1 }}>
          {courses.length === 0
            ? "Get started by adding your first course!"
            : `You have ${courses.length} active course${courses.length > 1 ? 's' : ''} and ${stats.exams} upcoming exam${stats.exams !== 1 ? 's' : ''}.`}
        </p>
        <div style={{ display: 'flex', gap: '12px', position: 'relative', zIndex: 1 }}>
          <button className="primary-btn" onClick={() => navigate("/upload")}>Resume Learning</button>
          <button className="secondary-btn" onClick={() => navigate("/schedule")}>View Schedule</button>
        </div>
      </motion.div>

      {/* Stat Cards Row */}
      <div className="dash-stats-row">
        <motion.div className="dash-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <div className="dash-stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div><p className="dash-stat-label">Active Courses</p><h3 className="dash-stat-value">{courses.length}</h3></div>
        </motion.div>
        <motion.div className="dash-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="dash-stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div><p className="dash-stat-label">Total Notes</p><h3 className="dash-stat-value">{stats.notes}</h3></div>
        </motion.div>
        <motion.div className="dash-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="dash-stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>
          </div>
          <div><p className="dash-stat-label">Files Uploaded</p><h3 className="dash-stat-value">{stats.files}</h3></div>
        </motion.div>
        <motion.div className="dash-stat-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="dash-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div><p className="dash-stat-label">Scheduled Exams</p><h3 className="dash-stat-value">{stats.exams}</h3></div>
        </motion.div>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* My Courses Section */}
          <div className="dash-course-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', color: 'var(--text-main)', margin: 0 }}>My Courses</h2>
              <button style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }} onClick={() => navigate("/upload")}>All Courses →</button>
            </div>
            
            {loading ? (
              <p>Loading...</p>
            ) : courses.length === 0 ? (
              <div className="dash-empty">
                <p>No courses yet. Get started by adding your first course!</p>
                <button className="primary-btn" onClick={() => navigate("/upload")} style={{ marginTop: "12px" }}> Add Course</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {filteredCourses.map(c => (
                  <div key={c.id} className="dash-course-item" onClick={() => navigate("/upload", { state: { courseId: c.id } })}>
                    <div className="dash-course-icon">{c.code ? c.code.substring(0, 2).toUpperCase() : c.title?.substring(0, 2).toUpperCase()}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h4 style={{ fontSize: '15px', color: 'var(--text-main)', margin: '0 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</h4>
                      {c.code && <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{c.code}</p>}
                    </div>
                    <span style={{ color: 'var(--accent)', fontSize: '18px' }}>→</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions Row */}
          <div className="dash-quick-actions">
            <motion.button className="dash-quick-btn" onClick={() => navigate("/upload")} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
              <div className="dash-quick-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              </div>
              <span>My Classes</span>
            </motion.button>
            <motion.button className="dash-quick-btn" onClick={() => navigate("/study-plan")} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
              <div className="dash-quick-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              </div>
              <span>AI Study Plan</span>
            </motion.button>
            <motion.button className="dash-quick-btn" onClick={() => navigate("/quiz")} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
              <div className="dash-quick-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <span>Generate Quiz</span>
            </motion.button>
            <motion.button className="dash-quick-btn" onClick={() => navigate("/flashcards")} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}>
              <div className="dash-quick-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8h10M7 12h6"/></svg>
              </div>
              <span>Flashcards</span>
            </motion.button>
          </div>

          <div className="dash-insight-panel">
            <div className="dash-insight-header">
              <h3>Learning Snapshot</h3>
              <button type="button" onClick={() => navigate("/profile")}>Open Analytics →</button>
            </div>
            <div className="dash-insight-grid">
              <div className="dash-insight-card">
                <div className="dash-insight-label">Exam Pressure</div>
                <div className="dash-insight-value-row">
                  <strong>{examPressureLevel}</strong>
                  <span className={`dash-pressure-pill ${examPressureClass}`}>{stats.upcomingThisWeek} this week</span>
                </div>
              </div>
              <div className="dash-insight-card">
                <div className="dash-insight-label">Weekly Planned Load</div>
                <div className="dash-insight-value-row">
                  <strong>{weeklyHours}h</strong>
                  <span>{stats.dayLoadMinutes.filter((m) => m > 0).length} active day(s)</span>
                </div>
              </div>
              <div className="dash-insight-card">
                <div className="dash-insight-label">AI Outputs Saved</div>
                <div className="dash-insight-value-row">
                  <strong>{stats.aiOutputs}</strong>
                  <span>Reusable study assets</span>
                </div>
              </div>
            </div>
            <div className="dash-workload-list">
              {dayLoadWeek.map((day) => {
                const value = stats.dayLoadMinutes[day.idx] || 0;
                const width = Math.max(6, Math.round((value / maxWorkload) * 100));
                return (
                  <div key={day.key} className="dash-workload-row">
                    <span>{day.key}</span>
                    <div className="dash-workload-track">
                      <div className="dash-workload-fill" style={{ width: `${width}%` }} />
                    </div>
                    <strong>{Math.round((value / 60) * 10) / 10}h</strong>
                  </div>
                );
              })}
            </div>
          </div>


        </div>

        {/* Right Column: Upcoming Exams */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)', alignSelf: 'start' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
             <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--text-main)' }}>Upcoming Exams</h2>
             <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>{filteredExams.length} total</span>
           </div>

           {filteredExams.length === 0 ? (
             <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No exams scheduled yet.</p>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
               {filteredExams
                 .sort((a, b) => new Date(a.date) - new Date(b.date))
                 .map(exam => {
                   const examDate = new Date(exam.date);
                   const now = new Date();
                   const diffDays = Math.ceil((examDate - now) / 86400000);
                   const isPast = diffDays < 0;
                   const isUrgent = !isPast && diffDays <= 3;
                   const isSoon = !isPast && diffDays <= 7;
                   return (
                     <div key={exam.id} style={{ display: 'flex', gap: '12px', padding: '12px', background: 'var(--item-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                       <div style={{ width: '4px', borderRadius: '2px', flexShrink: 0, background: isPast ? 'var(--text-muted)' : isUrgent ? '#ef4444' : isSoon ? '#eab308' : 'var(--primary)' }}></div>
                       <div style={{ flex: 1, minWidth: 0 }}>
                         <h4 style={{ fontSize: '14px', color: isPast ? 'var(--text-muted)' : 'var(--text-main)', margin: '0 0 4px 0', textDecoration: isPast ? 'line-through' : 'none' }}>{exam.title}</h4>
                         <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 2px 0' }}>{exam.course?.title || ''}</p>
                         <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                           {examDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                           {!isPast && <span style={{ marginLeft: '8px', color: isUrgent ? '#ef4444' : isSoon ? '#eab308' : 'var(--primary)', fontWeight: 600 }}>({diffDays}d left)</span>}
                         </p>
                       </div>
                     </div>
                   );
                 })}
             </div>
           )}

          <button onClick={() => navigate("/exams")} style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--secondary)', color: 'var(--on-secondary)', fontWeight: 600, cursor: 'pointer' }}>
             Open Full Calendar
           </button>
        </div>

      </div>
    </div>
  );
};

// Parses AI quiz text → [{index, question, options:{A,B,C,D}}]
const parseQuizText = (text) => {
  if (!text) return [];
  const questions = [];
  const blocks = text.split(/(?=^\s*\d{1,2}[.)\s])/m).filter(b => b.trim());
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    const questionLine = lines[0].replace(/^\d{1,2}[.)\s]*/, "").trim();
    if (!questionLine) continue;
    const options = {};
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^([A-Da-d])[.):\s]+(.+)/);
      if (m) options[m[1].toUpperCase()] = m[2].trim();
    }
    if (Object.keys(options).length >= 2) {
      questions.push({ index: questions.length + 1, question: questionLine, options });
    }
  }
  return questions;
};

const InteractiveQuiz = ({ quizText, quizId, courseId, onClose }) => {
  const questions = parseQuizText(quizText);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState({});
  const [phase, setPhase] = useState("quiz"); // 'quiz' | 'checking' | 'results'
  const [resultLines, setResultLines] = useState([]);

  if (!questions.length) return null;

  const total = questions.length;
  const q = questions[current];
  const progress = Math.round((current / total) * 100);
  const allAnswered = Object.keys(selected).length === total;

  const buildReviewRows = (rawResults) => {
    const results = Array.isArray(rawResults) ? rawResults : [];
    const mappedByQuestion = new Map();
    const usedQuestionIndexes = new Set();

    for (let i = 0; i < results.length; i++) {
      const row = results[i] || {};
      const rawIndex =
        row.index ??
        row.questionIndex ??
        row.question_number ??
        row.questionNumber ??
        row.number;
      const parsedIndex = Number(
        String(rawIndex ?? "").match(/\d+/)?.[0] || NaN
      );

      let qIdx = Number.isFinite(parsedIndex) ? parsedIndex - 1 : i;
      if (qIdx < 0 || qIdx >= total || usedQuestionIndexes.has(qIdx)) {
        qIdx = i < total && !usedQuestionIndexes.has(i)
          ? i
          : questions.findIndex((_, idx) => !usedQuestionIndexes.has(idx));
      }
      if (qIdx < 0 || qIdx >= total) continue;

      usedQuestionIndexes.add(qIdx);
      mappedByQuestion.set(qIdx, row);
    }

    return questions.map((questionItem, idx) => {
      const result = mappedByQuestion.get(idx) || {};
      const chosenOption = selected[idx] ? String(selected[idx]).toUpperCase() : "";
      const rawCorrectOption = result.correctOption ?? result.correct_answer ?? result.answer;
      const correctOption = rawCorrectOption ? String(rawCorrectOption).toUpperCase().trim() : "";
      const hasBooleanVerdict = typeof result.isCorrect === "boolean";
      const isAnswered = Boolean(chosenOption);
      const isCorrect = hasBooleanVerdict
        ? result.isCorrect
        : (isAnswered && correctOption ? chosenOption === correctOption : false);
      const status = !isAnswered ? "Unanswered" : (isCorrect ? "Correct" : "Incorrect");

      return {
        questionIndex: idx,
        question: questionItem.question,
        selectedOption: chosenOption,
        selectedText: chosenOption ? (questionItem.options[chosenOption] || "") : "",
        correctOption,
        correctText: correctOption ? (questionItem.options[correctOption] || "") : "",
        isAnswered,
        isCorrect,
        status,
        explanation: String(
          result.explanation ||
          result.reason ||
          (!isAnswered ? "No answer provided." : "")
        ),
      };
    });
  };

  const choose = (letter) => setSelected(prev => {
    if (prev[current] === letter) {
      const next = { ...prev };
      delete next[current];
      return next;
    }
    return { ...prev, [current]: letter };
  });

  const submitAnswers = async () => {
    const answersStr = Object.entries(selected)
      .map(([idx, letter]) => `${questions[Number(idx)].index}:${letter}`)
      .join(", ");
    setPhase("checking");
    try {
      const result = await apiRequest("/api/ai/quiz-check", {
        method: "POST",
        body: { courseId, quizText, answers: answersStr, ...(quizId ? { quizId } : {}) },
      });
      const raw = result.output || result.evaluation || "";
      try {
        let parsed = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
        if (!Array.isArray(parsed)) parsed = [parsed];
        setResultLines(parsed);
      } catch (err) {
        setResultLines([{ explanation: "Checking failed or unreadable format: " + raw }]);
      }
      setPhase("results");
    } catch (err) {
      setResultLines([{ explanation: err?.message || "Quiz check failed." }]);
      setPhase("results");
    }
  };

  const reviewRows = buildReviewRows(resultLines);
  const correctCount = reviewRows.filter(row => row.isCorrect).length;

  return (
    <div className="iq-overlay">
      <div className={`iq-modal ${phase === "results" ? "iq-modal-results" : ""}`}>
        <div className="iq-header">
          <span className="iq-title"> Interactive Quiz</span>
          <button className="iq-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {phase === "quiz" && (
          <>
            <div className="iq-progress-row">
              <span>{current + 1} / {total}</span>
              <span>{Object.keys(selected).length} answered</span>
            </div>
            <div className="iq-progress-track">
              <div className="iq-progress-bar" style={{ width: `${progress}%` }} />
            </div>
            <p className="iq-question">{q.index}. {q.question}</p>
            <div className="iq-options">
              {["A", "B", "C", "D"].filter(k => q.options[k]).map(letter => (
                <button
                  key={letter}
                  className={`iq-option ${selected[current] === letter ? "iq-selected" : ""}`}
                  onClick={() => choose(letter)}
                >
                  <span className="iq-option-badge">{letter}</span>
                  <span className="iq-option-text">{q.options[letter]}</span>
                </button>
              ))}
            </div>
            <div className="iq-nav">
              <button className="iq-nav-btn" onClick={() => setCurrent(c => c - 1)} disabled={current === 0}>← Prev</button>
              {current < total - 1
                ? <button className="iq-nav-btn" onClick={() => setCurrent(c => c + 1)}>Next →</button>
                : <button className="iq-nav-btn iq-submit" onClick={submitAnswers}>Submit </button>
              }
            </div>
            {!allAnswered && current === total - 1 && (
              <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                {total - Object.keys(selected).length} question(s) unanswered
              </p>
            )}
            <div className="iq-dots">
              {questions.map((_, i) => (
                <button key={i}
                  className={`iq-dot ${i === current ? "iq-dot-active" : ""} ${selected[i] ? "iq-dot-done" : ""}`}
                  onClick={() => setCurrent(i)} title={`Q${i + 1}`} />
              ))}
            </div>
          </>
        )}

        {phase === "checking" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div className="fc-spinner" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "var(--text-muted)" }}>Checking your answers…</p>
          </div>
        )}

        {phase === "results" && (
          <div className="iq-results">
            <div className="iq-score-circle">
              <span className="iq-score-num">{correctCount}</span>
              <span className="iq-score-den">/ {total}</span>
            </div>
            <h3 className="iq-score-label">
              {correctCount === total ? " Perfect!" :
                correctCount >= total * 0.8 ? " Great job!" :
                  correctCount >= total * 0.5 ? " Good effort!" : " Keep practicing!"}
            </h3>
            <div className="iq-result-lines">
              {reviewRows.map((row, i) => {
                const isOk = row.isCorrect;
                const unresolved = !row.isAnswered;
                return (
                  <div key={i} className={`iq-result-line ${isOk ? "iq-line-ok" : "iq-line-err"}`} 
                    style={{ 
                      display: 'flex', flexDirection: 'column', gap: '8px', 
                      padding: '16px', background: 'var(--item-bg)', 
                      borderRadius: '12px', marginBottom: '12px', 
                      border: '1px solid var(--border)', textAlign: 'left'
                    }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '15px' }}>
                      {row.questionIndex + 1}. {row.question}
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '4px' }}>
                      <span style={{ color: unresolved ? 'var(--text-muted)' : (isOk ? '#2ecc71' : '#e74c3c'), fontWeight: '500' }}>
                        Status: {row.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '14px', marginTop: '2px' }}>
                      <span style={{ color: unresolved ? 'var(--text-muted)' : 'var(--text-main)' }}>
                        Your Answer: {row.selectedOption ? `${row.selectedOption}) ${row.selectedText}` : 'None'}
                      </span>
                      {row.correctOption && (
                        <div style={{ color: '#2ecc71', fontWeight: '500', marginTop: '4px' }}>
                          Correct Answer: {`${row.correctOption}) ${row.correctText || ""}`}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.5' }}>
                      <strong>Explanation:</strong> {row.explanation || "No explanation provided."}
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="upload-btn green" style={{ marginTop: "20px", width: "100%" }}
              onClick={() => { setCurrent(0); setSelected({}); setPhase("quiz"); setResultLines([]); }}>
               Retake Quiz
            </button>
          </div>
        )}
      </div>
    </div>
  );
};








const QuizPage = ({ theme, toggleTheme, onAuthError }) => {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [courseFiles, setCourseFiles] = useState([]);
  const [courseNotes, setCourseNotes] = useState([]);
  const [targetCourse, setTargetCourse] = useState("all");
  const [targetFiles, setTargetFiles] = useState([]);
  const [targetNotes, setTargetNotes] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");
  const [questionCount, setQuestionCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizOutput, setQuizOutput] = useState("");
  const [lastQuizOutput, setLastQuizOutput] = useState("");
  const [lastQuizId, setLastQuizId] = useState("");
  const [showInteractiveQuiz, setShowInteractiveQuiz] = useState(false);
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [outputExpanded, setOutputExpanded] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const handleApiError = (error) => {
    if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
    const message = error?.message || "Quiz generation failed.";
    setQuizOutput(message);
    toast.error(message);
  };

  useEffect(() => {
    let mounted = true;
    apiRequest("/api/courses/joined")
      .then(res => { if (mounted) setCourses(res.data || []); })
      .catch(err => { if (mounted) handleApiError(err); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targetCourse === "all") { 
      setCourseFiles([]); 
      setCourseNotes([]);
      setTargetFiles([]); 
      setTargetNotes([]);
      setShowMaterialModal(false);
      return; 
    }
    let mounted = true;
    
    // Fetch Files
    apiRequest(`/api/files?courseId=${encodeURIComponent(targetCourse)}`)
      .then(res => { if (mounted) setCourseFiles(res.files || res.data || []); })
      .catch(() => { if (mounted) setCourseFiles([]); });

    // Fetch Notes
    apiRequest(`/api/notes?courseId=${encodeURIComponent(targetCourse)}`)
      .then(res => { if (mounted) setCourseNotes(res.data || []); })
      .catch(() => { if (mounted) setCourseNotes([]); });

    return () => { mounted = false; };
  }, [targetCourse]);

  const sanitizeQuizOutput = (text) => {
    if (!text) return "";
    const stripped = text.replace(/\s*\(?(?:correct\s*answer|answer)\s*[:-]\s*[A-Za-z]\)?/gi, "");
    const cleaned = stripped.split(/\r?\n/)
      .filter((line) => !/^\s*(?:correct\s*answer|answer|answer key)\b/i.test(line))
      .join("\n").replace(/\n{3,}/g, "\n\n").trim();
    const parsed = parseQuizText(cleaned);
    if (!parsed.length) return cleaned;
    return parsed
      .map((question, idx) => {
        const optionLines = ["A", "B", "C", "D"]
          .filter((letter) => question.options[letter])
          .map((letter) => `${letter}) ${question.options[letter]}`);
        return `${idx + 1}. ${question.question}\n${optionLines.join("\n")}`;
      })
      .join("\n\n")
      .trim();
  };

  const generateQuiz = async () => {
    const payload = { questionCount };
    if (targetFiles.length > 0) payload.fileIds = targetFiles;
    if (targetNotes.length > 0) payload.noteIds = targetNotes;
    
    if (targetFiles.length === 0 && targetNotes.length === 0 && targetCourse !== "all") {
      payload.courseId = targetCourse;
    } else if (targetCourse === "all") {
       // Generic library mode
    }
    if (difficulty) payload.difficulty = difficulty;
    try {
      setIsGenerating(true);
      setQuizOutput("Academia AI is generating your quiz...");
      setShowInteractiveQuiz(false);
      setOutputCollapsed(false);
      const result = await apiRequest("/api/ai/quiz", { method: "POST", body: payload });
      const rawOutput = result.output || result.quiz || "AI response was empty.";
      const output = sanitizeQuizOutput(rawOutput);
      setQuizOutput(output);
      setLastQuizOutput(output);
      setLastQuizId(result.quizId || "");
      toast.success("Quiz generated successfully!");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const parsedQuestions = parseQuizText(lastQuizOutput);
  const renderQuizOutput = (content) => {
    const parsed = parseQuizText(content);
    if (!parsed.length) return <MarkdownOutput text={content} />;

    return (
      <div className="qz-parsed-output">
        {parsed.map((question, index) => (
          <div key={`${question.question}-${index}`} className="qz-parsed-question">
            <div className="qz-parsed-title">{index + 1}. {question.question}</div>
            <div className="qz-parsed-options">
              {["A", "B", "C", "D"].filter((letter) => question.options[letter]).map((letter) => (
                <div key={letter} className="qz-parsed-option">
                  <span className="qz-parsed-letter">{letter})</span>
                  <span>{question.options[letter]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const outputPanelClass = `qz-output ${outputCollapsed ? 'collapsed' : ''} ${outputExpanded ? 'expanded' : ''}`;

  const [savedQuizzes, setSavedQuizzes] = useState([]);
  const [viewingSavedQuiz, setViewingSavedQuiz] = useState(null);

  const loadSavedQuizzes = async () => {
    try {
      const res = await apiRequest("/api/ai/outputs");
      setSavedQuizzes((res.data || []).filter(o => o.type === "quiz"));
    } catch {}
  };

  const saveQuizOutput = async () => {
    if (!quizOutput || isGenerating) return;
    try {
      const courseName = courses.find(c => c.id === targetCourse)?.title || "All Courses";
      await apiRequest("/api/ai/outputs", {
        method: "POST",
        body: { type: "quiz", title: `Quiz - ${fixEncoding(courseName)} (${questionCount}Q)`, content: quizOutput, courseId: targetCourse !== "all" ? targetCourse : undefined }
      });
      toast.success("Quiz saved!");
      loadSavedQuizzes();
    } catch { toast.error("Failed to save"); }
  };

  const deleteSavedQuiz = async (id) => {
    try {
      await apiRequest(`/api/ai/outputs/${id}`, { method: "DELETE" });
      setSavedQuizzes(prev => prev.filter(o => o.id !== id));
      if (viewingSavedQuiz?.id === id) setViewingSavedQuiz(null);
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSavedQuizzes(); }, []);

  return (
    <div className={`upload-page ${theme}`}>
      {showInteractiveQuiz && (
        <InteractiveQuiz
          quizText={lastQuizOutput}
          quizId={lastQuizId}
          courseId={targetCourse}
          onClose={() => setShowInteractiveQuiz(false)}
        />
      )}

      <div className="upload-card">
        <h2 style={{margin:0}}>Generate Quiz</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "15px", lineHeight: 1.5 }}>
          Generate AI-powered quizzes from your course materials. Upload documents or select from your current subjects to test your knowledge instantly.
        </p>

        <div className="qz-grid">
          {/* Left: Quiz Settings */}
          <div className="qz-settings">
            <h3>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
              Quiz Settings
            </h3>

            <label className="qz-label">Course</label>
            <select className="qz-select" value={targetCourse} onChange={(e) => { setTargetCourse(e.target.value); setTargetFiles([]); setTargetNotes([]); }}>
              <option value="all">Select a course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}{c.code ? ` (${c.code})` : ""}</option>
              ))}
            </select>

            {targetCourse !== "all" && (
              <div className="tool-context-shell">
                <div className="tool-context-bar">
                  <button type="button" className="cb-material-open-btn" onClick={() => setShowMaterialModal(true)}>Select Materials</button>
                </div>
              </div>
            )}

            {showMaterialModal && targetCourse !== "all" && (
              <div className="cb-modal-overlay" onClick={() => setShowMaterialModal(false)}>
                <div className="cb-modal cb-material-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="cb-material-modal-header">
                    <h3>Select Materials</h3>
                    <button className="cb-context-close" onClick={() => setShowMaterialModal(false)} aria-label="Close material picker">✕</button>
                  </div>

                  <div className="cb-material-modal-body">
                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Files</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetFiles(courseFiles.map((file) => file.id))} disabled={courseFiles.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetFiles([])} disabled={targetFiles.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseFiles.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course files">
                          {courseFiles.map((file, idx) => {
                            const checked = targetFiles.includes(file.id);
                            return (
                              <motion.label
                                key={file.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTargetFiles((prev) => checked ? prev.filter((id) => id !== file.id) : [...prev, file.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(file.fileName || file.originalName || file.name || "Untitled file")}</span>
                                  <span className="cb-material-card-meta">File</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No files in this course yet.</div>
                      )}
                    </div>

                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Notes</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetNotes(courseNotes.map((note) => note.id))} disabled={courseNotes.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetNotes([])} disabled={targetNotes.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseNotes.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course notes">
                          {courseNotes.map((note, idx) => {
                            const checked = targetNotes.includes(note.id);
                            return (
                              <motion.label
                                key={note.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTargetNotes((prev) => checked ? prev.filter((id) => id !== note.id) : [...prev, note.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(note.title || note.noteTitle || "Untitled note")}</span>
                                  <span className="cb-material-card-meta">Note</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No notes in this course yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="cb-modal-actions">
                    <button className="secondary-btn" onClick={() => setShowMaterialModal(false)}>Close</button>
                    <button className="qz-generate-btn" style={{ padding: "10px 16px", width: "auto" }} onClick={() => setShowMaterialModal(false)}>Done</button>
                  </div>
                </div>
              </div>
            )}

            <label className="qz-label">Difficulty Level</label>
            <div className="qz-difficulty-row">
              {["easy","medium","hard"].map(d => (
                <button key={d} className={`qz-diff-btn ${difficulty === d ? 'active' : ''}`} onClick={() => setDifficulty(d)}>{d}</button>
              ))}
            </div>

            <label className="qz-label">Number of Questions</label>
            <div className="qz-count-row">
              {[10, 20, 30].map(n => (
                <button key={n} className={`qz-count-btn ${questionCount === n ? 'active' : ''}`} onClick={() => setQuestionCount(n)}>{n}</button>
              ))}
            </div>

            <button className="qz-generate-btn" onClick={generateQuiz} disabled={isGenerating}>
              {isGenerating ? <span className="loading-dots">Generating</span> : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/></svg>
                  Generate Quiz
                </>
              )}
            </button>
          </div>

          {/* Right: Quiz Output Panel */}
          <div className={outputPanelClass}>
            <div className="qz-output-header">
              <h3>{viewingSavedQuiz ? viewingSavedQuiz.title : "Quiz Output"}</h3>
              <div className="qz-output-controls">
                {(quizOutput && !isGenerating && !viewingSavedQuiz) && (
                  <button className="qz-ctrl-btn" onClick={saveQuizOutput} title="Save Quiz">💾</button>
                )}
                {viewingSavedQuiz && (
                  <button className="qz-ctrl-btn" onClick={() => setViewingSavedQuiz(null)} title="Close Saved">✕</button>
                )}
                <button className="qz-ctrl-btn" onClick={() => setOutputCollapsed(!outputCollapsed)} title={outputCollapsed ? "Expand" : "Collapse"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {outputCollapsed ? (
                      <polyline points="6 9 12 15 18 9"/>
                    ) : (
                      <polyline points="18 15 12 9 6 15"/>
                    )}
                  </svg>
                </button>
                <button className="qz-ctrl-btn" onClick={() => setOutputExpanded(!outputExpanded)} title={outputExpanded ? "Minimize" : "Maximize"}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {outputExpanded ? (
                      <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>
                    ) : (
                      <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                    )}
                  </svg>
                </button>
              </div>
            </div>
            <div className="qz-output-body">
              {(viewingSavedQuiz ? viewingSavedQuiz.content : quizOutput) ? (
                renderQuizOutput(viewingSavedQuiz ? viewingSavedQuiz.content : quizOutput)
              ) : (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'300px',color:'var(--text-muted)',textAlign:'center'}}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{marginBottom:'16px',opacity:0.4}}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <p style={{fontWeight:600,fontSize:'16px',marginBottom:'8px',color:'var(--text-main)'}}>Your Studio is Ready</p>
                  <p style={{fontSize:'14px',maxWidth:'300px'}}>Select a course and generate a quiz to get started. Our AI will curate questions based on your specific curriculum and material.</p>
                </div>
              )}
              {lastQuizOutput && parsedQuestions.length > 0 && (
                <div className="iq-cta" style={{marginTop:'16px'}}>
                  <div>
                    <p className="iq-cta-title"> Quiz ready! ({parsedQuestions.length} questions parsed)</p>
                    <p className="iq-cta-sub">Take the interactive quiz with A/B/C/D buttons and instant grading.</p>
                  </div>
                  <button className="qz-generate-btn" onClick={() => setShowInteractiveQuiz(true)} style={{ width: "auto", padding: "12px 24px" }}>
                     Start Quiz
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {savedQuizzes.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>{"\ud83d\udcdd"} Saved Quizzes</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {savedQuizzes.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', cursor: 'pointer' }}
                  onClick={() => { setViewingSavedQuiz(s); setOutputCollapsed(false); }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: 'var(--text-main)' }}>{fixEncoding(s.title)}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteSavedQuiz(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '4px' }}>{"\u2715"}</button>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {s.content.substring(0, 120)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const UploadMaterials = ({ theme, toggleTheme, onAuthError, searchQuery }) => {
  const location = useLocation();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [activeCourseId, setActiveCourseId] = useState("all");
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  const [courseTitle, setCourseTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");

  // Note editing state
  const [expandedNoteId, setExpandedNoteId] = useState(null);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const handleApiError = (error) => {
    if (error?.status === 401) {
      clearAuthSession();
      onAuthError();
      return;
    }
    toast.error(error?.message || "Request failed");
  };

  const loadCourses = async () => {
    try {
      const result = await apiRequest("/api/courses/joined");
      setCourses(result.data || []);
    } catch (error) {
      handleApiError(error);
    }
  };

  const loadCourseData = async (courseIds) => {
    if (!courseIds.length) {
      setNotes([]);
      setFiles([]);
      return;
    }

    try {
      const [noteGroups, fileGroups] = await Promise.all([
        Promise.all(courseIds.map(id => apiRequest(`/api/notes?courseId=${encodeURIComponent(id)}`))),
        Promise.all(courseIds.map(id => apiRequest(`/api/files?courseId=${encodeURIComponent(id)}`))),
      ]);

      setNotes(noteGroups.flatMap(group => group.data || []));
      setFiles(fileGroups.flatMap(group => group.data || []));
    } catch (error) {
      handleApiError(error);
    }
  };

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (location.state?.courseId) {
      setActiveCourseId(location.state.courseId);
    }
  }, [location.state]);

  useEffect(() => {
    if (!courses.length) {
      setNotes([]);
      setFiles([]);
      return;
    }

    const courseIds = activeCourseId === "all"
      ? courses.map(course => course.id)
      : [activeCourseId];

    loadCourseData(courseIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCourseId, courses]);

  const createCourse = async () => {
    if (!courseTitle.trim()) return;

    try {
      const result = await apiRequest("/api/courses", {
        method: "POST",
        body: { title: courseTitle.trim(), code: courseCode.trim() || undefined },
      });

      setCourses(prev => [result.data, ...prev]);
      setCourseTitle("");
      setCourseCode("");
      toast.success(`Course "${result.data.title}" added successfully!`);
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteCourse = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this course? This will completely drop all exams, notes, and files inside it.")) return;
    try {
      await apiRequest(`/api/courses/${id}`, { method: "DELETE" });
      setCourses(prev => prev.filter(c => c.id !== id));
      if (activeCourseId === id) setActiveCourseId("all");
      toast.success("Course destroyed.");
    } catch (error) {
      handleApiError(error);
    }
  };

  const createNote = async () => {
    if (!noteTitle.trim() || !noteContent.trim() || activeCourseId === "all") {
      toast.error("Please select a specific course first to add a note.");
      return;
    }

    try {
      const result = await apiRequest("/api/notes", {
        method: "POST",
        body: {
          courseId: activeCourseId,
          title: noteTitle.trim(),
          content: noteContent.trim(),
          isPrivate: true,
        },
      });
      setNotes(prev => [result.data, ...prev]);
      setNoteTitle("");
      setNoteContent("");
      toast.success("Note created successfully!");
    } catch (error) {
      handleApiError(error);
    }
  };

  const generateAINotes = async () => {
    try {
      setIsGeneratingNotes(true);
      toast.success("Academia AI is creating your structured notes...");
      const result = await apiRequest("/api/ai/notes", { method: "POST", body: { courseId: activeCourseId } });
      const output = result.output || result.notes || "";
      if (output) {
        setNoteTitle("AI Generated Notes");
        setNoteContent(output);
        toast.success("Notes generated! Click 'Save Note' to keep them.");
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (activeCourseId === "all") {
      toast.error("Please select a specific course before uploading files.");
      setIsDragging(false);
      return;
    }
    const filesToUpload = e.dataTransfer ? Array.from(e.dataTransfer.files) : Array.from(e.target.files);
    if (filesToUpload.length === 0) return;

    setIsDragging(false);

    const uploadPromises = filesToUpload.map(file => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("courseId", activeCourseId);
      formData.append("isPrivate", "true");
      return apiRequest("/api/files/upload", {
        method: "POST",
        body: formData,
        isFormData: true,
      });
    });

    try {
      const results = await Promise.all(uploadPromises);
      const newFiles = results.map(res => res.data);
      setFiles(prev => [...newFiles, ...prev]);
      toast.success(`${newFiles.length} file(s) uploaded successfully!`);
    } catch (error) {
      handleApiError(error);
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const deleteNote = async (id) => {
    try {
      await apiRequest(`/api/notes/${id}`, { method: "DELETE" });
      setNotes(prev => prev.filter(note => note.id !== id));
      if (expandedNoteId === id) setExpandedNoteId(null);
      if (editingNoteId === id) setEditingNoteId(null);
      toast.success("Note deleted successfully!");
    } catch (error) {
      handleApiError(error);
    }
  };

  const startEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content || "");
    setExpandedNoteId(note.id);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditTitle("");
    setEditContent("");
  };

  const saveEditNote = async () => {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    try {
      const result = await apiRequest(`/api/notes/${editingNoteId}`, {
        method: "PUT",
        body: { title: editTitle.trim(), content: editContent.trim() },
      });
      setNotes(prev => prev.map(n => n.id === editingNoteId ? (result.data || { ...n, title: editTitle.trim(), content: editContent.trim() }) : n));
      setEditingNoteId(null);
      setEditTitle("");
      setEditContent("");
      toast.success("Note updated successfully!");
    } catch (error) {
      handleApiError(error);
    } finally {
      setEditSaving(false);
    }
  };

  const deleteFile = async (id) => {
    try {
      await apiRequest(`/api/files/${id}`, { method: "DELETE" });
      setFiles(prev => prev.filter(file => file.id !== id));
    } catch (error) {
      handleApiError(error);
    }
  };



  const downloadNote = (note) => {
    const element = document.createElement("a");
    const file = new Blob([note.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${note.title}.txt`;
    document.body.appendChild(element);
    element.click();
    element.remove();
  };

  const downloadFile = async (file) => {
    try {
      const token = getAuthToken();
      if (!token) {
        clearAuthSession();
        onAuthError();
        return;
      }
      const response = await fetch(`${API_BASE}/api/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const text = await response.text();
        let message = `Download failed (${response.status})`;
        if (text) {
          try {
            const data = JSON.parse(text);
            message = data.message || message;
          } catch {
            message = text;
          }
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.fileName || file.name || "download";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      handleApiError(error);
    }
  };

  const previewFileItem = async (file) => {
    try {
      const token = getAuthToken();
      if (!token) {
        clearAuthSession();
        onAuthError();
        return;
      }
      const response = await fetch(`${API_BASE}/api/files/${file.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Preview failed");

      const contentType = response.headers.get("Content-Type") || file.mimeType || "application/pdf";
      const blob = await response.blob();
      const previewBlob = new Blob([blob], { type: contentType });
      
      const objectUrl = URL.createObjectURL(previewBlob);
      setPreviewUrl(objectUrl);
      setPreviewFile(file);
    } catch (error) {
      handleApiError(error);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewFile(null);
  };

  const filteredNotes = (activeCourseId === "all"
      ? notes
      : notes.filter(n => n.courseId === activeCourseId)
    ).filter(note =>
      !searchQuery ||
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (note.content && note.content.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  const filteredFiles = (activeCourseId === "all"
      ? files
      : files.filter(f => f.courseId === activeCourseId)
    ).filter(file =>
      !searchQuery ||
      (file.fileName && file.fileName.toLowerCase().includes(searchQuery.toLowerCase()))
    );


  return (
    <div className={`upload-page ${theme}`}>
      {previewFile && previewUrl && (
        <div className="preview-modal-overlay" onClick={closePreview}>
          <div className="preview-modal" onClick={e => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3> {previewFile.fileName || previewFile.name}</h3>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="secondary-btn" onClick={() => downloadFile(previewFile)}> Download</button>
                <button className="del" onClick={closePreview}> Close</button>
              </div>
            </div>
            <div className="preview-modal-body">
              <iframe
                src={previewUrl}
                title={previewFile.fileName}
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          </div>
        </div>
      )}

      <div className="upload-card">
        {activeCourseId === "all" ? (
          <>
            <h2 style={{ margin: 0 }}> My Classes</h2>
            <p style={{color:'var(--text-muted)',fontSize:'15px',marginBottom:'24px',lineHeight:1.5}}>Manage your courses and study materials.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px', alignItems: 'start' }}>
              {/* Left: Add New Class */}
              <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)' }}>
                <h3 style={{margin:'0 0 16px 0',fontSize:'18px',color:'var(--text-main)'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px',verticalAlign:'text-bottom'}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Add New Class
                </h3>
                <label style={{fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',display:'block',marginBottom:'6px'}}>Class Title</label>
                <input
                  placeholder="e.g. Advanced Machine Learning"
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  style={{ width: '100%', marginBottom: '12px' }}
                />
                <label style={{fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',display:'block',marginBottom:'6px'}}>Code (Optional)</label>
                <input
                  placeholder="e.g. CS501"
                  value={courseCode}
                  onChange={e => setCourseCode(e.target.value)}
                  style={{ width: '100%', marginBottom: '16px' }}
                />
                <button className="qz-generate-btn" onClick={createCourse}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:'8px'}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Class
                </button>
              </div>

              {/* Right: Your Classes */}
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                  <h3 style={{margin:0,fontSize:'18px',color:'var(--text-main)'}}>Your Classes</h3>
                </div>
                {courses.length === 0 ? (
                  <p className="ne-empty">You haven't added any classes yet. Create one to get started!</p>
                ) : (
                  <div className="dash-courses" style={{ marginTop: "0" }}>
                    {courses.map(c => (
                      <div 
                        key={c.id} 
                        className="dash-course-card" 
                        style={{ cursor: "pointer", transition: "transform 0.2s", position: "relative" }}
                        onClick={() => setActiveCourseId(c.id)}
                      >
                        <div className="dash-course-icon"></div>
                        <div className="dash-course-info">
                          <p className="dash-course-title">{c.title}</p>
                          <p className="dash-course-code">{c.code || "No code"}</p>
                        </div>
                        <span style={{color:'var(--accent)',fontSize:'14px',fontWeight:600,display:'flex',alignItems:'center',gap:'4px'}}>Open <span>→</span></span>
                        <button 
                          onClick={(e) => deleteCourse(c.id, e)}
                          style={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            border: '1px solid #ef444433',
                            background: '#ef444411',
                            color: '#ef4444',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '4px 8px'
                          }}
                          title="Delete Course"
                        >Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}> {courses.find(c => c.id === activeCourseId)?.title}</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="secondary-btn"
                  onClick={(e) => deleteCourse(activeCourseId, e)}
                  style={{ borderColor: '#ef4444', color: '#ef4444' }}
                >
                  Delete Class
                </button>
                <button className="secondary-btn" onClick={() => setActiveCourseId("all")}>← Back to Classes</button>
              </div>
            </div>

            <div className="section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0 }}> Notes</h3>
                <button className="secondary-btn" onClick={generateAINotes} disabled={isGeneratingNotes} style={{ padding: "8px 16px", fontSize: "13px" }}>
                  {isGeneratingNotes ? "Generating..." : "Generate AI Notes"}
                </button>
              </div>
              <div className="ne-create">
              <input
                className="ne-input"
                placeholder="Note Title"
                value={noteTitle}
                onChange={e => setNoteTitle(e.target.value)}
              />
              <textarea
                className="ne-textarea"
                placeholder="Type your notes here..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                rows={4}
              />
              <button className="upload-btn green" onClick={createNote} disabled={!noteTitle.trim() || !noteContent.trim()}> Save Note</button>
            </div>

          <div className="ne-list">
            {filteredNotes.length === 0 && (
              <p className="ne-empty">No notes yet. Create your first note above!</p>
            )}
            {filteredNotes.map(n => {
              const isExpanded = expandedNoteId === n.id;
              const isEditing = editingNoteId === n.id;
              const preview = (n.content || "").length > 80
                ? n.content.slice(0, 80) + "…"
                : n.content || "";
              return (
                <div key={n.id} className={`ne-card ${isExpanded ? "ne-expanded" : ""}`}>
                  <div className="ne-card-header" onClick={() => { if (!isEditing) setExpandedNoteId(isExpanded ? null : n.id); }}>
                    <div className="ne-card-info">
                      <span className="ne-card-icon">{isExpanded ? "" : ""}</span>
                      <div>
                        <p className="ne-card-title">{n.title}</p>
                        {!isExpanded && <p className="ne-card-preview">{preview}</p>}
                      </div>
                    </div>
                    <div className="ne-card-actions" onClick={e => e.stopPropagation()}>
                      <button className="ne-action-btn" onClick={() => startEditNote(n)} title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      <button className="ne-action-btn" onClick={() => downloadNote(n)} title="Download">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <button className="ne-action-btn ne-del" onClick={() => deleteNote(n.id)} title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="ne-card-body">
                      {isEditing ? (
                        <div className="ne-edit-form">
                          <input
                            className="ne-input"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                            placeholder="Note title"
                          />
                          <textarea
                            className="ne-textarea"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            rows={8}
                          />
                          <div className="ne-edit-actions">
                            <button className="upload-btn green" onClick={saveEditNote} disabled={editSaving || !editTitle.trim()}>
                              {editSaving ? "Saving…" : " Save"}
                            </button>
                            <button className="secondary-btn" onClick={cancelEdit}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <pre className="ne-content">{n.content}</pre>
                      )}
                      {n.createdAt && (
                        <p className="ne-date">Created: {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <hr />

        <div className="section">
          <h3>Materials {activeCourseId === "all" ? "All Courses" : courses.find(c => c.id === activeCourseId)?.title}</h3>
          
          {activeCourseId !== "all" && (
            <div 
              className={`dropzone ${isDragging ? "active" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
              onDrop={handleFileUpload}
              onClick={() => document.getElementById("fileDropzoneInput").click()}
            >
              <div className="dropzone-icon"></div>
              <p>Drag & Drop your files here, or <strong>click to browse</strong></p>
              <span className="dropzone-sub">Supported formats: PDF, DOCX, TXT, PPTX, Images (Max 100MB per file)</span>
              <input id="fileDropzoneInput" type="file" style={{ display: "none" }} onChange={handleFileUpload} multiple />
            </div>
          )}

          <div className="list-view">
            {filteredFiles.map(f => (
              <div key={f.id} className="item-row">
                <span> {f.fileName || f.name}</span>
                <div className="actions">
                  <button className="view-link" onClick={() => previewFileItem(f)} title="Preview File"> Preview</button>
                  <button className="view-link" onClick={() => downloadFile(f)} title="Download File">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download
                  </button>
                  <button className="del" onClick={() => deleteFile(f.id)} title="Delete File">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
};

const ExamScheduler = ({ theme, toggleTheme, onAuthError, searchQuery }) => {
  const location = useLocation();
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [exams, setExams] = useState([]);
  const [examTitle, setExamTitle] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examDescription, setExamDescription] = useState("");
  const [targetCourseId, setTargetCourseId] = useState("");
  const [loading, setLoading] = useState(true);
  const [highlightedExamId, setHighlightedExamId] = useState("");

  const handleApiError = React.useCallback((err) => {
    if (err?.status === 401) { clearAuthSession(); onAuthError(); return; }
    toast.error(err?.message || "Request failed");
  }, [onAuthError, toast]);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const cRes = await apiRequest("/api/courses/joined");
        const courseList = cRes.data || [];
        if (!mounted) return;
        setCourses(courseList);
        if (courseList.length > 0) {
          const eGroups = await Promise.all(
            courseList.map(c => apiRequest(`/api/courses/${encodeURIComponent(c.id)}/exams`).catch(() => ({ data: [] })))
          );
          if (!mounted) return;
          const all = eGroups.flatMap(g => g.data || []);
          setExams(all.sort((a, b) => new Date(a.date) - new Date(b.date)));
          setTargetCourseId(courseList[0].id);
        }
      } catch (err) {
        if (mounted) handleApiError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => { mounted = false; };
  }, [handleApiError]);

  const addExam = async () => {
    if (!examTitle.trim() || !examDate || !targetCourseId) {
      toast.error("Please select a course and enter exam details.");
      return;
    }
    try {
      const description = examDescription.trim();
      const result = await apiRequest(`/api/courses/${targetCourseId}/exams`, {
        method: "POST",
        body: { title: examTitle.trim(), date: examDate, ...(description ? { description } : {}) },
      });
      setExams(prev => [...prev, result.data].sort((a, b) => new Date(a.date) - new Date(b.date)));
      setExamTitle("");
      setExamDate("");
      setExamDescription("");
      toast.success("Exam successfully scheduled!");
    } catch (error) {
      handleApiError(error);
    }
  };

  const deleteExam = async (id) => {
    try {
      await apiRequest(`/api/exams/${id}`, { method: "DELETE" });
      setExams(prev => prev.filter(exam => exam.id !== id));
      toast.success("Exam deleted.");
    } catch (error) {
      handleApiError(error);
    }
  };

  const formatExamDate = (iso) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };

  const [calMonth, setCalMonth] = useState(new Date());

  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInCalMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonthIdx, 1).getDay();
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  const examDaySet = new Set(
    exams.map(ex => {
      const d = new Date(ex.date);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  const filteredExams = exams.filter(ex =>
    !searchQuery ||
    ex.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ex.description && ex.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (courses.find(c => c.id === ex.courseId)?.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  useEffect(() => {
    const focusExamId = location.state?.focusExamId;
    if (!focusExamId || !filteredExams.length) return;

    const targetExam = filteredExams.find(ex => ex.id === focusExamId);
    if (!targetExam) return;

    setHighlightedExamId(targetExam.id);
    if (targetExam.courseId) setTargetCourseId(targetExam.courseId);

    const el = document.getElementById(`exam-card-${targetExam.id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const clearHighlight = setTimeout(() => setHighlightedExamId(""), 3000);
    return () => clearTimeout(clearHighlight);
  }, [filteredExams, location.state]);


  return (
    <div className={`exam-page ${theme}`}>
      <h2 style={{fontSize:'24px',fontWeight:800,marginBottom:'4px',color:'var(--text-main)'}}>Exam Scheduler</h2>
      <p style={{color:'var(--text-muted)',fontSize:'15px',marginBottom:'24px',lineHeight:1.5}}>Manage your assessment timeline and stay ahead of deadlines.</p>

      <div className="exam-container">
        {/* Top: Form */}
        <div className="exam-input-panel">
          <h3 style={{marginTop:0}}>Schedule a New Exam</h3>
          <div className="exam-inputs" style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'16px'}}>
            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
              <label className="qz-label">Course</label>
              <select value={targetCourseId} onChange={e => setTargetCourseId(e.target.value)} className="exam-select">
                <option value="" disabled>Select Course</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
              <label className="qz-label">Title / Topic</label>
              <input placeholder="e.g., Midterm Assessment" value={examTitle} onChange={e => setExamTitle(e.target.value)} />
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
              <label className="qz-label">Date</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={{width:'100%'}} />
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'4px', gridColumn: 'span 2'}}>
              <label className="qz-label">Short Description</label>
              <input placeholder="Key chapters or focus areas..." value={examDescription} onChange={e => setExamDescription(e.target.value)} />
            </div>
            <div style={{display:'flex', alignItems: 'flex-end'}}>
              <button className="qz-generate-btn" onClick={addExam} style={{marginTop:'0', height: '42px'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Exam
              </button>
            </div>
          </div>
        </div>

        {/* Middle: Full-width Calendar */}
        <div className="exam-cal-panel">
          <div className="exam-cal-header">
            <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
              <h3 style={{margin:0}}>Exam Calendar</h3>
              <div style={{background:'var(--accent-soft)', color:'var(--accent)', padding:'4px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:600}}>
                {monthNames[calMonthIdx]} {calYear}
              </div>
            </div>
            <div style={{display:'flex', gap:'8px'}}>
              <button className="exam-cal-nav" onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}>‹</button>
              <button className="exam-cal-nav" onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}>›</button>
            </div>
          </div>
          <div className="exam-cal-grid" style={{gap: '8px'}}>
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="exam-cal-dow" style={{padding: '10px', fontSize: '14px', fontWeight: 700}}>{d}</div>
            ))}
            {Array.from({length: firstDay}).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({length: daysInCalMonth}).map((_, i) => {
              const day = i + 1;
              const today = new Date();
              const isToday = today.getDate() === day && today.getMonth() === calMonthIdx && today.getFullYear() === calYear;
              const hasExam = examDaySet.has(`${calYear}-${calMonthIdx}-${day}`);
              const dayExams = exams.filter(ex => {
                const d = new Date(ex.date);
                return d.getDate() === day && d.getMonth() === calMonthIdx && d.getFullYear() === calYear;
              });
              return (
                <div key={day} className={`exam-cal-cell ${isToday ? 'today' : ''} ${hasExam ? 'has-exam' : ''}`} style={{padding: '12px', border: hasExam ? '2px solid var(--accent)' : '1px solid var(--border)'}} title={dayExams.map(e => e.title).join(', ')}>
                  <div className="cal-day-num" style={{fontSize: '16px', fontWeight: 700}}>{day}</div>
                  <div style={{marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    {dayExams.map(ex => (
                      <div key={ex.id} className="cal-exam-badge" style={{fontSize: '11px', padding: '4px 8px', borderRadius: '4px'}}>
                        {ex.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom: Upcoming List */}
        <div className="exam-list-panel">
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
            <h3 style={{margin:0}}>Upcoming Exams List</h3>
            <span style={{fontSize:'13px', color:'var(--text-muted)'}}>{filteredExams.length} assessments scheduled</span>
          </div>
          {loading ? (
            <p className="ne-empty">Loading schedule...</p>
          ) : filteredExams.length === 0 ? (
            <p className="ne-empty">Your calendar is completely clear. Enjoy your free time!</p>
          ) : (
            <div className="exam-grid" style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(350px, 1fr))', gap:'20px'}}>
              {filteredExams.map((ex, index) => {
                const c = courses.find(course => course.id === ex.courseId);
                const diff = new Date(ex.date).getTime() - Date.now();
                const days = Math.ceil(diff / 86400000);
                const urgency = days < 0 ? "past" : days <= 3 ? "urgent" : days <= 7 ? "soon" : "safe";
                return (
                  <div
                    id={`exam-card-${ex.id}`}
                    key={ex.id}
                    className={`exam-card animated-row urgency-${urgency}`}
                    style={{
                      animationDelay: `${index * 0.05}s`,
                      margin: 0,
                      border: highlightedExamId === ex.id ? "2px solid var(--accent)" : undefined,
                      boxShadow: highlightedExamId === ex.id ? "0 0 0 3px var(--accent-soft)" : undefined,
                    }}
                  >
                    <div className="ec-card-left">
                      <div className="ec-course-badge">{c?.code || c?.title?.substring(0,20) || "Course"}</div>
                      <p className="ec-exam-title" style={{fontSize:'16px'}}>{ex.title}</p>
                      {ex.description && <p className="ec-exam-desc">{ex.description}</p>}
                      <p className="ec-exam-date">{formatExamDate(ex.date)}</p>
                    </div>
                    <div className="ec-card-right">
                      {days >= 0 ? (
                        <div className="ec-days-left">
                          <span className="num">{String(days).padStart(2, '0')}</span>
                          <span className="lbl">DAYS LEFT</span>
                        </div>
                      ) : (
                        <div className="ec-days-left" style={{opacity:.6,fontSize:'12px',fontWeight:700,color:'var(--text-muted)'}}>Past</div>
                      )}
                      <button className="del" onClick={() => deleteExam(ex.id)} title="Remove Exam">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Flashcards = ({ theme, toggleTheme, onAuthError }) => {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [courseFiles, setCourseFiles] = useState([]);
  const [courseNotes, setCourseNotes] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [scores, setScores] = useState({}); // cardIndex -> true/false
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("setup"); // 'setup' | 'study' | 'results'
  const [savedFlashcards, setSavedFlashcards] = useState([]);
  const [viewingSavedFlashcard, setViewingSavedFlashcard] = useState(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const handleApiError = (err) => {
    if (err?.status === 401) {
      clearAuthSession();
      onAuthError();
      return;
    }
    const message = err?.message || "Request failed";
    setError(message);
    toast.error(message);
  };

  useEffect(() => {
    let mounted = true;
    apiRequest("/api/courses/joined")
      .then(res => { if (mounted) setCourses(res.data || []); })
      .catch(err => { if (mounted) handleApiError(err); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSavedFlashcards = async () => {
    try {
      const res = await apiRequest("/api/ai/outputs");
      setSavedFlashcards((res.data || []).filter(o => o.type === "flashcards"));
    } catch {}
  };

  const deleteSavedFlashcard = async (id) => {
    try {
      await apiRequest(`/api/ai/outputs/${id}`, { method: "DELETE" });
      setSavedFlashcards(prev => prev.filter(o => o.id !== id));
      if (viewingSavedFlashcard?.id === id) setViewingSavedFlashcard(null);
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  useEffect(() => { loadSavedFlashcards(); }, []);

  useEffect(() => {
    if (!selectedCourse) { 
      setCourseFiles([]); 
      setCourseNotes([]);
      setSelectedFiles([]); 
      setSelectedNotes([]);
      setShowMaterialModal(false);
      return; 
    }
    let mounted = true;
    
    // Fetch Files
    apiRequest(`/api/files?courseId=${encodeURIComponent(selectedCourse)}`)
      .then(res => { if (mounted) setCourseFiles(res.files || res.data || []); })
      .catch(() => { if (mounted) setCourseFiles([]); });

    // Fetch Notes
    apiRequest(`/api/notes?courseId=${encodeURIComponent(selectedCourse)}`)
      .then(res => { if (mounted) setCourseNotes(res.data || []); })
      .catch(() => { if (mounted) setCourseNotes([]); });

    return () => { mounted = false; };
  }, [selectedCourse]);

  const generateCards = async () => {
    if (!selectedCourse) {
      const message = "Please select a course first.";
      setError(message);
      toast.error(message);
      return;
    }
    setError("");
    setIsLoading(true);
    setCards([]);
    setScores({});
    setCurrentIndex(0);
    setIsFlipped(false);
    setPhase("setup");
    
    const body = {};
    if (selectedFiles.length > 0) body.fileIds = selectedFiles;
    if (selectedNotes.length > 0) body.noteIds = selectedNotes;
    
    if (selectedFiles.length === 0 && selectedNotes.length === 0) {
      body.courseId = selectedCourse;
    }
    try {
      const result = await apiRequest("/api/ai/flashcards", {
        method: "POST",
        body,
      });
      const fetched = result.flashcards || [];
      if (!fetched.length) {
        const message = "No flashcards generated. Make sure the course has notes or files uploaded.";
        setError(message);
        toast.error(message);
      } else {
        setCards(fetched);
        setPhase("study");
        toast.success("Flashcards generated successfully!");
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const flipCard = () => setIsFlipped(f => !f);

  const score = (known) => {
    const newScores = { ...scores, [currentIndex]: known };
    setScores(newScores);
    setIsFlipped(false);
    if (currentIndex + 1 < cards.length) {
      setTimeout(() => setCurrentIndex(i => i + 1), 220);
    } else {
      setTimeout(() => setPhase("results"), 220);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setScores({});
    setIsFlipped(false);
    setPhase("study");
  };

  const reviewUnknowns = () => {
    setCards(learningCards);
    setCurrentIndex(0);
    setScores({});
    setIsFlipped(false);
    setPhase("study");
  };

  const knownCount = Object.values(scores).filter(Boolean).length;
  const total = cards.length;
  const progress = total > 0 ? Math.round(((currentIndex) / total) * 100) : 0;

  const knownCards = cards.filter((_, i) => scores[i] === true);
  const learningCards = cards.filter((_, i) => scores[i] === false);

  return (
    <div className={`upload-page ${theme}`}>
      <div className="upload-card">
        <h2 style={{ margin: 0 }}>Flashcards</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "14px" }}>
          AI-generated flashcards from your course materials. Flip cards and mark what you know!
        </p>

        {/* === SETUP PHASE === */}
        {phase === "setup" && (
          <div className="fc-setup-panel">
            <div className="fc-setup-selectors">
              <div className="fc-setup-field">
                <label className="qz-label">Course</label>
                <select
                  className="qz-select"
                  value={selectedCourse}
                  onChange={e => { setSelectedCourse(e.target.value); setSelectedFiles([]); }}
                >
                  <option value="">Select a course…</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{fixEncoding(c.title)}{c.code ? ` (${fixEncoding(c.code)})` : ""}</option>
                  ))}
                </select>
              </div>
              {selectedCourse && (
                <div className="fc-setup-field">
                  <div className="tool-context-shell" style={{ marginTop: 16 }}>
                    <div className="tool-context-bar">
                      <button type="button" className="cb-material-open-btn" onClick={() => setShowMaterialModal(true)}>Select Materials</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {showMaterialModal && selectedCourse && (
              <div className="cb-modal-overlay" onClick={() => setShowMaterialModal(false)}>
                <div className="cb-modal cb-material-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="cb-material-modal-header">
                    <h3>Select Materials</h3>
                    <button className="cb-context-close" onClick={() => setShowMaterialModal(false)} aria-label="Close material picker">✕</button>
                  </div>

                  <div className="cb-material-modal-body">
                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Files</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setSelectedFiles(courseFiles.map((file) => file.id))} disabled={courseFiles.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setSelectedFiles([])} disabled={selectedFiles.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseFiles.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course files">
                          {courseFiles.map((file, idx) => {
                            const checked = selectedFiles.includes(file.id);
                            return (
                              <motion.label
                                key={file.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setSelectedFiles((prev) => checked ? prev.filter((id) => id !== file.id) : [...prev, file.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(file.fileName || file.originalName || file.name || "Untitled file")}</span>
                                  <span className="cb-material-card-meta">File</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No files in this course yet.</div>
                      )}
                    </div>

                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Notes</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setSelectedNotes(courseNotes.map((note) => note.id))} disabled={courseNotes.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setSelectedNotes([])} disabled={selectedNotes.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseNotes.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course notes">
                          {courseNotes.map((note, idx) => {
                            const checked = selectedNotes.includes(note.id);
                            return (
                              <motion.label
                                key={note.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setSelectedNotes((prev) => checked ? prev.filter((id) => id !== note.id) : [...prev, note.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(note.title || note.noteTitle || "Untitled note")}</span>
                                  <span className="cb-material-card-meta">Note</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No notes in this course yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="cb-modal-actions">
                    <button className="secondary-btn" onClick={() => setShowMaterialModal(false)}>Close</button>
                    <button className="qz-generate-btn" style={{ padding: "10px 16px", width: "auto" }} onClick={() => setShowMaterialModal(false)}>Done</button>
                  </div>
                </div>
              </div>
            )}

            <button
              className="qz-generate-btn"
              onClick={generateCards}
              disabled={isLoading || !selectedCourse}
            >
              {isLoading ? <span className="loading-dots">Generating</span> : "Generate Flashcards"}
            </button>
            {error && <p style={{ color: "#e11d48", marginTop: "12px", fontSize: "14px" }}>{error}</p>}
            {isLoading && (
              <div style={{ marginTop: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                <div className="fc-spinner" />
                <p style={{ marginTop: "12px" }}>Academia AI is creating your flashcards…</p>
              </div>
            )}
          </div>
        )}

        {/* === STUDY PHASE === */}
        {phase === "study" && cards.length > 0 && (
          <div className="fc-study">
            <div style={{ marginBottom: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "var(--text-muted)" }}>
              <span>Card {currentIndex + 1} of {total}</span>
              <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{knownCount} known · {currentIndex - knownCount} still learning</span>
            </div>
            <div className="fc-progress-track">
              <div className="fc-progress-bar" style={{ width: `${progress}%` }} />
            </div>

            <div className="fc-scene" onClick={flipCard}>
              <div className={`fc-card ${isFlipped ? "fc-flipped" : ""}`}>
                <div className="fc-face fc-front">
                  <span className="fc-label">Question</span>
                  <p>{cards[currentIndex]?.front}</p>
                  <span className="fc-hint">Tap to reveal answer</span>
                </div>
                <div className="fc-face fc-back">
                  <span className="fc-label">Answer</span>
                  <p>{cards[currentIndex]?.back}</p>
                  <span className="fc-hint">Tap to flip back</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "20px" }}>
              <button className="fc-btn fc-btn-miss" onClick={() => score(false)}>Still Learning</button>
              <button className="fc-btn fc-btn-know" onClick={() => score(true)}>Know It!</button>
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "12px" }}>
              <button
                className="fc-nav-btn"
                disabled={currentIndex === 0}
                onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentIndex(i => i - 1), 200); }}
              >← Prev</button>
              <button
                className="fc-nav-btn"
                disabled={currentIndex === total - 1}
                onClick={() => { setIsFlipped(false); setTimeout(() => setCurrentIndex(i => i + 1), 200); }}
              >Next →</button>
            </div>
          </div>
        )}

        {/* === RESULTS PHASE === */}
        {phase === "results" && (
          <div className="fc-results">
            <div className="fc-results-circle">
              <span className="fc-results-score">{knownCount}</span>
              <span className="fc-results-total">/ {total}</span>
            </div>
            
            {knownCount === total ? (
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '48px', marginBottom: '10px' }}>🎉</div>
                <h3 style={{ fontSize: "24px", color: 'var(--accent)', marginBottom: "8px" }}>Congratulations!</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>
                  You've mastered every single card in this deck. Excellent work!
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "22px", marginBottom: "8px" }}>
                  {knownCount >= total * 0.8 ? "Great Work!" :
                    knownCount >= total * 0.5 ? "Keep Going!" : "Keep Practicing!"}
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "20px" }}>
                  You knew {knownCount} out of {total} cards.
                </p>
              </>
            )}

            {/* Save flashcards button */}
            <button className="qz-generate-btn" style={{ width: 'auto', padding: '10px 24px', marginBottom: '20px' }} onClick={async () => {
              try {
                const courseName = courses.find(c => c.id === selectedCourse)?.title || "Course";
                const payload = {
                  cards,
                  scores,
                  stats: { knownCount, total }
                };
                await apiRequest("/api/ai/outputs", {
                  method: "POST",
                  body: { 
                    type: "flashcards", 
                    title: `Flashcards - ${fixEncoding(courseName)} (${knownCount}/${total} mastered)`, 
                    content: JSON.stringify(payload)
                  }
                });
                toast.success("Flashcards saved successfully!");
                loadSavedFlashcards();
              } catch { toast.error("Failed to save flashcards"); }
            }}>
              💾 Save Progress
            </button>

            {/* Know It Section */}
            {knownCards.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '12px', color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#15803d', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✓</span>
                  Know It ({knownCards.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {knownCards.map((card, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '2px solid #15803d33', borderRadius: 'var(--radius-md)', padding: '20px', transition: 'box-shadow 0.15s' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#15803d', background: '#15803d15', padding: '3px 8px', borderRadius: '4px' }}>Question</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.5 }}>{card.front}</p>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: '4px' }}>Answer</span>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.6 }}>{card.back}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Still Learning Section */}
            {learningCards.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '12px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ background: '#ef4444', color: '#fff', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>✗</span>
                  Still Learning ({learningCards.length})
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '14px' }}>
                  {learningCards.map((card, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', border: '2px solid #ef444433', borderRadius: 'var(--radius-md)', padding: '20px', transition: 'box-shadow 0.15s' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#ef4444', background: '#ef444415', padding: '3px 8px', borderRadius: '4px' }}>Question</span>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.5 }}>{card.front}</p>
                      </div>
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--accent)', background: 'var(--accent-soft)', padding: '3px 8px', borderRadius: '4px' }}>Answer</span>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '8px', lineHeight: 1.6 }}>{card.back}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap", marginTop: "20px" }}>
              {learningCards.length > 0 ? (
                <button className="qz-generate-btn" style={{ width: "auto", padding: "11px 24px", background: '#ef4444' }} onClick={reviewUnknowns}>
                  Review {learningCards.length} Unknowns
                </button>
              ) : (
                <button className="qz-generate-btn" style={{ width: "auto", padding: "11px 24px" }} onClick={restart}>Restart Full Deck</button>
              )}
              <button
                className="secondary-btn"
                style={{ padding: "11px 20px" }}
                onClick={() => { setPhase("setup"); setCards([]); setScores({}); }}
              >
                Create New Session
              </button>
            </div>
          </div>
        )}

        {/* Saved Flashcards */}
        {phase === "setup" && savedFlashcards.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>🗂️ Saved Flashcards</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {savedFlashcards.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', cursor: 'pointer' }}
                  onClick={() => setViewingSavedFlashcard(s)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: 'var(--text-main)' }}>{fixEncoding(s.title)}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteSavedFlashcard(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '4px' }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {viewingSavedFlashcard && (
          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0 }}>{fixEncoding(viewingSavedFlashcard.title)}</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Saved on {new Date(viewingSavedFlashcard.createdAt).toLocaleDateString()}</p>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="qz-generate-btn" 
                  style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}
                  onClick={() => {
                    try {
                      const data = JSON.parse(viewingSavedFlashcard.content);
                      setCards(data.cards || []);
                      setScores(data.scores || {});
                      setCurrentIndex(0);
                      setIsFlipped(false);
                      setPhase("study");
                      setViewingSavedFlashcard(null);
                      toast.success("Deck loaded! Good luck.");
                    } catch {
                      toast.error("This saved deck is in an old format and cannot be studied.");
                    }
                  }}
                >
                  📖 Study This Deck
                </button>
                <button className="secondary-btn" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setViewingSavedFlashcard(null)}>Close</button>
              </div>
            </div>
            
            <div style={{ background: 'var(--bg-main)', borderRadius: 'var(--radius-lg)', padding: '24px', border: '1px solid var(--border)' }}>
              {(() => {
                try {
                  const data = JSON.parse(viewingSavedFlashcard.content);
                  const sCards = data.cards || [];
                  const sScores = data.scores || {};
                  
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                      {sCards.map((card, i) => {
                        const isKnown = sScores[i];
                        return (
                          <div key={i} style={{ 
                            background: 'var(--bg-card)', 
                            border: `2px solid ${isKnown ? '#15803d33' : '#ef444433'}`, 
                            borderRadius: 'var(--radius-md)', 
                            padding: '20px',
                            position: 'relative'
                          }}>
                            <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '18px' }}>
                              {isKnown ? '✅' : '❌'}
                            </div>
                            <div style={{ marginBottom: '14px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Question</span>
                              <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)', marginTop: '6px', lineHeight: 1.5 }}>{card.front}</p>
                            </div>
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)' }}>Answer</span>
                              <p style={{ fontSize: '14px', color: 'var(--text-main)', marginTop: '6px', lineHeight: 1.6 }}>{card.back}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                } catch {
                  return (
                    <div className="qz-output-body">
                      <MarkdownOutput text={viewingSavedFlashcard.content} />
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Profile & Statistics Page ──────────────────────────────────────────────────
const ProfileStats = ({ theme, toggleTheme, onAuthError }) => {
  const user = getAuthUser();
  const [stats, setStats] = useState({
    courses: 0,
    notes: 0,
    files: 0,
    exams: 0,
    upcomingExams: [],
    upcomingThisWeek: 0,
    aiOutputs: 0,
    timetableEntries: 0,
    weeklyStudyMinutes: 0,
    dayLoadMinutes: [0, 0, 0, 0, 0, 0, 0],
    activityLast7Days: [0, 0, 0, 0, 0, 0, 0],
    coverageByCourse: [],
  });
  const [loading, setLoading] = useState(true);

  const parseMinutes = (value) => {
    if (typeof value !== "string") return null;
    const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const courseRes = await apiRequest("/api/courses/joined");
        const courses = courseRes.data || [];
        if (!courses.length) {
          setStats({
            courses: 0,
            notes: 0,
            files: 0,
            exams: 0,
            upcomingExams: [],
            upcomingThisWeek: 0,
            aiOutputs: 0,
            timetableEntries: 0,
            weeklyStudyMinutes: 0,
            dayLoadMinutes: [0, 0, 0, 0, 0, 0, 0],
            activityLast7Days: [0, 0, 0, 0, 0, 0, 0],
            coverageByCourse: [],
          });
          setLoading(false);
          return;
        }
        const ids = courses.map((c) => c.id);
        const [noteGroups, fileGroups, examGroups, timetableRes, aiOutputsRes] = await Promise.all([
          Promise.all(ids.map((id) => apiRequest(`/api/notes?courseId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })))),
          Promise.all(ids.map((id) => apiRequest(`/api/files?courseId=${encodeURIComponent(id)}`).catch(() => ({ data: [] })))),
          Promise.all(ids.map((id) => apiRequest(`/api/courses/${encodeURIComponent(id)}/exams`).catch(() => ({ data: [] })))),
          apiRequest("/api/timetable").catch(() => ({ data: [] })),
          apiRequest("/api/ai/outputs").catch(() => ({ data: [] })),
        ]);

        const allNotes = noteGroups.flatMap((g) => g.data || []);
        const allFiles = fileGroups.flatMap((g) => g.data || []);
        const allExams = examGroups.flatMap((g) => g.data || []);
        const timetableEntries = timetableRes.data || [];
        const aiOutputs = aiOutputsRes.data || [];
        const upcoming = allExams
          .filter((e) => e.date && new Date(e.date) > new Date())
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        const upcomingThisWeek = upcoming.filter((exam) => {
          const days = Math.ceil((new Date(exam.date).getTime() - Date.now()) / 86400000);
          return days >= 0 && days <= 7;
        }).length;

        const dayLoadMinutes = [0, 0, 0, 0, 0, 0, 0];
        timetableEntries.forEach((entry) => {
          const day = Number(entry.dayOfWeek);
          const start = parseMinutes(entry.startTime);
          const end = parseMinutes(entry.endTime);
          if (!Number.isInteger(day) || day < 0 || day > 6 || start === null || end === null || end <= start) return;
          dayLoadMinutes[day] += end - start;
        });
        const weeklyStudyMinutes = dayLoadMinutes.reduce((sum, val) => sum + val, 0);

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const activityLast7Days = [0, 0, 0, 0, 0, 0, 0];
        [...allNotes, ...allFiles, ...aiOutputs].forEach((item) => {
          if (!item?.createdAt) return;
          const createdDate = new Date(item.createdAt);
          if (Number.isNaN(createdDate.getTime())) return;
          const createdStart = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate()).getTime();
          const dayDiff = Math.floor((todayStart - createdStart) / 86400000);
          if (dayDiff >= 0 && dayDiff < 7) {
            activityLast7Days[6 - dayDiff] += 1;
          }
        });

        const coverageByCourse = courses
          .map((course) => {
            const noteCount = allNotes.filter((note) => note.courseId === course.id).length;
            const fileCount = allFiles.filter((file) => file.courseId === course.id).length;
            const examCount = allExams.filter((exam) => exam.courseId === course.id).length;
            return {
              id: course.id,
              title: fixEncoding(course.title || "Untitled course"),
              total: noteCount + fileCount + examCount,
              noteCount,
              fileCount,
              examCount,
            };
          })
          .sort((a, b) => b.total - a.total);

        setStats({
          courses: courses.length,
          notes: allNotes.length,
          files: allFiles.length,
          exams: allExams.length,
          upcomingExams: upcoming,
          upcomingThisWeek,
          aiOutputs: aiOutputs.length,
          timetableEntries: timetableEntries.length,
          weeklyStudyMinutes,
          dayLoadMinutes,
          activityLast7Days,
          coverageByCourse,
        });
      } catch (err) {
        if (err?.status === 401) {
          clearAuthSession();
          onAuthError();
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [onAuthError]);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const statCards = [
    { icon: "", label: "Courses", value: stats.courses, color: "#6366f1" },
    { icon: "", label: "Notes", value: stats.notes, color: "#f59e0b" },
    { icon: "", label: "Files", value: stats.files, color: "#22c55e" },
    { icon: "️", label: "Exams", value: stats.exams, color: "#ef4444" },
  ];
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const maxDayLoadMinutes = Math.max(...stats.dayLoadMinutes, 1);
  const maxActivityCount = Math.max(...stats.activityLast7Days, 1);
  const weekActivityTotal = stats.activityLast7Days.reduce((sum, count) => sum + count, 0);
  const examPressureLevel = stats.upcomingThisWeek >= 4 ? "High" : stats.upcomingThisWeek >= 2 ? "Medium" : "Low";
  const examPressureClass = stats.upcomingThisWeek >= 4 ? "ps-pressure-high" : stats.upcomingThisWeek >= 2 ? "ps-pressure-medium" : "ps-pressure-low";
  const weeklyHours = (stats.weeklyStudyMinutes / 60).toFixed(1);
  const avgDailyMinutes = Math.round(stats.weeklyStudyMinutes / 7);
  const topCoverage = stats.coverageByCourse.slice(0, 5);
  const maxCoverageTotal = Math.max(...topCoverage.map((c) => c.total), 1);

  return (
    <div className={`upload-page ${theme}`}>
      <div className="upload-card">
        <h2> Profile & Statistics</h2>

        {/* User card */}
        <div className="ps-user-card">
          {loading ? (
            <div className="skeleton skeleton-circle" style={{ width: "72px", height: "72px", flexShrink: 0 }} />
          ) : (
            <div className="ps-avatar">{initials}</div>
          )}
          <div className="ps-user-info" style={{ width: "100%" }}>
            {loading ? (
              <>
                <div className="skeleton skeleton-text" style={{ width: "200px", maxWidth: "80%", marginBottom: "8px" }} />
                <div className="skeleton skeleton-text" style={{ width: "140px", maxWidth: "60%" }} />
              </>
            ) : (
              <>
                <h3 className="ps-user-name">{user?.fullName || "Student"}</h3>
                <p className="ps-user-email">{user?.email || ""}</p>
                <span className="ps-badge">NEU Student</span>
              </>
            )}
          </div>
        </div>

        {/* Stat grid */}
        <div className="ps-stat-grid">
          {statCards.map((s) => (
            <div key={s.label} className="ps-stat-card" style={{ borderTopColor: loading ? "var(--border)" : s.color }}>
              {loading ? (
                <>
                  <div className="skeleton skeleton-square" style={{ marginBottom: "16px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "40px", height: "28px", margin: "0 auto 6px" }} />
                  <div className="skeleton skeleton-text" style={{ width: "60px", height: "14px", margin: "0 auto" }} />
                </>
              ) : (
                <>
                  <span className="ps-stat-icon">{s.icon}</span>
                  <span className="ps-stat-value">{s.value}</span>
                  <span className="ps-stat-label">{s.label}</span>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Study progress */}
        <div className="ps-section">
          <h3 className="ps-section-title"> Study Overview</h3>
          <div className="ps-progress-bars">
            {loading ? (
              <>
                <div className="skeleton skeleton-text" style={{ height: "48px", borderRadius: "12px", marginBottom: "8px" }} />
                <div className="skeleton skeleton-text" style={{ height: "48px", borderRadius: "12px", marginBottom: "8px" }} />
              </>
            ) : (
              <>
                {stats.courses > 0 && (
                  <div className="ps-bar-row">
                    <span className="ps-bar-label">Notes per course</span>
                    <span className="ps-bar-value">{stats.courses > 0 ? (stats.notes / stats.courses).toFixed(1) : 0}</span>
                  </div>
                )}
                <div className="ps-bar-row">
                  <span className="ps-bar-label">Total study materials</span>
                  <span className="ps-bar-value">{stats.notes + stats.files}</span>
                </div>
                <div className="ps-bar-row">
                  <span className="ps-bar-label">Upcoming exams</span>
                  <span className="ps-bar-value">{stats.upcomingExams.length}</span>
                </div>
                <div className="ps-bar-row">
                  <span className="ps-bar-label">AI outputs saved</span>
                  <span className="ps-bar-value">{stats.aiOutputs}</span>
                </div>
                <div className="ps-bar-row">
                  <span className="ps-bar-label">Weekly study hours (timetable)</span>
                  <span className="ps-bar-value">{weeklyHours}h</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!loading && (
          <div className="ps-section">
            <h3 className="ps-section-title"> Learning Analytics</h3>
            <div className="ps-analytics-grid">
              <div className="ps-analytics-card">
                <div className="ps-analytics-card-header">
                  <span className="ps-analytics-title">Exam Pressure</span>
                  <span className={`ps-pressure-badge ${examPressureClass}`}>{examPressureLevel}</span>
                </div>
                <p className="ps-analytics-subtext">
                  {stats.upcomingThisWeek} exam(s) in the next 7 days.
                </p>
                <div className="ps-analytics-kpis">
                  <div>
                    <strong>{stats.upcomingExams.length}</strong>
                    <span>Total upcoming</span>
                  </div>
                  <div>
                    <strong>{stats.timetableEntries}</strong>
                    <span>Planned blocks</span>
                  </div>
                  <div>
                    <strong>{avgDailyMinutes}m</strong>
                    <span>Avg/day planned</span>
                  </div>
                </div>
              </div>

              <div className="ps-analytics-card">
                <div className="ps-analytics-card-header">
                  <span className="ps-analytics-title">Weekly Study Load</span>
                  <span className="ps-analytics-subvalue">{weeklyHours}h</span>
                </div>
                <div className="ps-day-load-list">
                  {dayLabels.map((label, idx) => {
                    const value = stats.dayLoadMinutes[idx];
                    const width = Math.max(6, Math.round((value / maxDayLoadMinutes) * 100));
                    return (
                      <div key={label} className="ps-day-load-row">
                        <span className="ps-day-label">{label}</span>
                        <div className="ps-day-bar-track">
                          <div className="ps-day-bar-fill" style={{ width: `${width}%` }} />
                        </div>
                        <span className="ps-day-value">{Math.round((value / 60) * 10) / 10}h</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ps-analytics-card">
                <div className="ps-analytics-card-header">
                  <span className="ps-analytics-title">Last 7 Days Activity</span>
                  <span className="ps-analytics-subvalue">{weekActivityTotal} items</span>
                </div>
                <div className="ps-activity-bars">
                  {stats.activityLast7Days.map((count, idx) => {
                    const height = Math.max(10, Math.round((count / maxActivityCount) * 100));
                    return (
                      <div key={`day-${idx}`} className="ps-activity-bar-group">
                        <div className="ps-activity-bar-track">
                          <div className="ps-activity-bar-fill" style={{ height: `${height}%` }} />
                        </div>
                        <span className="ps-activity-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="ps-analytics-footnote">Includes notes, files and AI outputs.</p>
              </div>

              <div className="ps-analytics-card">
                <div className="ps-analytics-card-header">
                  <span className="ps-analytics-title">Course Material Coverage</span>
                  <span className="ps-analytics-subvalue">{topCoverage.length} shown</span>
                </div>
                <div className="ps-coverage-list">
                  {topCoverage.length === 0 ? (
                    <p className="ps-analytics-footnote" style={{ marginTop: 8 }}>No materials yet.</p>
                  ) : (
                    topCoverage.map((course) => (
                      <div key={course.id} className="ps-coverage-row">
                        <div className="ps-coverage-head">
                          <span className="ps-coverage-title">{course.title}</span>
                          <span className="ps-coverage-count">{course.total}</span>
                        </div>
                        <div className="ps-day-bar-track">
                          <div
                            className="ps-day-bar-fill ps-coverage-fill"
                            style={{ width: `${Math.max(8, Math.round((course.total / maxCoverageTotal) * 100))}%` }}
                          />
                        </div>
                        <p className="ps-coverage-meta">
                          {course.noteCount} notes | {course.fileCount} files | {course.examCount} exams
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Upcoming exams */}
        {!loading && stats.upcomingExams.length > 0 && (
          <div className="ps-section">
            <h3 className="ps-section-title">️ Upcoming Exams</h3>
            <div className="ps-exam-list">
              {stats.upcomingExams.slice(0, 5).map((ex) => {
                const daysLeft = Math.ceil((new Date(ex.date) - Date.now()) / 86400000);
                const urgency = daysLeft <= 3 ? "ps-urgent" : daysLeft <= 7 ? "ps-warning" : "ps-safe";
                return (
                  <div key={ex.id} className={`ps-exam-item ${urgency}`}>
                    <div>
                      <p className="ps-exam-name">{ex.title}</p>
                      <p className="ps-exam-date">{new Date(ex.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span className="ps-days-badge">{daysLeft}d</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── AI Chatbox Page ─────────────────────────────────────────────────────────────
export const AIChatbox = ({ theme, toggleTheme, onAuthError }) => {
  const toast = useToast();
  const user = getAuthUser();
  const contextKey = React.useMemo(
    () => `academia_ai_ctx_${user?.id || "anon"}`,
    [user?.id]
  );
  const readSavedContext = React.useCallback(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(contextKey) || "{}");
      return {
        courseId: typeof parsed.courseId === "string" ? parsed.courseId : "all",
        fileIds: Array.isArray(parsed.fileIds) ? parsed.fileIds.filter((id) => typeof id === "string") : [],
        noteIds: Array.isArray(parsed.noteIds) ? parsed.noteIds.filter((id) => typeof id === "string") : [],
      };
    } catch {
      return { courseId: "all", fileIds: [], noteIds: [] };
    }
  }, [contextKey]);
  const savedContext = readSavedContext();
  const [courses, setCourses] = useState([]);
  const [courseFiles, setCourseFiles] = useState([]);
  const [courseNotes, setCourseNotes] = useState([]);
  const [targetCourse, setTargetCourse] = useState(savedContext.courseId || "all");
  const [targetFiles, setTargetFiles] = useState(savedContext.fileIds || []);
  const [targetNotes, setTargetNotes] = useState(savedContext.noteIds || []);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [courseMemory, setCourseMemory] = useState(null);
  const messagesEndRef = React.useRef(null);
  const [playbackState, setPlaybackState] = useState({ id: null, status: 'idle', text: '' });

  const stopAudio = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setPlaybackState({ id: null, status: 'idle' });
  };

  const handlePlayPause = (id, text, forceRestart = false) => {
    if (!('speechSynthesis' in window)) {
      return toast.error("Text-to-speech is not supported in this browser.");
    }
    
    if (!forceRestart && playbackState.id === id) {
      if (playbackState.status === 'playing') {
        window.speechSynthesis.pause();
        setPlaybackState(s => ({ ...s, status: 'paused' }));
      } else if (playbackState.status === 'paused') {
        window.speechSynthesis.resume();
        setPlaybackState(s => ({ ...s, status: 'playing' }));
      }
      return;
    }
    
    window.speechSynthesis.cancel();
    
    let textToSpeak = text;
    const speechMatch = text.match(/<speech>([\s\S]*?)<\/speech>/i);
    if (speechMatch) {
      textToSpeak = speechMatch[1];
    }
    
    const cleanText = textToSpeak.replace(/[*_#`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    utterance.lang = 'en-US';
    utterance.rate = 0.95; 
    utterance.pitch = 1.0;

    const speakWithVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const preferred = ["Google US English", "Microsoft Aria Online", "Samantha", "Daniel", "Alex"];
      let selectedVoice = null;
      for (let pref of preferred) {
        selectedVoice = voices.find(v => v.name.includes(pref));
        if (selectedVoice) break;
      }
      if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith('en-'));
      if (selectedVoice) utterance.voice = selectedVoice;
      
      utterance.onstart = () => setPlaybackState({ id, status: 'playing', text });
      utterance.onend = () => setPlaybackState({ id: null, status: 'idle', text: '' });
      utterance.onerror = () => setPlaybackState({ id: null, status: 'idle', text: '' });
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      const onVoicesChanged = () => {
        speakWithVoice();
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    } else {
      speakWithVoice();
    }
  };

  const handleRestart = () => {
    if (!playbackState.id || !playbackState.text) return;
    const { id, text } = playbackState;
    window.speechSynthesis.cancel();
    setTimeout(() => handlePlayPause(id, text, true), 50);
  };

  const renderFloatingTTSWidget = () => {
    if (!playbackState.id) return null;
    const isPlaying = playbackState.status === 'playing';

    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-24 right-6 z-50 flex items-center gap-3 bg-[#1F2023] border border-[#444444] rounded-full p-2 pr-4 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-600/20 text-indigo-400">
            {isPlaying ? (
              <div className="flex gap-1">
                <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-indigo-400 rounded-full" />
                <motion.div animate={{ height: [12, 20, 12] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.2 }} className="w-1 bg-indigo-400 rounded-full" />
                <motion.div animate={{ height: [8, 16, 8] }} transition={{ repeat: Infinity, duration: 0.8, delay: 0.4 }} className="w-1 bg-indigo-400 rounded-full" />
              </div>
            ) : (
              <div className="flex gap-1 opacity-50">
                <div className="w-1 h-2 bg-indigo-400 rounded-full" />
                <div className="w-1 h-3 bg-indigo-400 rounded-full" />
                <div className="w-1 h-2 bg-indigo-400 rounded-full" />
              </div>
            )}
          </div>
          <div className="flex flex-col mr-2">
            <span className="text-xs font-semibold text-white">Audio Player</span>
            <span className="text-[10px] text-gray-400">{isPlaying ? 'Playing...' : 'Paused'}</span>
          </div>
          <div className="flex items-center gap-1 border-l border-[#333333] pl-3">
            <button 
              onClick={() => handlePlayPause(playbackState.id, playbackState.text)} 
              className="p-2 hover:bg-[#333333] rounded-full transition-colors text-white"
              title={isPlaying ? "Pause" : "Resume"}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button 
              onClick={handleRestart} 
              className="p-2 hover:bg-[#333333] rounded-full transition-colors text-white"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button 
              onClick={stopAudio} 
              className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors text-gray-400"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  useEffect(() => {
    return () => stopAudio();
  }, []);

  const chatKey = React.useCallback((cid) => `academia_chat_${user?.id || "anon"}_${cid}`, [user?.id]);
  const saveChat = React.useCallback((cid, msgs) => { try { localStorage.setItem(chatKey(cid), JSON.stringify(msgs)); } catch {} }, [chatKey]);
  const loadChat = React.useCallback((cid) => { try { return JSON.parse(localStorage.getItem(chatKey(cid)) || "[]"); } catch { return []; } }, [chatKey]);
  const hydratedRef = React.useRef(false);

  const handleCourseChange = (cid) => {
    if (targetCourse !== "all" && messages.length > 0) saveChat(targetCourse, messages);
    setTargetCourse(cid);
    setTargetFiles([]);
    setTargetNotes([]);
    setMessages(cid === "all" ? [] : loadChat(cid));
  };




  useEffect(() => {
    if (targetCourse !== "all" && messages.length > 0) saveChat(targetCourse, messages);
  }, [messages, saveChat, targetCourse]);

  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    if (targetCourse !== "all") {
      setMessages(loadChat(targetCourse));
    }
  }, [loadChat, targetCourse]);

  useEffect(() => {
    try {
      localStorage.setItem(
        contextKey,
        JSON.stringify({ courseId: targetCourse, fileIds: targetFiles, noteIds: targetNotes })
      );
    } catch {}
  }, [contextKey, targetCourse, targetFiles, targetNotes]);

  useEffect(() => {
    if (targetCourse === "all") {
      setCourseFiles([]);
      setCourseNotes([]);
      setCourseMemory(null);
      return;
    }
    let mounted = true;
    Promise.all([
      apiRequest(`/api/files?courseId=${encodeURIComponent(targetCourse)}`),
      apiRequest(`/api/notes?courseId=${encodeURIComponent(targetCourse)}`),
      apiRequest(`/api/ai/memory?courseId=${encodeURIComponent(targetCourse)}`).catch(() => ({ memory: null })),
    ])
      .then(([filesRes, notesRes, memoryRes]) => {
        if (!mounted) return;
        setCourseFiles(filesRes.files || filesRes.data || []);
        setCourseNotes(notesRes.data || notesRes.notes || []);
        setCourseMemory(memoryRes.memory || null);
      })
      .catch(() => {
        if (!mounted) return;
        setCourseFiles([]);
        setCourseNotes([]);
        setCourseMemory(null);
      });
    return () => { mounted = false; };
  }, [targetCourse]);

  useEffect(() => {
    if (!courseFiles.length) {
      setTargetFiles([]);
      return;
    }
    const validIds = new Set(courseFiles.map((file) => file.id));
    setTargetFiles((prev) => prev.filter((id) => validIds.has(id)));
  }, [courseFiles]);

  useEffect(() => {
    if (!courseNotes.length) {
      setTargetNotes([]);
      return;
    }
    const validIds = new Set(courseNotes.map((note) => note.id));
    setTargetNotes((prev) => prev.filter((id) => validIds.has(id)));
  }, [courseNotes]);

  const generateSummary = async () => {
    if (targetCourse === "all") return toast.error("Please select a specific course.");
    try {
      setIsTyping(true);
      const payload = { courseId: targetCourse };
      if (targetFiles.length > 0) payload.fileIds = targetFiles;
      if (targetNotes.length > 0) payload.noteIds = targetNotes;
      const result = await apiRequest("/api/ai/summarize", { method: "POST", body: payload });
      setMessages(prev => [...prev, { role: "assistant", content: result.output || result.summary || "AI response was empty.", time: Date.now() }]);
    } catch (error) {
      if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
      toast.error(error?.message || "Failed to generate summary.");
    } finally { setIsTyping(false); }
  };

  const generateStudyPlan = async (duration = 'weekly') => {
    if (targetCourse === "all") return toast.error("Please select a specific course.");
    try {
      setIsTyping(true);
      setMessages(prev => [...prev, { role: "user", content: `Generate a ${duration} study plan`, time: Date.now() }]);
      const payload = { courseId: targetCourse, duration };
      if (targetFiles.length > 0) payload.fileIds = targetFiles;
      if (targetNotes.length > 0) payload.noteIds = targetNotes;
      const result = await apiRequest("/api/ai/study-plan", { method: "POST", body: payload });
      setMessages(prev => [...prev, { role: "assistant", content: result.output || result.studyPlan || "AI response was empty.", time: Date.now() }]);
    } catch (error) {
      if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
      toast.error(error?.message || "Failed to generate study plan.");
    } finally { setIsTyping(false); }
  };

  const generateNotes = async () => {
    if (targetCourse === "all") return toast.error("Please select a specific course.");
    try {
      setIsTyping(true);
      setMessages(prev => [...prev, { role: "user", content: "Generate study notes", time: Date.now() }]);
      const payload = { courseId: targetCourse };
      if (targetFiles.length > 0) payload.fileIds = targetFiles;
      if (targetNotes.length > 0) payload.noteIds = targetNotes;
      const result = await apiRequest("/api/ai/notes", { method: "POST", body: payload });
      setMessages(prev => [...prev, { role: "assistant", content: result.output || result.notes || "AI response was empty.", time: Date.now() }]);
    } catch (error) {
      if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
      toast.error(error?.message || "Failed to generate notes.");
    } finally { setIsTyping(false); }
  };

  const [showStudyPlanModal, setShowStudyPlanModal] = useState(false);
  const [studyPlanDays, setStudyPlanDays] = useState(7);
  const [contextExpanded, setContextExpanded] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiRequest("/api/courses/joined")
      .then(res => { if (mounted) setCourses(res.data || []); })
      .catch(err => { if (mounted && err?.status === 401) { clearAuthSession(); onAuthError(); } });
    return () => { mounted = false; };
  }, [onAuthError]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);
  useEffect(() => {
    if (targetCourse === "all") {
      setShowMaterialModal(false);
    }
  }, [targetCourse]);

  const handleSendPrompt = async (message, attachedFiles) => {
    if (!message.trim() || isTyping || targetCourse === "all") return;
    const userMsg = message.trim();
    setMessages(prev => [...prev, { role: "user", content: userMsg, time: Date.now() }]);
    setIsTyping(true);
    try {
      const payload = { courseId: targetCourse, message: userMsg };
      if (targetFiles.length > 0) payload.fileIds = targetFiles;
      if (targetNotes.length > 0) payload.noteIds = targetNotes;
      const result = await apiRequest("/api/ai/chat", { method: "POST", body: payload });
      setMessages(prev => [...prev, { role: "assistant", content: result.output || "I couldn't generate a response.", time: Date.now() }]);
    } catch (error) {
      if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
      toast.error(error?.message || "Failed to send message.");
      setMessages(prev => [...prev, { role: "assistant", content: "Error: Could not reach Academia AI.", time: Date.now() }]);
    } finally { setIsTyping(false); }
  };

  const downloadAsFile = (content, filename) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const fmtTime = (ts) => ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "";

  return (
    <div className={`chatbox-page ${theme}`}>
      <div className="chatbox-container">
        {/* Study Plan Duration Modal */}
        {showStudyPlanModal && (
          <div className="cb-modal-overlay" onClick={() => setShowStudyPlanModal(false)}>
            <div className="cb-modal" onClick={e => e.stopPropagation()}>
              <h3>Create Study Plan</h3>
              <p>Set how many days you want to study.</p>
              <div className="cb-duration-options">
                <label className="qz-label" style={{ marginBottom: 6 }}>Study Days</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={studyPlanDays}
                    onChange={(e) => setStudyPlanDays(Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1)))}
                    className="qz-select"
                    style={{ width: 120, textAlign: "center" }}
                  />
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>days</span>
                </div>
              </div>
              <div className="cb-modal-actions">
                <button className="secondary-btn" onClick={() => setShowStudyPlanModal(false)}>Cancel</button>
                <button className="qz-generate-btn" style={{padding:'11px 20px',width:'auto'}} onClick={() => { setShowStudyPlanModal(false); generateStudyPlan(String(studyPlanDays)); }}>Generate Plan</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Compact Course Context ── */}
        <div className="cb-context-bar">
          <button
            type="button"
            className={`cb-context-toggle ${contextExpanded ? "is-open" : ""}`}
            onClick={() => setContextExpanded((prev) => !prev)}
          >
            <div className="cb-ctx-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 7.38 16.75L21 21l-2.25-1.62A10 10 0 1 1 12 2z"/><circle cx="12" cy="12" r="3"/></svg>
            </div>
            <span className="cb-ctx-heading">Course Context</span>
            <svg className="cb-context-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
          </button>

          <div className="cb-context-pill">
            {targetCourse === "all"
              ? "No course selected"
              : fixEncoding(courses.find((c) => c.id === targetCourse)?.title || "Selected course")}
          </div>

          {targetCourse !== "all" && (
            <div className="cb-ctx-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
              {`${targetFiles.length + targetNotes.length} selected / ${courseFiles.length + courseNotes.length} materials`}
            </div>
          )}
        </div>

        {contextExpanded && (
          <div className="cb-context-panel-inline">
            <div className="cb-context-inline-row">
              <label className="cb-context-inline-label">Course</label>
              <select className="cb-ctx-inline-select" value={targetCourse} onChange={(e) => handleCourseChange(e.target.value)}>
                <option value="all">Select a course…</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{fixEncoding(c.title)}{c.code ? ` (${fixEncoding(c.code)})` : ''}</option>)}
              </select>
            </div>
            {targetCourse !== "all" && (
              <div className="cb-context-inline-actions">
                <button type="button" className="cb-material-open-btn" onClick={() => setShowMaterialModal(true)}>
                  Select Materials
                </button>
                <button
                  type="button"
                  className="cb-material-open-btn ghost"
                  onClick={() => { setTargetFiles([]); setTargetNotes([]); }}
                  disabled={targetFiles.length + targetNotes.length === 0}
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>
        )}

        {showMaterialModal && targetCourse !== "all" && (
          <div className="cb-modal-overlay" onClick={() => setShowMaterialModal(false)}>
            <div className="cb-modal cb-material-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cb-material-modal-header">
                <h3>Select Materials</h3>
                <button className="cb-context-close" onClick={() => setShowMaterialModal(false)} aria-label="Close material picker">✕</button>
              </div>

              <div className="cb-material-modal-body">
                <div className="cb-material-group">
                  <div className="cb-material-group-header">
                    <span>Files</span>
                    <div className="cb-material-actions">
                      <button
                        type="button"
                        className="cb-material-action-btn"
                        onClick={() => setTargetFiles(courseFiles.map((file) => file.id))}
                        disabled={courseFiles.length === 0}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="cb-material-action-btn"
                        onClick={() => setTargetFiles([])}
                        disabled={targetFiles.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {courseFiles.length > 0 ? (
                    <div className="cb-material-scroll" role="listbox" aria-label="Course files">
                      {courseFiles.map((file, idx) => {
                        const checked = targetFiles.includes(file.id);
                        return (
                          <motion.label
                            key={file.id}
                            className={`cb-material-card ${checked ? "is-selected" : ""}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setTargetFiles((prev) =>
                                  checked ? prev.filter((id) => id !== file.id) : [...prev, file.id]
                                );
                              }}
                            />
                            <div className="cb-material-card-content">
                              <span className="cb-material-card-title">{fixEncoding(file.fileName || file.originalName || file.name || "Untitled file")}</span>
                              <span className="cb-material-card-meta">File</span>
                            </div>
                          </motion.label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="cb-material-empty">No files in this course yet.</div>
                  )}
                </div>

                <div className="cb-material-group">
                  <div className="cb-material-group-header">
                    <span>Notes</span>
                    <div className="cb-material-actions">
                      <button
                        type="button"
                        className="cb-material-action-btn"
                        onClick={() => setTargetNotes(courseNotes.map((note) => note.id))}
                        disabled={courseNotes.length === 0}
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        className="cb-material-action-btn"
                        onClick={() => setTargetNotes([])}
                        disabled={targetNotes.length === 0}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {courseNotes.length > 0 ? (
                    <div className="cb-material-scroll" role="listbox" aria-label="Course notes">
                      {courseNotes.map((note, idx) => {
                        const checked = targetNotes.includes(note.id);
                        return (
                          <motion.label
                            key={note.id}
                            className={`cb-material-card ${checked ? "is-selected" : ""}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                            whileHover={{ y: -2 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setTargetNotes((prev) =>
                                  checked ? prev.filter((id) => id !== note.id) : [...prev, note.id]
                                );
                              }}
                            />
                            <div className="cb-material-card-content">
                              <span className="cb-material-card-title">{fixEncoding(note.title || note.noteTitle || "Untitled note")}</span>
                              <span className="cb-material-card-meta">Note</span>
                            </div>
                          </motion.label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="cb-material-empty">No notes in this course yet.</div>
                  )}
                </div>
              </div>

              <div className="cb-modal-actions">
                <button className="secondary-btn" onClick={() => setShowMaterialModal(false)}>Close</button>
                <button className="qz-generate-btn" style={{ padding: "10px 16px", width: "auto" }} onClick={() => setShowMaterialModal(false)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {contextExpanded && targetCourse !== "all" && courseMemory && (
          <div className="cb-memory-strip">
            <div className="cb-memory-stat">
              <strong>Adaptive Difficulty:</strong> {courseMemory.preferredDifficulty || "medium"}
            </div>
            <div className="cb-memory-stat">
              <strong>Recent Score:</strong>{" "}
              {Array.isArray(courseMemory.recentScores) && courseMemory.recentScores.length
                ? `${courseMemory.recentScores[courseMemory.recentScores.length - 1]}%`
                : "n/a"}
            </div>
            <div className="cb-memory-topics">
              <strong>Weak Topics:</strong>
              <div className="cb-memory-chip-list">
                {Array.isArray(courseMemory.weakTopics) && courseMemory.weakTopics.length ? (
                  courseMemory.weakTopics.slice(0, 6).map((topic) => (
                    <span key={topic} className="cb-memory-chip">{fixEncoding(topic)}</span>
                  ))
                ) : (
                  <span className="cb-memory-empty">No weak topics detected yet.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div className="cb-messages">
          {targetCourse === "all" ? (
            <div className="cb-empty">
              <div className="cb-empty-icon" style={{width:'64px',height:'64px',borderRadius:'50%',background:'var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'16px'}}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
              </div>
              <h3 style={{fontSize:'28px',fontWeight:800,marginBottom:'8px'}}>How can Academia AI assist you?</h3>
              <p style={{maxWidth:'500px',lineHeight:1.6}}>I can help you parse complex lecture notes, draft personalized study plans, or quiz you on your upcoming exams. Open the <strong>Course Context</strong> panel to select a course.</p>
            </div>
          ) : (
            <>
              <div className="cb-msg cb-msg-ai">
                <div className="cb-avatar-ai">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
                </div>
                <div className="cb-msg-content">
                  <div className="cb-msg-bubble-ai cb-greeting">
                    <p><strong>Hello {user?.fullName?.split(" ")[0] || "Student"}!</strong></p>
                    <p style={{marginTop:'8px'}}>I have loaded the context for <strong>{courses.find(c => c.id === targetCourse)?.title || "selected course"}</strong>. How would you like to proceed today?</p>
                  </div>
                  <div className="cb-msg-meta">ACADEMIA AI • NOW</div>
                </div>
              </div>

              {messages.map((msg, idx) => (
                msg.role === "assistant" ? (
                  <div key={idx} className="cb-msg cb-msg-ai">
                    <div className="cb-avatar-ai">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/></svg>
                    </div>
                    <div className="cb-msg-content">
                      <div className="cb-msg-bubble-ai"><MarkdownOutput text={msg.content} /></div>
                      <div className="cb-msg-meta-row">
                        <div className="cb-msg-meta">ACADEMIA AI • {msg.time ? fmtTime(msg.time) : "NOW"}</div>
                        <div style={{display:'flex',gap:'8px'}}>
                          <button className="cb-download-btn" onClick={() => downloadAsFile(msg.content, `academia_ai_${new Date(msg.time).toISOString().slice(0,10)}.md`)}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            Download
                          </button>
                          <button className="cb-download-btn" onClick={() => handlePlayPause(`msg-${idx}`, msg.content)}>
                            <Play style={{width:'12px',height:'12px'}} /> Listen
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={idx} className="cb-msg cb-msg-user">
                    <div className="cb-avatar-user">{user?.fullName?.charAt(0)?.toUpperCase() || "A"}</div>
                    <div className="cb-msg-content">
                      <div className="cb-msg-bubble-user">{msg.content}</div>
                      <div className="cb-msg-meta cb-meta-right">YOU • {msg.time ? fmtTime(msg.time) : "NOW"}</div>
                    </div>
                  </div>
                )
              ))}
            </>
          )}
          {isTyping && (
            <div className="cb-msg cb-msg-ai">
              <div className="cb-avatar-ai">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              </div>
              <div className="cb-msg-content">
                <div className="cb-msg-bubble-ai cb-typing"><div className="dot"></div><div className="dot"></div><div className="dot"></div></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Bar */}
        <div className="cb-bottom-bar">
          <div className="cb-action-chips">
            <button className="cb-chip" onClick={generateSummary} disabled={isTyping || targetCourse === "all"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              Summarize
            </button>
            <button className="cb-chip" onClick={generateNotes} disabled={isTyping || targetCourse === "all"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
              Generate Notes
            </button>
            <button className="cb-chip" onClick={() => setShowStudyPlanModal(true)} disabled={isTyping || targetCourse === "all"}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Study Plan
            </button>
          </div>
          <div className="cb-prompt-wrap">
            {targetCourse === "all" ? (
              <div className="cb-disabled-input">Open Course Context to select a course and start chatting.</div>
            ) : (
              <PromptInputBox
                onSend={handleSendPrompt}
                isLoading={isTyping}
                placeholder="Ask anything about your courses..."
                storageKey={`academia_ai_prompt_${user?.id || "anon"}_${targetCourse}`}
              />
            )}
          </div>
          <p style={{fontSize:'11px',color:'var(--text-muted)',marginTop:'8px',textAlign:'center'}}>Academia AI can make mistakes. Verify important information.</p>
        </div>
      </div>
      {renderFloatingTTSWidget()}
    </div>
  );
};


const ClassSchedule = ({ theme, toggleTheme, onAuthError }) => {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("08:30");
  const [endTime, setEndTime] = useState("10:30");

  const handleApiError = (err) => {
    if (err?.status === 401) { clearAuthSession(); onAuthError(); return; }
    toast.error(err?.message || "Request failed");
  };

  const loadSchedule = async () => {
    try {
      const result = await apiRequest("/api/timetable");
      setEntries(result.data || []);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addEntry = async () => {
    if (!title.trim() || !startTime || !endTime) {
      toast.error("Please fill in course title and time slots.");
      return;
    }
    if (startTime >= endTime) {
      toast.error("Start time must be before end time.");
      return;
    }

    // Time conflict check
    const dayNum = parseInt(dayOfWeek);
    const conflict = entries.find(e => {
      if (e.dayOfWeek !== dayNum) return false;
      // Check if times overlap
      return startTime < e.endTime && endTime > e.startTime;
    });
    if (conflict) {
      toast.error(`Time conflict! "${conflict.title}" is already scheduled at ${conflict.startTime} - ${conflict.endTime} on this day.`);
      return;
    }

    try {
      const result = await apiRequest("/api/timetable", {
        method: "POST",
        body: { title: title.trim(), dayOfWeek: dayNum, startTime, endTime, color: '#3B82F6' }
      });
      setEntries(prev => [...prev, result.data]);
      setShowForm(false);
      setTitle("");
      toast.success("Schedule entry added!");
    } catch (err) {
      handleApiError(err);
    }
  };

  const deleteEntry = async (id) => {
    try {
      await apiRequest(`/api/timetable/${id}`, { method: "DELETE" });
      setEntries(prev => prev.filter(e => e.id !== id));
      toast.success("Schedule entry deleted.");
    } catch (err) {
      handleApiError(err);
    }
  };



  const hours = ["08:30", "09:30", "10:30", "11:30", "12:30", "13:30", "14:30", "15:30", "16:30"];
  const START_HOUR = 8.5; // 08:30

  const parseTimeToDecimal = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h + (m / 60);
  };



  // Calculate total weekly hours
  const totalWeeklyHours = entries.reduce((sum, e) => {
    const s = parseTimeToDecimal(e.startTime);
    const ed = parseTimeToDecimal(e.endTime);
    return sum + (ed - s);
  }, 0);

  const dayHeaders = ["MON", "TUE", "WED", "THU", "FRI"];

  return (
    <div className={`mockup-tt-page ${theme}`}>
      <div className="mtt-container">
        {/* Header matching the mockup */}
        <div className="mtt-header">
          <div className="mtt-titles">
            <span className="mtt-tag">ACADEMIC CALENDAR</span>
            <h1>Weekly Schedule</h1>
            <p style={{color:'var(--text-muted)',fontSize:'15px',maxWidth:'600px',lineHeight:1.5,margin:0}}>
              Optimize your academic flow. Manage lectures, research sessions, and seminars with AI-driven time-blocking.
            </p>
          </div>
          <div className="mtt-controls">
            <button className="qz-generate-btn" style={{width:'auto',padding:'10px 20px',display:'flex',alignItems:'center',gap:'8px'}} onClick={() => setShowForm(!showForm)}>
              {showForm ? "Cancel" : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                  Add Class
                </>
              )}
            </button>
          </div>
        </div>

        {showForm && (
          <div className="mtt-input-panel">
            <div className="exam-inputs">
              <input placeholder="Class Name" value={title} onChange={e => setTitle(e.target.value)} />
              <select value={dayOfWeek} onChange={e => setDayOfWeek(e.target.value)} className="exam-select">
                {dayHeaders.map((d, i) => <option key={i} value={i+1}>{d}</option>)}
              </select>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
              <button className="qz-generate-btn" style={{width:'auto',padding:'10px 20px'}} onClick={addEntry}>Save</button>
            </div>
          </div>
        )}

        <div className="mtt-board">
          {loading ? (
            <p style={{padding: '40px', color: 'var(--text-muted)'}}>Loading schedule...</p>
          ) : (
            <div className="mtt-grid-container">
              {/* Header Corner */}
              <div className="mtt-grid-header-corner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>

              {/* Day Headers */}
              {dayHeaders.map((d, i) => (
                <div key={d} className="mtt-grid-header-cell" style={{ gridColumn: i + 2, gridRow: 1 }}>
                  <span className="mtt-dh-text">{d}</span>
                </div>
              ))}

              {/* Grid Content */}
              {hours.map((h, rowIdx) => (
                <React.Fragment key={h}>
                  {/* Time Label */}
                  <div className="mtt-grid-time-label" style={{ gridColumn: 1, gridRow: rowIdx + 2 }}>
                    {h}
                  </div>
                  {/* Background Cells */}
                  {dayHeaders.map((_, colIdx) => (
                    <div key={`${h}-${colIdx}`} className="mtt-grid-cell" style={{ gridColumn: colIdx + 2, gridRow: rowIdx + 2 }}></div>
                  ))}
                </React.Fragment>
              ))}

              {/* Course Blocks */}
              {entries.map(entry => {
                const startRow = Math.round(2 + (parseTimeToDecimal(entry.startTime) - START_HOUR));
                const endRow = Math.round(2 + (parseTimeToDecimal(entry.endTime) - START_HOUR));
                const rowSpan = Math.max(1, endRow - startRow);
                
                return (
                  <div key={entry.id} className="mtt-event-block-grid" style={{ 
                    gridColumn: entry.dayOfWeek + 1, 
                    gridRow: `${startRow} / span ${rowSpan}` 
                  }}>
                    <span className="mtt-event-tag">COURSE</span>
                    <h4 className="mtt-event-title">{entry.title}</h4>
                    <p className="mtt-event-meta">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {entry.startTime} - {entry.endTime}
                    </p>
                    <button className="del-btn" onClick={() => deleteEntry(entry.id)}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'16px',marginTop:'24px'}}>
          <div style={{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',padding:'20px 24px',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'16px'}}>
            <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'var(--accent-soft)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--accent)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div>
              <p style={{fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',margin:0}}>Total Hours</p>
              <p style={{fontSize:'22px',fontWeight:800,color:'var(--text-main)',margin:0,fontFamily:'var(--font-heading)'}}>{totalWeeklyHours.toFixed(1)} hrs/week</p>
            </div>
          </div>
          <div style={{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',padding:'20px 24px',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'16px'}}>
            <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'rgba(239,68,68,0.1)',display:'flex',alignItems:'center',justifyContent:'center',color:'#ef4444'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <p style={{fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',margin:0}}>Classes</p>
              <p style={{fontSize:'22px',fontWeight:800,color:'var(--text-main)',margin:0,fontFamily:'var(--font-heading)'}}>{entries.length} Total</p>
            </div>
          </div>
          <div style={{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',padding:'20px 24px',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:'16px'}}>
            <div style={{width:'40px',height:'40px',borderRadius:'50%',background:'rgba(16,185,129,0.1)',display:'flex',alignItems:'center',justifyContent:'center',color:'#10b981'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <p style={{fontSize:'12px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--text-muted)',margin:0}}>AI Optimization</p>
              <p style={{fontSize:'22px',fontWeight:800,color:'var(--text-main)',margin:0,fontFamily:'var(--font-heading)'}}>Active</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

const StudyPlanPage = ({ theme, onAuthError }) => {
  const toast = useToast();
  const [courses, setCourses] = useState([]);
  const [courseFiles, setCourseFiles] = useState([]);
  const [courseNotes, setCourseNotes] = useState([]);
  const [targetCourse, setTargetCourse] = useState("all");
  const [targetFiles, setTargetFiles] = useState([]);
  const [targetNotes, setTargetNotes] = useState([]);
  const [customDays, setCustomDays] = useState(3);
  const [isGenerating, setIsGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [savedOutputs, setSavedOutputs] = useState([]);
  const [viewingSaved, setViewingSaved] = useState(null);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const handleApiError = (error) => {
    if (error?.status === 401) { clearAuthSession(); onAuthError(); return; }
    const message = error?.message || "Study plan generation failed.";
    setOutput(message);
    toast.error(message);
  };

  useEffect(() => {
    let mounted = true;
    apiRequest("/api/courses/joined")
      .then(res => { if (mounted) setCourses(res.data || []); })
      .catch(err => { if (mounted) handleApiError(err); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targetCourse === "all") { 
      setCourseFiles([]); 
      setCourseNotes([]);
      setTargetFiles([]); 
      setTargetNotes([]);
      setShowMaterialModal(false);
      return; 
    }
    let mounted = true;
    
    // Fetch Files
    apiRequest(`/api/files?courseId=${encodeURIComponent(targetCourse)}`)
      .then(res => { if (mounted) setCourseFiles(res.files || res.data || []); })
      .catch(() => { if (mounted) setCourseFiles([]); });

    // Fetch Notes
    apiRequest(`/api/notes?courseId=${encodeURIComponent(targetCourse)}`)
      .then(res => { if (mounted) setCourseNotes(res.data || []); })
      .catch(() => { if (mounted) setCourseNotes([]); });

    return () => { mounted = false; };
  }, [targetCourse]);

  const generatePlan = async () => {
    const payload = { duration: customDays };
    if (targetFiles.length > 0) payload.fileIds = targetFiles;
    if (targetNotes.length > 0) payload.noteIds = targetNotes;
    
    if (targetFiles.length === 0 && targetNotes.length === 0 && targetCourse !== "all") {
      payload.courseId = targetCourse;
    }
    try {
      setIsGenerating(true);
      setViewingSaved(null);
      setOutput("Academia AI is generating your study plan...");
      const result = await apiRequest("/api/ai/study-plan", { method: "POST", body: payload });
      const plan = result.output || result.studyPlan || "AI response was empty.";
      setOutput(plan);
      toast.success("Study plan generated!");
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const saveOutput = async () => {
    if (!output || isGenerating) return;
    try {
      const courseName = courses.find(c => c.id === targetCourse)?.title || "All Courses";
      await apiRequest("/api/ai/outputs", {
        method: "POST",
        body: { type: "study_plan", title: `Study Plan - ${fixEncoding(courseName)} (${customDays} days)`, content: output, courseId: targetCourse !== "all" ? targetCourse : undefined }
      });
      toast.success("Study plan saved!");
      loadSavedOutputs();
    } catch { toast.error("Failed to save"); }
  };

  const loadSavedOutputs = async () => {
    try {
      const res = await apiRequest("/api/ai/outputs");
      setSavedOutputs((res.data || []).filter(o => o.type === "study_plan"));
    } catch {}
  };

  const deleteSavedOutput = async (id) => {
    try {
      await apiRequest(`/api/ai/outputs/${id}`, { method: "DELETE" });
      setSavedOutputs(prev => prev.filter(o => o.id !== id));
      if (viewingSaved?.id === id) setViewingSaved(null);
      toast.success("Deleted");
    } catch { toast.error("Failed to delete"); }
  };

  useEffect(() => { loadSavedOutputs(); }, []);

  return (
    <div className={`upload-page ${theme}`}>
      <div className="upload-card">
        <h2 style={{ margin: 0 }}>AI Study Plan</h2>
        <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "15px", lineHeight: 1.5 }}>
          Generate a personalized AI study plan from your course materials. Choose a subject and timeframe to get an optimized schedule.
        </p>

        <div className="qz-grid">
          <div className="qz-settings">
            <h3>Plan Settings</h3>

            <label className="qz-label">Course</label>
            <select className="qz-select" value={targetCourse} onChange={(e) => { setTargetCourse(e.target.value); setTargetFiles([]); setTargetNotes([]); }}>
              <option value="all">All my courses</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}{c.code ? ` (${c.code})` : ""}</option>
              ))}
            </select>

            {targetCourse !== "all" && (
              <div className="tool-context-shell">
                <div className="tool-context-bar">
                  <button type="button" className="cb-material-open-btn" onClick={() => setShowMaterialModal(true)}>Select Materials</button>
                </div>
              </div>
            )}

            {showMaterialModal && targetCourse !== "all" && (
              <div className="cb-modal-overlay" onClick={() => setShowMaterialModal(false)}>
                <div className="cb-modal cb-material-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="cb-material-modal-header">
                    <h3>Select Materials</h3>
                    <button className="cb-context-close" onClick={() => setShowMaterialModal(false)} aria-label="Close material picker">✕</button>
                  </div>

                  <div className="cb-material-modal-body">
                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Files</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetFiles(courseFiles.map((file) => file.id))} disabled={courseFiles.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetFiles([])} disabled={targetFiles.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseFiles.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course files">
                          {courseFiles.map((file, idx) => {
                            const checked = targetFiles.includes(file.id);
                            return (
                              <motion.label
                                key={file.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTargetFiles((prev) => checked ? prev.filter((id) => id !== file.id) : [...prev, file.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(file.fileName || file.originalName || file.name || "Untitled file")}</span>
                                  <span className="cb-material-card-meta">File</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No files in this course yet.</div>
                      )}
                    </div>

                    <div className="cb-material-group">
                      <div className="cb-material-group-header">
                        <span>Notes</span>
                        <div className="cb-material-actions">
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetNotes(courseNotes.map((note) => note.id))} disabled={courseNotes.length === 0}>Select all</button>
                          <button type="button" className="cb-material-action-btn" onClick={() => setTargetNotes([])} disabled={targetNotes.length === 0}>Clear</button>
                        </div>
                      </div>
                      {courseNotes.length > 0 ? (
                        <div className="cb-material-scroll" role="listbox" aria-label="Course notes">
                          {courseNotes.map((note, idx) => {
                            const checked = targetNotes.includes(note.id);
                            return (
                              <motion.label
                                key={note.id}
                                className={`cb-material-card ${checked ? "is-selected" : ""}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.25) }}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => setTargetNotes((prev) => checked ? prev.filter((id) => id !== note.id) : [...prev, note.id])}
                                />
                                <div className="cb-material-card-content">
                                  <span className="cb-material-card-title">{fixEncoding(note.title || note.noteTitle || "Untitled note")}</span>
                                  <span className="cb-material-card-meta">Note</span>
                                </div>
                              </motion.label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="cb-material-empty">No notes in this course yet.</div>
                      )}
                    </div>
                  </div>

                  <div className="cb-modal-actions">
                    <button className="secondary-btn" onClick={() => setShowMaterialModal(false)}>Close</button>
                    <button className="qz-generate-btn" style={{ padding: "10px 16px", width: "auto" }} onClick={() => setShowMaterialModal(false)}>Done</button>
                  </div>
                </div>
              </div>
            )}

            <label className="qz-label">How many days do you want to study?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="number"
                min="1"
                max="90"
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, Math.min(90, parseInt(e.target.value) || 1)))}
                className="qz-select"
                style={{ width: '100px', textAlign: 'center' }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>days</span>
            </div>

            <button className="qz-generate-btn" onClick={generatePlan} disabled={isGenerating}>
              {isGenerating ? <span className="loading-dots">Generating</span> : "Generate Study Plan"}
            </button>
          </div>

          <div className="qz-output">
            <div className="qz-output-header">
              <h3>{viewingSaved ? viewingSaved.title : "Study Plan"}</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {(output && !isGenerating && !viewingSaved) && (
                  <button className="qz-generate-btn" style={{ padding: '8px 16px', width: 'auto', fontSize: '12px' }} onClick={saveOutput}>
                    💾 Save
                  </button>
                )}
              </div>
              {viewingSaved && (
                <button className="qz-generate-btn" style={{ padding: '8px 16px', width: 'auto', fontSize: '12px', background: 'var(--text-muted)' }} onClick={() => setViewingSaved(null)}>
                  ✕ Close
                </button>
              )}
            </div>
            <div className="qz-output-body">
              {(viewingSaved ? viewingSaved.content : output) ? (
                <MarkdownOutput text={viewingSaved ? viewingSaved.content : output} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px", color: "var(--text-muted)", textAlign: "center" }}>
                  <p style={{ fontWeight: 600, fontSize: "16px", marginBottom: "8px", color: "var(--text-main)" }}>Ready to Plan</p>
                  <p style={{ fontSize: "14px", maxWidth: "300px" }}>Select a course and enter the number of days, then generate your personalized AI study plan.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Saved Outputs */}
        {savedOutputs.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px' }}>📋 Saved Study Plans</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {savedOutputs.map(s => (
                <div key={s.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                  onClick={() => setViewingSaved(s)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '14px', margin: 0, color: 'var(--text-main)' }}>{fixEncoding(s.title)}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); deleteSavedOutput(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '14px', padding: '4px' }}>✕</button>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                    {s.content.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const NAV_ICONS = {
  welcome: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  schedule: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>,
  exams: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  chat: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 0 1 7.38 16.75L21 21l-2.25-1.62A10 10 0 1 1 12 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>,
  "study-plan": <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  quiz: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  flashcards: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M7 8h10M7 12h6"/></svg>,
  profile: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

const Sidebar = ({ isOpen, onClose, onLogout, isCollapsed, onToggleCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const navItems = [
    { id: "welcome", path: "/", label: "Dashboard" },
    { id: "schedule", path: "/schedule", label: "Timetable" },
    { id: "upload", path: "/upload", label: "My Classes" },
    { id: "exams", path: "/exams", label: "Exam Sched." },
    { id: "chat", path: "/chat", label: "AI Assistant" },
    { id: "study-plan", path: "/study-plan", label: "Study Plan" },
    { id: "quiz", path: "/quiz", label: "Generate Quiz" },
    { id: "flashcards", path: "/flashcards", label: "Flashcards" },
    { id: "profile", path: "/profile", label: "Profile" },
  ];

  return (
    <>
      <aside className={`sidebar ${isOpen ? "open" : ""} ${isCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-brand">
          <span className="sidebar-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </span>
          {!isCollapsed && (
            <div>
              <h2 className="sidebar-title">Academia</h2>
              <span className="sidebar-subtitle">Exam Preparation</span>
            </div>
          )}
        </div>
        <button className="sidebar-collapse-btn" onClick={onToggleCollapse} title={isCollapsed ? "Expand" : "Collapse"}>
          {isCollapsed ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          )}
        </button>
        <nav className="sidebar-nav">
        {!isCollapsed && <span className="sidebar-nav-label">NAVIGATION</span>}
        {navItems.map(item => {
          const isActive = location.pathname === item.path || (location.pathname === "" && item.path === "/");
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? "active" : ""}`}
              onClick={() => handleNavigate(item.path)}
              title={isCollapsed ? item.label : ""}
            >
              <span className="sidebar-nav-icon">{NAV_ICONS[item.id]}</span>
              {!isCollapsed && <span className="sidebar-nav-text">{item.label}</span>}
              {isActive && !isCollapsed && <span className="sidebar-active-dot" />}
            </button>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={onLogout} title={isCollapsed ? "Logout" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          {!isCollapsed && "Logout"}
        </button>
      </div>
    </aside>
      {isOpen && <div className="sidebar-mobile-overlay" onClick={onClose} />}
    </>
  );
};

function MainApp() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getAuthToken());
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("academia_theme");
      return savedTheme === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("academia_theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = (event) => {
    event?.preventDefault?.();
    setTheme(prev => (prev === "dark" ? "light" : "dark"));
  };

  const handleLogout = () => {
    clearAuthSession();
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className={`app ${theme}`}>
        <ToastProvider>
          <AuthPage onSuccess={() => setIsAuthenticated(true)} theme={theme} toggleTheme={toggleTheme} />
        </ToastProvider>
      </div>
    );
  }

  const GlobalSearchDropdown = ({ query, onNavigate }) => {
    const navigate = useNavigate();
    const [results, setResults] = useState({ courses: [], files: [], exams: [] });
    const [loading, setLoading] = useState(false);
    const goTo = (path, state = undefined) => {
      navigate(path, state ? { state } : undefined);
      onNavigate();
    };

    useEffect(() => {
      if (query.trim().length < 2) return;
      let mounted = true;
      setLoading(true);

      Promise.all([
        apiRequest("/api/courses/joined").catch(() => ({ data: [] })),
        apiRequest("/api/files").catch(() => ({ data: [] })),
        apiRequest("/api/exams").catch(() => ({ data: [] }))
      ]).then(([cRes, fRes, eRes]) => {
        if (!mounted) return;
        const q = query.toLowerCase();
        
        const cMatches = (cRes.data || []).filter(c => c.title.toLowerCase().includes(q));
        const fMatches = (fRes.data || []).filter(f => (f.fileName || f.name || "").toLowerCase().includes(q));
        const eMatches = (eRes.data || []).filter(e => e.title.toLowerCase().includes(q) || (e.description && e.description.toLowerCase().includes(q)));
        
        setResults({ courses: cMatches, files: fMatches, exams: eMatches });
        setLoading(false);
      });

      return () => { mounted = false; };
    }, [query]);

    if (query.trim().length < 2) return null;

    const totalResults = results.courses.length + results.files.length + results.exams.length;

    return (
      <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: '100%', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card-hover)', zIndex: 1000, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold', fontSize: '13px', color: 'var(--text-muted)' }}>
          {loading ? 'Searching...' : `Found ${totalResults} results for "${query}"`}
        </div>
        {!loading && totalResults === 0 && (
          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No matches found</div>
        )}
        {!loading && totalResults > 0 && (
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {results.courses.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px', background: 'var(--bg-main)', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>COURSES</div>
                {results.courses.map(c => (
                  <div key={c.id} onClick={() => goTo("/upload", { courseId: c.id })} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', color: 'var(--text-main)' }}>
                    📘 {fixEncoding(c.title)}
                  </div>
                ))}
              </div>
            )}
            {results.files.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px', background: 'var(--bg-main)', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>FILES</div>
                {results.files.map(f => (
                  <div key={f.id} onClick={() => goTo("/upload", { courseId: f.courseId })} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', color: 'var(--text-main)' }}>
                    📄 {fixEncoding(f.fileName || f.name)}
                  </div>
                ))}
              </div>
            )}
            {results.exams.length > 0 && (
              <div>
                <div style={{ padding: '8px 16px', background: 'var(--bg-main)', fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)' }}>EXAMS</div>
                {results.exams.map(e => (
                  <div key={e.id} onClick={() => goTo("/exams", { focusExamId: e.id })} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', color: 'var(--text-main)' }}>
                    📅 {fixEncoding(e.title)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // A small wrapper to handle auth-errors from within routes and redirect back
  const AppContent = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [showNotifications, setShowNotifications] = useState(false);
    const [notifications, setNotifications] = useState([]);

    useEffect(() => {
      let mounted = true;
      apiRequest("/api/exams")
        .then(res => {
          if (!mounted) return;
          const examsData = res.data || [];
          const now = new Date();
          const soonExams = examsData.filter(e => {
            const d = new Date(e.date);
            const diffDays = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 5;
          });
          const notifs = soonExams.map(e => {
            const d = new Date(e.date);
            const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const text = daysLeft === 0 
              ? `🚨 EXAM TODAY: '${e.title}' is scheduled for today!` 
              : `📅 Exam Reminder: '${e.title}' is in ${daysLeft} days.`;
            return {
              id: `exam-${e.id}`,
              text,
              time: daysLeft === 0 ? "URGENT" : `${daysLeft}d left`,
              link: "/exams"
            };
          });
          setNotifications(notifs);
        })
        .catch(() => {});
      return () => { mounted = false; };
    }, [location.pathname]);

    const handleAuthError = () => {
      handleLogout();
      navigate("/");
    };

    return (
      <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          onLogout={handleAuthError}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />
        <main className="app-content">
          <div className="top-bar">
            <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>

            <div className="top-bar-search" style={{ position: 'relative' }}>
              <div className="topbar-search-inner">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="topbar-search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search courses, files, exams..."
                  className="topbar-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <GlobalSearchDropdown query={searchQuery} onNavigate={() => setSearchQuery("")} />
            </div>

            <div className="top-bar-right">
              <button type="button" onClick={toggleTheme} className="topbar-icon-btn" title="Toggle Theme">
                {theme === 'dark' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                )}
              </button>
              <div style={{ position: 'relative' }}>
                <button className="topbar-icon-btn topbar-notif-btn" title="Notifications" onClick={() => setShowNotifications(s => !s)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                  {notifications.length > 0 && <span className="topbar-notif-dot" />}
                </button>
                {showNotifications && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', width: '300px', boxShadow: 'var(--shadow-card)', zIndex: 1000 }}>
                    <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', fontWeight: 'bold' }}>Notifications</div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                      {notifications.length === 0 && (
                        <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>No new notifications</div>
                      )}
                      {notifications.map(n => (
                        <div key={n.id} onClick={() => { navigate(n.link); setShowNotifications(false); }} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontSize: '14px', cursor: 'pointer' }} className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <p style={{ margin: 0, color: 'var(--text-main)' }}>{n.text}</p>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>{n.time}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="topbar-user">
                <div className="topbar-user-info">
                  <div className="topbar-user-name">{getAuthUser()?.fullName?.split(" ")[0] || "Student"}</div>
                  <div className="topbar-user-role">Student</div>
                </div>
                <div className="topbar-avatar">
                  {(getAuthUser()?.fullName?.[0] || "S").toUpperCase()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="app-page-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              style={{ height: '100%' }}
            >
            <Routes location={location}>
              <Route path="/" element={<WelcomeAI theme={theme} toggleTheme={toggleTheme} onLogout={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/schedule" element={<ClassSchedule theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/upload" element={<UploadMaterials theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/exams" element={<ExamScheduler theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/quiz" element={<QuizPage theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/flashcards" element={<Flashcards theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/profile" element={<ProfileStats theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/chat" element={<AIChatbox theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="/study-plan" element={<StudyPlanPage theme={theme} toggleTheme={toggleTheme} onAuthError={handleAuthError} searchQuery={searchQuery} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </motion.div>
          </AnimatePresence>
          </div>
        </main>
      </div>
    );
  };

  return (
    <BrowserRouter>
      <div className={`app ${theme}`}>
        <ToastProvider>
          <Routes>
            <Route path="/*" element={<AppContent />} />
          </Routes>
        </ToastProvider>
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  return <MainApp />;
}
