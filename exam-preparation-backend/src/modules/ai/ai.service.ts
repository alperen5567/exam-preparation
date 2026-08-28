import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import AdmZip from "adm-zip";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { prisma, Prisma } from "../../db/client";
import { AuthUser } from "../auth/auth.middleware";
import { HttpError, NotFoundError } from "../../utils/httpErrors";
import { courseService } from "../courses/course.service";

/* =========================
   TYPES
========================= */

type AiAction = "SUMMARY" | "NOTES" | "QUIZ" | "CHAT" | "QUIZ_CHECK" | "FLASHCARDS" | "STUDY_PLAN";

type FileWithCourse = Prisma.FileGetPayload<{
  include: { course: { select: { title: true } } };
}>;

type FileForText = Pick<
  FileWithCourse,
  "id" | "fileName" | "mimeType" | "storagePath"
>;

type AiOutput = {
  output: string;
  fileId?: string;
  courseId?: string;
  source: "file" | "library" | "course";
  quizId?: string;
};

type QuizAnswer = {
  index: number;
  correctOption: string;
  explanation?: string;
};

type QuizRecord = {
  id: string;
  source: "file" | "library" | "course";
  courseId?: string;
  fileId?: string;
  createdAt: number;
  questionsText: string;
  answers: QuizAnswer[];
};

type ContextResult = {
  content?: string;
  noteCount: number;
  fileCount: number;
  courseTitle?: string;
};

type ChatMaterial = {
  id: string;
  kind: "file" | "note";
  label: string;
  text: string;
};

type ChatSource = {
  id: string;
  kind: "file" | "note";
  label: string;
};

type CourseMemoryProfile = {
  weakTopics: string[];
  strongTopics: string[];
  recentScores: number[];
  preferredDifficulty: "easy" | "medium" | "hard";
  lastUpdatedAt: string;
};

type GeminiPart = { text?: string };
type GeminiResponse = {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
};

/* =========================
   CONSTANTS
========================= */

const GEMINI_MODEL = process.env.AI_MODEL || "gemini-3-flash-preview";
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || "";

const MAX_CONTEXT_CHARS = 800000;
const MAX_ITEM_CHARS = 200000;
const MAX_FILES = 12;
const MAX_NOTES = 24;
const QUIZ_TTL_MS = 60 * 60 * 1000;
const MAX_CHAT_HISTORY_MESSAGES = 12;
const MAX_CHAT_HISTORY_ITEM_CHARS = 800;
const MAX_CHAT_SNIPPET_CHARS = 1400;
const MAX_CHAT_SNIPPETS = 12;
const MAX_CHAT_CONTEXT_CHARS = 120000;
const MAX_MEMORY_TOPICS = 10;
const MAX_OCR_IMAGE_BYTES = 8 * 1024 * 1024;
const COURSE_MEMORY_OUTPUT_TYPE = "COURSE_MEMORY";
const COURSE_MEMORY_TITLE = "Course Memory Profile";
const STOPWORDS = new Set([
  "the", "and", "for", "are", "with", "this", "that", "from", "your", "you", "not", "but", "all", "can", "was", "were", "has", "have", "had",
  "will", "would", "could", "should", "about", "into", "over", "under", "between", "after", "before", "then", "than", "when", "what", "which",
  "where", "who", "why", "how", "their", "there", "them", "they", "our", "ours", "his", "her", "its", "also", "just", "more", "most", "very",
  "using", "use", "used", "only", "based", "course", "materials", "uploaded", "question", "answer", "correct", "incorrect", "study", "topic",
]);

const OUT_OF_SCOPE_MESSAGE =
  "This question cannot be answered using the uploaded course materials.";
const AI_UNAVAILABLE_MESSAGE = "AI service temporarily unavailable.";

const DEFAULT_TIMEOUT_MS = 30000;
const rawTimeout = Number(process.env.AI_TIMEOUT_MS);
const GEMINI_TIMEOUT_MS =
  Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : DEFAULT_TIMEOUT_MS;

const SYSTEM_PROMPT = `You are an AI assistant integrated into a modern education web application.
Your responses MUST follow these UI and UX rules strictly:

### 🎯 GENERAL GOAL
- Be clear, structured, and easy to scan.
- Avoid long paragraphs.
- Always optimize for readability inside a chatbox UI.

### 💬 OUTPUT FORMAT RULES
- Always format outputs in clean sections.
- Use: Short paragraphs, Bullet points, Headings (##, ###).
- NEVER output raw or cluttered text.
- NEVER mix user input and AI output inline.

### 🧠 RESPONSE TYPES
1. Summaries: Output a structured summary (Title, Key Concepts, Short explanations, Important terms highlighted).
2. Study Notes: Output as study-friendly notes (Definitions, Key points, Mini examples, Memory tips).
3. Generate Quiz: Create 5-10 questions (mix of multiple choice + short answer). Show answers ONLY if user asks.

### 🔊 TEXT-TO-SPEECH (TTS) SUPPORT
When generating output, you MUST also return a simplified version for speech.
Format it exactly inside a <speech> block at the very end of your response:
<speech>
[Natural spoken language version, no symbols, no markdown]
</speech>

### 🎨 UI / UX STYLE
- Keep responses visually minimal and modern.
- Avoid unnecessary emojis.
- Use spacing for clarity.
- No technical metadata in output.
- Tone: Friendly but professional, clear and confident, avoid robotic language.

🚫 FORBIDDEN:
- Do NOT output: "model:", "temperature:", "operational:", system/debug info, or internal notes.`;

/* =========================
   HELPERS
========================= */

const extractGeminiText = (data: GeminiResponse): string => {
  const parts =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "") ?? [];
  return parts.join("").trim();
};

/* =========================
   SERVICE
========================= */

export class AiService {
  private readonly uploadDir = path.resolve(env.UPLOAD_DIR);
  private readonly quizStore = new Map<string, QuizRecord>();
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    const hasApiKey = Boolean(GEMINI_API_KEY);
    if (hasApiKey) {
      this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    }
    console.info(
      `[AI] Gemini API configured=${hasApiKey ? "yes" : "no"} model=${GEMINI_MODEL} timeoutMs=${GEMINI_TIMEOUT_MS}`
    );
  }

  /* ========= PUBLIC ========= */

  async listFilesForUser(user: AuthUser) {
    return prisma.file.findMany({
      where: { uploaderId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSizeBytes: true,
        createdAt: true,
        courseId: true,
      },
    });
  }

  async summarize(user: AuthUser, fileIds: string[], noteIds: string[] = []): Promise<AiOutput> {
    return this.runForMaterials(user, fileIds, noteIds, "SUMMARY", (content) =>
      this.summaryPrompt(content)
    );
  }

  async generateNotes(user: AuthUser, fileIds: string[], noteIds: string[] = []): Promise<AiOutput> {
    return this.runForMaterials(user, fileIds, noteIds, "NOTES", (content) =>
      this.notesPrompt(content)
    );
  }

  async generateStudyPlan(user: AuthUser, fileIds: string[], noteIds: string[] = [], duration?: string): Promise<AiOutput> {
    const content = await this.buildMaterialsContext(user, fileIds, noteIds);
    this.logRequest(user.id, "STUDY_PLAN", { scope: "materials", fileCount: fileIds.length, noteCount: noteIds.length });
    
    if (!content) return { output: this.emptyMessage(), source: "library" };

    const prompt = this.studyPlanPrompt(content, duration);
    const output = await this.generateWithGemini(prompt);
    return { output, source: "file" };
  }

  async generateQuiz(user: AuthUser, fileIds: string[], noteIds: string[] = [], topic?: string, difficulty?: string, questionCount?: number): Promise<AiOutput> {
    const content = await this.buildMaterialsContext(user, fileIds, noteIds);
    const totalItems = fileIds.length + noteIds.length;

    this.logRequest(user.id, "QUIZ", {
      scope: "materials",
      count: totalItems,
    });

    const result = await this.buildQuizOutput(content, {
      source: "file",
      fileId: fileIds[0] || noteIds[0],
    }, topic, difficulty, questionCount);

    this.logResponse(user.id, "QUIZ", result.output);
    return result;
  }

  async summarizeCourse(user: AuthUser, courseId: string): Promise<AiOutput> {
    return this.runForCourse(user, courseId, "SUMMARY", (content) =>
      this.summaryPrompt(content)
    );
  }

  async generateNotesForCourse(
    user: AuthUser,
    courseId: string
  ): Promise<AiOutput> {
    return this.runForCourse(user, courseId, "NOTES", (content) =>
      this.notesPrompt(content)
    );
  }

  async generateStudyPlanForCourse(
    user: AuthUser,
    courseId: string,
    duration?: string
  ): Promise<AiOutput> {
    return this.runForCourse(user, courseId, "STUDY_PLAN", (content) =>
      this.studyPlanPrompt(content, duration)
    );
  }

  async generateQuizForCourse(
    user: AuthUser,
    courseId: string,
    topic?: string,
    difficulty?: string,
    questionCount?: number
  ): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildCourseContext(
      user,
      courseId
    );

    this.logRequest(user.id, "QUIZ", {
      scope: "course",
      courseId,
      noteCount,
      fileCount,
    });

    const memory = await this.loadCourseMemory(user.id, courseId);
    const adaptiveDifficulty = this.resolveAdaptiveDifficulty(difficulty, memory);

    const result = await this.buildQuizOutput(content, {
      source: "course",
      courseId,
    }, topic, adaptiveDifficulty, questionCount, memory);

    this.logResponse(user.id, "QUIZ", result.output);
    return result;
  }

  async getChatHistory(user: AuthUser, courseId: string) {
    const messages = await prisma.chatMessage.findMany({
      where: { userId: user.id, courseId },
      orderBy: { createdAt: "asc" },
    });
    return messages;
  }

  async getCourseMemory(user: AuthUser, courseId: string): Promise<CourseMemoryProfile> {
    await courseService.ensureAccess(courseId, user.id);
    return this.loadCourseMemory(user.id, courseId);
  }

  async chat(
    user: AuthUser,
    courseId: string,
    message: string,
    fileIds: string[] = [],
    noteIds: string[] = []
  ): Promise<AiOutput> {
    const normalizedFileIds = fileIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    const normalizedNoteIds = noteIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    const hasScopedMaterials = normalizedFileIds.length > 0 || normalizedNoteIds.length > 0;

    const recentHistory = await prisma.chatMessage.findMany({
      where: { userId: user.id, courseId },
      orderBy: { createdAt: "desc" },
      take: MAX_CHAT_HISTORY_MESSAGES,
    });
    recentHistory.reverse();

    let content: string | undefined = undefined;
    let selectedSources: ChatSource[] = [];
    let noteCount = 0;
    let fileCount = 0;
    let courseTitle: string | undefined = undefined;
    const memory = await this.loadCourseMemory(user.id, courseId);

    if (hasScopedMaterials) {
      const scoped = await this.buildScopedMaterialsForChat(
        user,
        courseId,
        normalizedFileIds,
        normalizedNoteIds
      );
      const scopedContext = this.buildScopedChatContext(scoped.materials, message, recentHistory);
      content = scopedContext.context;
      selectedSources = scopedContext.sources;
      noteCount = scoped.noteCount;
      fileCount = scoped.fileCount;
      courseTitle = scoped.courseTitle;
      this.logRequest(user.id, "CHAT", {
        scope: "materials",
        courseId,
        fileId: normalizedFileIds[0],
        fileCount,
        noteCount,
      });
    } else {
      const scoped = await this.buildCourseMaterialsForChat(user, courseId);
      const scopedContext = this.buildScopedChatContext(scoped.materials, message, recentHistory);
      content = scopedContext.context;
      selectedSources = scopedContext.sources;
      noteCount = scoped.noteCount;
      fileCount = scoped.fileCount;
      courseTitle = scoped.courseTitle;
      this.logRequest(user.id, "CHAT", { scope: "course", courseId, noteCount, fileCount });
    }

    if (!content) {
      const output = OUT_OF_SCOPE_MESSAGE;
      this.logResponse(user.id, "CHAT", output);
      return {
        output,
        source: hasScopedMaterials ? "file" : "course",
        courseId,
        fileId: normalizedFileIds[0],
      };
    }

    await prisma.chatMessage.create({
      data: {
        courseId,
        userId: user.id,
        role: "user",
        content: message,
      },
    });

    const output = await this.generateWithGemini(
      this.chatPrompt(
        content,
        message,
        recentHistory,
        courseTitle,
        memory,
        selectedSources
      )
    );

    const outputWithSources = this.ensureSourceSection(output, selectedSources);

    await prisma.chatMessage.create({
      data: {
        courseId,
        userId: user.id,
        role: "assistant",
        content: outputWithSources,
      },
    });

    this.logResponse(user.id, "CHAT", outputWithSources);
    return {
      output: outputWithSources,
      source: hasScopedMaterials ? "file" : "course",
      courseId,
      fileId: normalizedFileIds[0],
    };
  }

  async checkQuizAnswers(
    user: AuthUser,
    courseId: string,
    quizText: string,
    answersText: string,
    quizId?: string
  ): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildCourseContext(
      user,
      courseId
    );

    this.logRequest(user.id, "QUIZ_CHECK", {
      scope: "course",
      courseId,
      noteCount,
      fileCount,
    });

    if (!content) {
      const output = JSON.stringify([{ explanation: OUT_OF_SCOPE_MESSAGE }]);
      this.logResponse(user.id, "QUIZ_CHECK", output);
      return { output, source: "course", courseId };
    }

    if (quizId) {
      const record = this.getQuizRecord(quizId);
      if (!record) {
        const output = JSON.stringify([{ explanation: "Quiz session expired. Generate a new quiz to check answers." }]);
        this.logResponse(user.id, "QUIZ_CHECK", output);
        return { output, source: "course", courseId };
      }

      if (record.courseId && record.courseId !== courseId) {
        const output = JSON.stringify([{ explanation: "Quiz does not match the selected course." }]);
        this.logResponse(user.id, "QUIZ_CHECK", output);
        return { output, source: "course", courseId };
      }

      const output = this.evaluateQuizRecord(record, answersText);
      await this.updateCourseMemoryFromQuiz(
        user.id,
        courseId,
        record.questionsText,
        output
      );
      this.logResponse(user.id, "QUIZ_CHECK", output);
      return { output, source: "course", courseId };
    }

    const output = await this.generateWithGemini(
      this.quizCheckPrompt(content, quizText, answersText)
    );
    await this.updateCourseMemoryFromQuiz(user.id, courseId, quizText, output);
    this.logResponse(user.id, "QUIZ_CHECK", output);
    return { output, source: "course", courseId };
  }
  async generateFlashcards(
    user: AuthUser,
    fileIds: string[],
    noteIds: string[] = []
  ): Promise<{ flashcards: { front: string; back: string }[]; output: string }> {
    const content = await this.buildMaterialsContext(user, fileIds, noteIds);
    const totalItems = fileIds.length + noteIds.length;

    this.logRequest(user.id, "FLASHCARDS", {
      scope: "materials",
      count: totalItems,
    });

    if (!content) {
      return { flashcards: [], output: this.emptyMessage() };
    }

    const raw = await this.generateWithGemini(this.flashcardsPrompt(content));
    const flashcards = this.parseFlashcards(raw);
    const output = flashcards.length ? "Success" : OUT_OF_SCOPE_MESSAGE;

    this.logResponse(user.id, "FLASHCARDS", output);
    return { flashcards, output };
  }


  async generateFlashcardsForCourse(
    user: AuthUser,
    courseId: string
  ): Promise<{ flashcards: { front: string; back: string }[]; output: string }> {
    const { content, noteCount, fileCount } = await this.buildCourseContext(
      user,
      courseId
    );

    this.logRequest(user.id, "FLASHCARDS", {
      scope: "course",
      courseId,
      noteCount,
      fileCount,
    });

    if (!content) {
      return { flashcards: [], output: this.emptyMessage() };
    }

    const raw = await this.generateWithGemini(this.flashcardsPrompt(content));
    const flashcards = this.parseFlashcards(raw);
    const output = raw;
    this.logResponse(user.id, "FLASHCARDS", output);
    return { flashcards, output };
  }

  async summarizeLibrary(user: AuthUser): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildLibraryContext(
      user
    );

    this.logRequest(user.id, "SUMMARY", {
      scope: "library",
      noteCount,
      fileCount,
    });

    const output = content
      ? await this.generateWithGemini(this.summaryPrompt(content))
      : this.emptyMessage();

    this.logResponse(user.id, "SUMMARY", output);
    return { output, source: "library" };
  }

  async generateNotesFromLibrary(user: AuthUser): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildLibraryContext(
      user
    );

    this.logRequest(user.id, "NOTES", {
      scope: "library",
      noteCount,
      fileCount,
    });

    const output = content
      ? await this.generateWithGemini(this.notesPrompt(content))
      : this.emptyMessage();

    this.logResponse(user.id, "NOTES", output);
    return { output, source: "library" };
  }

  async generateStudyPlanFromLibrary(user: AuthUser): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildLibraryContext(
      user
    );

    this.logRequest(user.id, "STUDY_PLAN", {
      scope: "library",
      noteCount,
      fileCount,
    });

    const output = content
      ? await this.generateWithGemini(this.studyPlanPrompt(content))
      : this.emptyMessage();

    this.logResponse(user.id, "STUDY_PLAN", output);
    return { output, source: "library" };
  }

  async generateQuizFromLibrary(user: AuthUser, topic?: string, difficulty?: string, questionCount?: number): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildLibraryContext(
      user
    );

    this.logRequest(user.id, "QUIZ", {
      scope: "library",
      noteCount,
      fileCount,
    });

    const result = await this.buildQuizOutput(content, {
      source: "library",
    }, topic, difficulty, questionCount);

    this.logResponse(user.id, "QUIZ", result.output);
    return result;
  }

  /* ========= GEMINI ========= */

  private async generateWithGemini(prompt: string): Promise<string> {
    if (!this.genAI) {
      throw new HttpError(
        503,
        "AI service not configured. Missing GEMINI_API_KEY."
      );
    }

    let lastError: any = null;

    for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
      const startTime = Date.now();

      try {
        console.info(
          `[AI] Gemini API request started model=${GEMINI_MODEL} attempt=${attempt}/${RETRY_COUNT}`
        );

        const model = this.genAI.getGenerativeModel({
          model: GEMINI_MODEL,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }, { apiVersion: 'v1beta' });

        const result = await model.generateContent(prompt);
        const response = result.response;

        // Check for safety-blocked responses
        const finishReason = response?.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          console.warn("[AI] Response blocked by safety filters");
          return "The AI could not generate a response due to content safety filters.";
        }

        const text = response.text();

        const elapsed = Date.now() - startTime;
        console.info(
          `[AI] Gemini API request succeeded elapsed=${elapsed}ms responseLength=${text?.length ?? 0}`
        );
        return text || "AI response was empty.";
      } catch (error) {
        const elapsed = Date.now() - startTime;
        if (error instanceof HttpError) throw error;

        const err = error as any;
        const statusCode = err?.status ?? err?.code ?? "unknown";
        console.error(`[AI] Gemini API request failed (attempt ${attempt}/${RETRY_COUNT})`, {
          elapsed: `${elapsed}ms`,
          name: err?.name,
          code: statusCode,
          message: err?.message,
          details: err?.errorDetails ?? err?.statusText ?? undefined,
        });

        lastError = error;

        if (this.isTimeoutError(error)) {
          throw new HttpError(504, "AI request timed out. Please try again.");
        }

        // Handle non-retryable errors immediately
        if (statusCode === 400) {
          throw new HttpError(400, "Invalid request to AI service.");
        }
        if (statusCode === 403) {
          throw new HttpError(503, "AI API key is invalid or lacks permissions.");
        }

        // Retryable errors: 429 (rate limit) and 503 (overloaded)
        if (statusCode === 429 || statusCode === 503) {
          if (attempt < RETRY_COUNT) {
            console.warn(
              `[AI] Retryable error (${statusCode}). Waiting ${RETRY_DELAY_MS}ms before retry ${attempt + 1}/${RETRY_COUNT}...`
            );
            await this.sleep(RETRY_DELAY_MS);
            continue;
          }
          // All retries exhausted
          throw new HttpError(
            503,
            "AI şu an çok yoğun, lütfen bir dakika sonra tekrar deneyin."
          );
        }

        // Unknown error — don't retry
        throw new HttpError(503, AI_UNAVAILABLE_MESSAGE);
      }
    }

    // Should never reach here, but safety net
    throw new HttpError(503, AI_UNAVAILABLE_MESSAGE);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private isTimeoutError(error: unknown) {
    const err = error as any;
    return (
      err?.name === "AbortError" ||
      err?.code === "UND_ERR_CONNECT_TIMEOUT" ||
      err?.cause?.code === "UND_ERR_CONNECT_TIMEOUT"
    );
  }

  /* ========= CONTEXT ========= */

  private async buildLibraryContext(user: AuthUser): Promise<ContextResult> {
    const courses = await prisma.course.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { memberships: { some: { userId: user.id } } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    });

    const courseIds = courses.map((c) => c.id);

    const notes = await prisma.note.findMany({
      where: {
        authorId: user.id,
        ...(courseIds.length ? { courseId: { in: courseIds } } : {}),
      },
      take: MAX_NOTES,
      orderBy: { createdAt: "desc" },
      select: { title: true, content: true },
    });

    const files = await prisma.file.findMany({
      where: {
        uploaderId: user.id,
      },
      take: MAX_FILES,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
      },
    });

    let used = 0;
    const chunks: string[] = [];

    const append = (text: string) => {
      if (!text) return;
      const remaining = MAX_CONTEXT_CHARS - used;
      if (remaining <= 0) return;
      const slice = text.slice(0, remaining);
      chunks.push(slice);
      used += slice.length;
    };

    append(courses.map((c) => `COURSE: ${c.title}`).join("\n") + "\n\n");

    const noteItems = notes.filter((n) => n.content?.trim());
    const noteCount = noteItems.length;

    for (const n of noteItems) {
      append(`NOTE: ${n.title}
${this.truncate(n.content)}

`);
    }

    let fileCount = 0;

    for (const f of files) {
      const text = await this.extractFileText(f);
      if (text) {
        fileCount += 1;
        append(`FILE: ${f.fileName}
${this.truncate(text)}

`);
      }
    }

    const content = chunks.join("").trim();
    return { content: content || undefined, noteCount, fileCount };
  }

  private async runForCourse(
    user: AuthUser,
    courseId: string,
    action: AiAction,
    buildPrompt: (content: string) => string
  ): Promise<AiOutput> {
    const { content, noteCount, fileCount } = await this.buildCourseContext(
      user,
      courseId
    );

    this.logRequest(user.id, action, {
      scope: "course",
      courseId,
      noteCount,
      fileCount,
    });

    const output = content
      ? await this.generateWithGemini(buildPrompt(content))
      : this.emptyMessage();

    this.logResponse(user.id, action, output);
    return { output, source: "course", courseId };
  }

  private async buildCourseContext(
    user: AuthUser,
    courseId: string
  ): Promise<ContextResult> {
    const normalizedId = courseId?.trim();
    if (!normalizedId) {
      return { content: undefined, noteCount: 0, fileCount: 0 };
    }

    const course = await courseService.ensureAccess(normalizedId, user.id);
    const canViewAll =
      user.role === "ADMIN" || course.ownerId === user.id;

    const notes = await prisma.note.findMany({
      where: {
        courseId: normalizedId,
        authorId: user.id,
      },
      take: MAX_NOTES,
      orderBy: { createdAt: "desc" },
      select: { title: true, content: true },
    });

    const files = await prisma.file.findMany({
      where: {
        courseId: normalizedId,
        ...(canViewAll
          ? {}
          : {
            OR: [{ isPrivate: false }, { uploaderId: user.id }],
          }),
      },
      take: MAX_FILES,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
      },
    });

    let used = 0;
    const chunks: string[] = [];

    const append = (text: string) => {
      if (!text) return;
      const remaining = MAX_CONTEXT_CHARS - used;
      if (remaining <= 0) return;
      const slice = text.slice(0, remaining);
      chunks.push(slice);
      used += slice.length;
    };

    append(`COURSE: ${course.title}

`);

    const noteItems = notes.filter((n) => n.content?.trim());
    const noteCount = noteItems.length;

    for (const n of noteItems) {
      append(`NOTE: ${n.title}
${this.truncate(n.content)}

`);
    }

    let fileCount = 0;

    for (const f of files) {
      const text = await this.extractFileText(f);
      if (text) {
        fileCount += 1;
        append(`FILE: ${f.fileName}
${this.truncate(text)}

`);
      }
    }

    const content = chunks.join("").trim();
    return {
      content: content || undefined,
      noteCount,
      fileCount,
      courseTitle: course.title,
    };
  }

  private async runForFiles(
    user: AuthUser,
    fileIds: string[],
    action: AiAction,
    buildPrompt: (content: string) => string
  ): Promise<AiOutput> {
    return this.runForMaterials(user, fileIds, [], action, buildPrompt);
  }

  private async runForMaterials(
    user: AuthUser,
    fileIds: string[],
    noteIds: string[],
    action: AiAction,
    buildPrompt: (content: string) => string
  ): Promise<AiOutput> {
    const content = await this.buildMaterialsContext(user, fileIds, noteIds);
    const totalCount = fileIds.length + noteIds.length;

    this.logRequest(user.id, action, {
      scope: "materials",
      count: totalCount,
    });

    const output = content
      ? await this.generateWithGemini(buildPrompt(content))
      : this.emptyMessage();

    this.logResponse(user.id, action, output);
    return { output, source: "file" };
  }

  private async buildFileContext(user: AuthUser, fileId: string) {
    const file = await this.getFileForUser(user, fileId);
    const text = await this.extractFileText(file);
    return text?.trim() || undefined;
  }

  private async buildMaterialsContext(user: AuthUser, fileIds: string[], noteIds: string[] = []) {
    let chunks: string[] = [];
    
    // Process Files
    for (const id of fileIds) {
      try {
        const file = await this.getFileForUser(user, id);
        const text = await this.extractFileText(file);
        if (text?.trim()) {
          chunks.push(`[MATERIAL: FILE - ${file.fileName}]\n${this.truncate(text.trim())}\n\n`);
        }
      } catch (err) {
        console.warn(`[AI] Error loading file ${id} for materials context`);
      }
    }

    // Process Notes
    for (const id of noteIds) {
      try {
        const note = await prisma.note.findFirst({ where: { id, authorId: user.id } });
        if (note && note.content?.trim()) {
          chunks.push(`[MATERIAL: NOTE - ${note.title}]\n${this.truncate(note.content.trim())}\n\n`);
        }
      } catch (err) {
        console.warn(`[AI] Error loading note ${id} for materials context`);
      }
    }

    const result = chunks.join("").trim();
    return result || undefined;
  }

  private async buildCourseMaterialsForChat(user: AuthUser, courseId: string) {
    const normalizedCourseId = courseId?.trim();
    if (!normalizedCourseId) {
      return { materials: [] as ChatMaterial[], noteCount: 0, fileCount: 0, courseTitle: undefined as string | undefined };
    }

    const course = await courseService.ensureAccess(normalizedCourseId, user.id);
    const canViewAll = user.role === "ADMIN" || course.ownerId === user.id;

    const notes = await prisma.note.findMany({
      where: {
        courseId: normalizedCourseId,
        authorId: user.id,
      },
      take: MAX_NOTES,
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, content: true },
    });

    const files = await prisma.file.findMany({
      where: {
        courseId: normalizedCourseId,
        ...(canViewAll
          ? {}
          : {
            OR: [{ isPrivate: false }, { uploaderId: user.id }],
          }),
      },
      take: MAX_FILES,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
      },
    });

    const materials: ChatMaterial[] = [];
    let fileCount = 0;

    for (const file of files) {
      const text = await this.extractFileText(file);
      if (!text?.trim()) continue;
      fileCount += 1;
      materials.push({
        id: file.id,
        kind: "file",
        label: file.fileName,
        text: this.truncate(text.trim()),
      });
    }

    const noteItems = notes.filter((note) => note.content?.trim());
    for (const note of noteItems) {
      materials.push({
        id: note.id,
        kind: "note",
        label: note.title || "Untitled note",
        text: this.truncate(note.content.trim()),
      });
    }

    return {
      materials,
      noteCount: noteItems.length,
      fileCount,
      courseTitle: course.title,
    };
  }

  private async buildScopedMaterialsForChat(
    user: AuthUser,
    courseId: string,
    fileIds: string[],
    noteIds: string[]
  ) {
    const normalizedCourseId = courseId?.trim();
    if (!normalizedCourseId) {
      return { materials: [] as ChatMaterial[], noteCount: 0, fileCount: 0, courseTitle: undefined as string | undefined };
    }

    const course = await courseService.ensureAccess(normalizedCourseId, user.id);
    const materials: ChatMaterial[] = [];
    let fileCount = 0;
    let noteCount = 0;

    for (const fileId of fileIds) {
      try {
        const file = await this.getFileForUser(user, fileId);
        if (file.courseId !== normalizedCourseId) continue;
        const text = await this.extractFileText(file);
        if (!text?.trim()) continue;
        fileCount += 1;
        materials.push({
          id: file.id,
          kind: "file",
          label: file.fileName,
          text: this.truncate(text.trim()),
        });
      } catch (err) {
        console.warn(`[AI] Error loading scoped file ${fileId}:`, (err as any)?.message);
      }
    }

    for (const noteId of noteIds) {
      try {
        const note = await prisma.note.findFirst({
          where: {
            id: noteId,
            authorId: user.id,
            courseId: normalizedCourseId,
          },
          select: { id: true, title: true, content: true },
        });
        if (!note?.content?.trim()) continue;
        noteCount += 1;
        materials.push({
          id: note.id,
          kind: "note",
          label: note.title || "Untitled note",
          text: this.truncate(note.content.trim()),
        });
      } catch (err) {
        console.warn(`[AI] Error loading scoped note ${noteId}:`, (err as any)?.message);
      }
    }

    return {
      materials,
      noteCount,
      fileCount,
      courseTitle: course.title,
    };
  }

  private buildScopedChatContext(
    materials: ChatMaterial[],
    message: string,
    history: { role: string; content: string }[]
  ): { context?: string; sources: ChatSource[] } {
    if (!materials.length) return { context: undefined, sources: [] };

    const recentUserMessages = history
      .filter((item) => item.role === "user")
      .slice(-3)
      .map((item) => item.content)
      .filter(Boolean);
    const query = [message, ...recentUserMessages].join("\n");
    const tokens = this.extractSearchTokens(query);

    const ranked = materials
      .flatMap((material) =>
        this.splitTextForChat(material.text).map((snippet, index) => ({
          material,
          snippet,
          index,
          score: this.scoreChatSnippet(snippet, tokens),
        }))
      )
      .filter((item) => item.snippet.trim().length > 0);

    const chosen = ranked
      .sort((a, b) => (b.score - a.score) || (a.index - b.index))
      .slice(0, MAX_CHAT_SNIPPETS);

    const fallback = chosen.length
      ? chosen
      : materials
          .slice(0, MAX_CHAT_SNIPPETS)
          .flatMap((material) =>
            this.splitTextForChat(material.text)
              .slice(0, 1)
              .map((snippet, index) => ({ material, snippet, index, score: 0 }))
          );

    if (!fallback.length) return { context: undefined, sources: [] };

    let used = 0;
    const blocks: string[] = [];
    const sources: ChatSource[] = [];
    let sourceIndex = 1;
    for (const item of fallback) {
      const sourceId = `S${sourceIndex}`;
      const header = `[${sourceId}] [SOURCE: ${item.material.kind.toUpperCase()}] ${item.material.label}\n`;
      const body = item.snippet.trim();
      if (!body) continue;
      const block = `${header}${body}`;
      if (used >= MAX_CHAT_CONTEXT_CHARS) break;
      const remaining = MAX_CHAT_CONTEXT_CHARS - used;
      const slice = block.slice(0, remaining);
      blocks.push(slice);
      used += slice.length + 2;
      sources.push({
        id: sourceId,
        kind: item.material.kind,
        label: item.material.label,
      });
      sourceIndex += 1;
    }

    const merged = blocks.join("\n\n").trim();
    return { context: merged || undefined, sources };
  }

  private splitTextForChat(text: string): string[] {
    if (!text) return [];
    const normalized = text.replace(/\r/g, "");
    const parts = normalized
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .filter(Boolean);

    const snippets: string[] = [];
    for (const part of parts) {
      if (part.length <= MAX_CHAT_SNIPPET_CHARS) {
        snippets.push(part);
        continue;
      }
      let start = 0;
      while (start < part.length) {
        const end = start + MAX_CHAT_SNIPPET_CHARS;
        snippets.push(part.slice(start, end).trim());
        start = end;
      }
    }

    return snippets.length ? snippets : [this.truncate(normalized.trim(), MAX_CHAT_SNIPPET_CHARS)];
  }

  private extractSearchTokens(text: string): string[] {
    return Array.from(
      new Set(
        (text || "")
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .map((token) => token.trim())
          .filter((token) => token.length >= 3)
      )
    );
  }

  private scoreChatSnippet(snippet: string, tokens: string[]): number {
    if (!snippet || !tokens.length) return 0;
    const lower = snippet.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (!lower.includes(token)) continue;
      score += 2;
      const exactPattern = new RegExp(`\\b${this.escapeRegExp(token)}\\b`, "g");
      const exactMatches = lower.match(exactPattern)?.length ?? 0;
      score += Math.min(exactMatches, 4);
    }
    return score;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async buildQuizOutput(
    content: string | undefined,
    meta: { source: "file" | "library" | "course"; courseId?: string; fileId?: string },
    topic?: string,
    difficulty?: string,
    questionCount?: number,
    memory?: CourseMemoryProfile
  ): Promise<AiOutput> {
    if (!content) {
      return {
        output: this.emptyMessage(),
        source: meta.source,
        courseId: meta.courseId,
        fileId: meta.fileId,
      };
    }

    const rawQuiz = await this.generateWithGemini(
      this.quizPrompt(content, topic, difficulty, questionCount, memory)
    );
    const sanitizedQuiz = this.sanitizeQuizOutput(rawQuiz);
    const output = sanitizedQuiz || "AI response was empty.";

    let quizId: string | undefined;

    if (sanitizedQuiz) {
      try {
        const answerKeyRaw = await this.generateWithGemini(
          this.quizAnswerKeyPrompt(content, sanitizedQuiz)
        );
        const answers = this.parseQuizAnswerKey(answerKeyRaw);
        if (answers.length) {
          quizId = this.storeQuizRecord({
            id: randomUUID(),
            source: meta.source,
            courseId: meta.courseId,
            fileId: meta.fileId,
            createdAt: Date.now(),
            questionsText: sanitizedQuiz,
            answers,
          });
        }
      } catch (error) {
        console.warn("[AI] quiz answer key generation failed", {
          name: (error as any)?.name,
          code: (error as any)?.code,
        });
      }
    }

    return {
      output,
      source: meta.source,
      courseId: meta.courseId,
      fileId: meta.fileId,
      quizId,
    };
  }

  private async getFileForUser(user: AuthUser, fileId: string) {
    const normalizedId = fileId?.trim();
    if (!normalizedId) {
      throw new NotFoundError("File not found");
    }

    const file = await prisma.file.findFirst({
      where: { id: normalizedId, uploaderId: user.id },
      select: {
        id: true,
        courseId: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
      },
    });

    if (!file) {
      throw new NotFoundError("File not found");
    }

    return file;
  }

  /* ========= FILE IO ========= */

  private async extractFileText(file: FileForText) {
    const filePath = path.resolve(this.uploadDir, file.storagePath);
    const ext = path.extname(file.fileName || "").toLowerCase();

    try {
      // PDF files
      if (file.mimeType === "application/pdf" || ext === ".pdf") {
        const buffer = await fs.readFile(filePath);
        const parsed = await pdfParse(buffer);
        const text = parsed.text?.trim();
        if (text) console.info(`[AI] PDF parsed: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      // Plain text files
      if (file.mimeType?.startsWith("text/") || [".txt", ".md", ".csv", ".json", ".xml", ".html"].includes(ext)) {
        const text = (await fs.readFile(filePath, "utf-8")).trim();
        if (text) console.info(`[AI] Text file read: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      // Image OCR (PNG/JPG/WEBP)
      if (
        file.mimeType?.startsWith("image/") ||
        [".png", ".jpg", ".jpeg", ".webp"].includes(ext)
      ) {
        const text = await this.extractImageText(filePath, file.mimeType || this.mimeTypeFromExt(ext));
        if (text) console.info(`[AI] OCR parsed: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      // PPTX (PowerPoint) — ZIP containing ppt/slides/slide*.xml
      if (ext === ".pptx" || file.mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
        const text = this.extractPptxText(filePath);
        if (text) console.info(`[AI] PPTX parsed: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      // DOCX (Word) — ZIP containing word/document.xml
      if (ext === ".docx" || file.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const text = this.extractDocxText(filePath);
        if (text) console.info(`[AI] DOCX parsed: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      // XLSX (Excel) — ZIP containing xl/sharedStrings.xml + xl/worksheets/sheet*.xml
      if (ext === ".xlsx" || file.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
        const text = this.extractXlsxText(filePath);
        if (text) console.info(`[AI] XLSX parsed: ${file.fileName} → ${text.length} chars`);
        return text || undefined;
      }

      console.warn(`[AI] Unsupported file type: ${file.fileName} (${file.mimeType}, ext=${ext})`);
    } catch (err) {
      console.warn(`[AI] extractFileText failed for ${file.fileName}:`, (err as any)?.message);
      return undefined;
    }

    return undefined;
  }

  private mimeTypeFromExt(ext: string): string {
    switch (ext) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".webp":
        return "image/webp";
      default:
        return "application/octet-stream";
    }
  }

  private async extractImageText(filePath: string, mimeType: string): Promise<string | undefined> {
    if (!this.genAI) return undefined;
    try {
      const buffer = await fs.readFile(filePath);
      const input = buffer.byteLength > MAX_OCR_IMAGE_BYTES
        ? buffer.subarray(0, MAX_OCR_IMAGE_BYTES)
        : buffer;
      const imagePart = {
        inlineData: {
          data: input.toString("base64"),
          mimeType,
        },
      };
      const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL }, { apiVersion: "v1beta" });
      const result = await model.generateContent([
        {
          text: "Extract all readable text from this study image. Return plain text only. Keep equations and headings.",
        },
        imagePart,
      ]);
      const text = result.response?.text()?.trim() || "";
      return text || undefined;
    } catch (error) {
      console.warn("[AI] image OCR failed", (error as any)?.message);
      return undefined;
    }
  }

  /** Extract text from PPTX slides */
  private extractPptxText(filePath: string): string | undefined {
    try {
      const zip = new AdmZip(filePath);
      const entries = zip.getEntries()
        .filter(e => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName))
        .sort((a, b) => {
          const numA = parseInt(a.entryName.match(/slide(\d+)/)?.[1] || "0");
          const numB = parseInt(b.entryName.match(/slide(\d+)/)?.[1] || "0");
          return numA - numB;
        });

      const slides: string[] = [];
      for (const entry of entries) {
        const xml = entry.getData().toString("utf-8");
        const text = this.stripXmlTags(xml);
        if (text.trim()) slides.push(text.trim());
      }
      return slides.join("\n\n") || undefined;
    } catch (err) {
      console.warn(`[AI] PPTX extraction error:`, (err as any)?.message);
      return undefined;
    }
  }

  /** Extract text from DOCX */
  private extractDocxText(filePath: string): string | undefined {
    try {
      const zip = new AdmZip(filePath);
      const docEntry = zip.getEntry("word/document.xml");
      if (!docEntry) return undefined;
      const xml = docEntry.getData().toString("utf-8");
      return this.stripXmlTags(xml).trim() || undefined;
    } catch (err) {
      console.warn(`[AI] DOCX extraction error:`, (err as any)?.message);
      return undefined;
    }
  }

  /** Extract text from XLSX shared strings */
  private extractXlsxText(filePath: string): string | undefined {
    try {
      const zip = new AdmZip(filePath);
      const ssEntry = zip.getEntry("xl/sharedStrings.xml");
      if (!ssEntry) return undefined;
      const xml = ssEntry.getData().toString("utf-8");
      return this.stripXmlTags(xml).trim() || undefined;
    } catch (err) {
      console.warn(`[AI] XLSX extraction error:`, (err as any)?.message);
      return undefined;
    }
  }

  /** Strip XML tags and collapse whitespace */
  private stripXmlTags(xml: string): string {
    return xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&#\d+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /* ========= PROMPTS ========= */

  private summaryPrompt(content: string) {
    return `${SYSTEM_PROMPT}\n\nProvide a comprehensive, detailed, and well-structured summary of the following study materials. Make sure to cover all major concepts, definitions, and key points present in the text. Ensure no important information is left out. Use only the provided materials and do not add external information:

${content}`;
  }

  private notesPrompt(content: string) {
    return `${SYSTEM_PROMPT}\n\nCreate highly detailed, structured study notes with comprehensive headings and bullet points. Ensure no important topic is left out, and explain concepts thoroughly based on the text. Use only the provided materials and do not add external information:

${content}`;
  }

  private studyPlanPrompt(content: string, duration?: string) {
    let durationInstruction = "";
    
    if (!duration) {
      durationInstruction = "Create a WEEKLY study plan (7 days).";
    } else if (duration === 'daily') {
      durationInstruction = "Create a DAILY study plan (for one day of intensive study). Break it into morning, afternoon, and evening sessions.";
    } else if (duration === '3days') {
      durationInstruction = "Create a 3-DAY study plan. Organize topics across 3 days.";
    } else if (!isNaN(Number(duration))) {
      durationInstruction = `Create a ${duration}-DAY study plan. Organize the learning path specifically for a ${duration} day period.`;
    } else {
      durationInstruction = `Create a study plan for the following duration: ${duration}.`;
    }

    return `${SYSTEM_PROMPT}

${durationInstruction}

Use ONLY the provided materials. 
Structure:
- Use markdown headings (e.g., ## Day 1).
- Use bullet points for specific sub-topics.
- Include estimated time for each session.
- Add a "Focus Area" for each day.

Materials:
${content}`;
  }

  private quizPrompt(
    content: string,
    topic?: string,
    difficulty?: string,
    questionCount?: number,
    memory?: CourseMemoryProfile
  ) {
    const count = questionCount && [10, 20, 30].includes(questionCount) ? questionCount : 10;
    let focus = `You are a strict examiner. Create exactly ${count} multiple-choice questions (A-D).
CRITICAL RULES:
1. Use ONLY the exact facts found in the provided COURSE MATERIALS.
2. DO NOT invent, hallucinate, or assume any information whatsoever.
3. If the materials do not contain enough facts to create ${count} questions, create as many as possible strictly from the text.
4. Number each question sequentially starting from 1 (e.g., 1. 2. 3. ... ${count}.)`;
    if (difficulty) {
      focus += `\n5. Make the questions to be "${difficulty}" level in difficulty.`;
    }
    if (topic) {
      focus += `\n6. Prioritize the requested topic: "${topic}".`;
    }
    if (memory?.weakTopics?.length) {
      focus += `\n7. Emphasize these weak topics: ${memory.weakTopics.slice(0, 5).join(", ")}.`;
    }
    if (memory?.strongTopics?.length) {
      focus += `\n8. Include fewer basic questions about strong topics: ${memory.strongTopics.slice(0, 3).join(", ")}.`;
    }

    return `${focus}

Return ONLY the questions and answer options. Do NOT include correct answers, hints, or explanations yet.
Number each question clearly (1-${count} or up to the max possible).

COURSE MATERIALS:
${content}`;
  }

  private quizAnswerKeyPrompt(content: string, quizText: string) {
    return `You are generating the answer key for a quiz using ONLY the course materials below.
Return ONLY valid JSON in this exact format:
{"answers":[{"index":1,"correctOption":"A","explanation":"short explanation grounded in the materials"}]}
If the materials do not support a question, set correctOption to "UNKNOWN" and explain why.
Do NOT add markdown or extra text.

COURSE MATERIALS:
${content}

QUIZ:
${quizText}`;
  }

  private chatPrompt(
    content: string,
    message: string,
    history: { role: string; content: string }[] = [],
    courseTitle?: string,
    memory?: CourseMemoryProfile,
    sources: ChatSource[] = []
  ) {
    let historyContext = "";
    if (history.length > 0) {
      historyContext =
        "PREVIOUS CONVERSATION:\n" +
        history
          .map((h) => {
            const clean = (h.content || "")
              .replace(/<speech>[\s\S]*?<\/speech>/gi, "")
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, MAX_CHAT_HISTORY_ITEM_CHARS);
            return `${h.role === "user" ? "Student" : "You"}: ${clean}`;
          })
          .filter((line) => !line.endsWith(":"))
          .join("\n\n") +
        "\n\n";
    }

    const memoryContext =
      memory && (memory.weakTopics.length || memory.strongTopics.length)
        ? `LEARNING MEMORY PROFILE:
- Weak topics: ${memory.weakTopics.length ? memory.weakTopics.join(", ") : "none"}
- Strong topics: ${memory.strongTopics.length ? memory.strongTopics.join(", ") : "none"}
- Preferred difficulty: ${memory.preferredDifficulty}
\n`
        : "";

    const sourceHint = sources.length
      ? `When citing facts, add source tags exactly like [${sources[0].id}] using the source IDs from COURSE MATERIALS.`
      : "";

    return `${SYSTEM_PROMPT}\n\nYou are a course-scoped exam assistant${courseTitle ? ` for "${courseTitle}"` : ""}. Use only the course materials below to answer the student's question.
You may paraphrase, simplify, and provide illustrative examples that are logically derived from the materials.
Do not introduce new topics or facts outside the materials.
If the question is loosely related, explain the closest relevant concepts from the materials and clarify the limits.
If the question is unrelated to the materials, respond exactly with:
"${OUT_OF_SCOPE_MESSAGE}"
Start responses with: "Based on the uploaded course materials..."
${sourceHint}

COURSE MATERIALS:
${content}

${memoryContext}
${historyContext}STUDENT QUESTION:
${message}`;
  }

  private quizCheckPrompt(
    content: string,
    quizText: string,
    answersText: string
  ) {
    return `You are evaluating a student's quiz answers. Use ONLY the course materials below.
Do NOT regenerate the quiz.
Evaluate each answer based on the materials.

Return ONLY valid JSON in this exact format (no markdown code blocks, no extra text):
[
  {
    "index": 1,
    "isCorrect": true,
    "correctOption": "A",
    "explanation": "short explanation derived from the materials"
  }
]

COURSE MATERIALS:
${content}

QUIZ:
${quizText}

STUDENT ANSWERS:
${answersText}`;
  }

  private flashcardsPrompt(content: string) {
    return `You are creating study flashcards from the following course materials.
Generate exactly 12 flashcards. Each flashcard has a "front" (a concise question or key term) and a "back" (the answer or explanation).
Return ONLY valid JSON in this exact format, with no markdown, no code blocks, no extra text:
{"flashcards":[{"front":"Question or term","back":"Answer or explanation"},{"front":"...","back":"..."}]}
Use ONLY information from the provided materials. Do NOT invent facts.

COURSE MATERIALS:
${content}`;
  }

  private parseFlashcards(raw: string): { front: string; back: string }[] {
    if (!raw) return [];
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return [];
    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        flashcards?: Array<{ front?: string; back?: string }>;
      };
      if (!Array.isArray(parsed.flashcards)) return [];
      return parsed.flashcards
        .filter(
          (c): c is { front: string; back: string } =>
            typeof c.front === "string" &&
            typeof c.back === "string" &&
            c.front.trim().length > 0 &&
            c.back.trim().length > 0
        )
        .map((c) => ({ front: c.front.trim(), back: c.back.trim() }));
    } catch {
      return [];
    }
  }

  /* ========= UTILS ========= */

  private defaultCourseMemory(): CourseMemoryProfile {
    return {
      weakTopics: [],
      strongTopics: [],
      recentScores: [],
      preferredDifficulty: "medium",
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private async loadCourseMemory(userId: string, courseId: string): Promise<CourseMemoryProfile> {
    const record = await prisma.aiOutput.findFirst({
      where: {
        userId,
        courseId,
        type: COURSE_MEMORY_OUTPUT_TYPE,
      },
      orderBy: { createdAt: "desc" },
      select: { content: true },
    });

    if (!record?.content) return this.defaultCourseMemory();
    try {
      const parsed = JSON.parse(record.content) as Partial<CourseMemoryProfile>;
      return {
        weakTopics: Array.isArray(parsed.weakTopics) ? parsed.weakTopics.filter(Boolean).slice(0, MAX_MEMORY_TOPICS) : [],
        strongTopics: Array.isArray(parsed.strongTopics) ? parsed.strongTopics.filter(Boolean).slice(0, MAX_MEMORY_TOPICS) : [],
        recentScores: Array.isArray(parsed.recentScores) ? parsed.recentScores.filter((v) => Number.isFinite(v)).slice(-12) as number[] : [],
        preferredDifficulty: parsed.preferredDifficulty === "easy" || parsed.preferredDifficulty === "hard" ? parsed.preferredDifficulty : "medium",
        lastUpdatedAt: typeof parsed.lastUpdatedAt === "string" ? parsed.lastUpdatedAt : new Date().toISOString(),
      };
    } catch {
      return this.defaultCourseMemory();
    }
  }

  private async saveCourseMemory(userId: string, courseId: string, profile: CourseMemoryProfile): Promise<void> {
    const payload: CourseMemoryProfile = {
      ...profile,
      weakTopics: profile.weakTopics.slice(0, MAX_MEMORY_TOPICS),
      strongTopics: profile.strongTopics.slice(0, MAX_MEMORY_TOPICS),
      recentScores: profile.recentScores.slice(-12),
      lastUpdatedAt: new Date().toISOString(),
    };

    await prisma.aiOutput.create({
      data: {
        userId,
        courseId,
        type: COURSE_MEMORY_OUTPUT_TYPE,
        title: COURSE_MEMORY_TITLE,
        content: JSON.stringify(payload),
      },
    });
  }

  private resolveAdaptiveDifficulty(requested: string | undefined, memory: CourseMemoryProfile): string | undefined {
    if (requested && requested.trim()) return requested.trim();
    const recent = memory.recentScores.slice(-5);
    if (!recent.length) return memory.preferredDifficulty;
    const avg = recent.reduce((sum, score) => sum + score, 0) / recent.length;
    if (avg >= 80) return "hard";
    if (avg <= 45) return "easy";
    return "medium";
  }

  private ensureSourceSection(output: string, sources: ChatSource[]): string {
    if (!sources.length) return output;
    const hasSourcesSection = /(^|\n)#{2,3}\s*Sources\b/i.test(output);
    if (hasSourcesSection) return output;
    const lines = sources.map((source) => `- [${source.id}] ${source.kind.toUpperCase()}: ${source.label}`);
    return `${output.trim()}\n\n## Sources\n${lines.join("\n")}`;
  }

  private parseQuizQuestions(quizText: string): Map<number, string> {
    const result = new Map<number, string>();
    if (!quizText) return result;
    const lines = quizText.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)[.)]\s*(.+)$/);
      if (!match) continue;
      const index = Number(match[1]);
      const text = match[2]?.trim();
      if (Number.isFinite(index) && text) result.set(index, text);
    }
    return result;
  }

  private parseQuizEvaluation(rawOutput: string): Array<{ index: number; isCorrect: boolean }> {
    if (!rawOutput) return [];
    try {
      const parsed = JSON.parse(rawOutput);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((item) => ({
          index: Number(item?.index),
          isCorrect: Boolean(item?.isCorrect),
        }))
        .filter((item) => Number.isFinite(item.index) && item.index > 0);
    } catch {
      return [];
    }
  }

  private extractTopicCandidates(text: string): string[] {
    const tokens = (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
    return Array.from(new Set(tokens));
  }

  private topTopicTerms(values: string[], limit = 5): string[] {
    const counts = new Map<string, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([token]) => token);
  }

  private async updateCourseMemoryFromQuiz(
    userId: string,
    courseId: string,
    quizText: string,
    evaluationOutput: string
  ): Promise<void> {
    try {
      const parsedEvaluations = this.parseQuizEvaluation(evaluationOutput);
      if (!parsedEvaluations.length) return;

      const questions = this.parseQuizQuestions(quizText);
      const total = parsedEvaluations.length;
      const correct = parsedEvaluations.filter((item) => item.isCorrect).length;
      const score = Math.round((correct / total) * 100);

      const incorrectQuestionTexts = parsedEvaluations
        .filter((item) => !item.isCorrect)
        .map((item) => questions.get(item.index) || "")
        .filter(Boolean);
      const correctQuestionTexts = parsedEvaluations
        .filter((item) => item.isCorrect)
        .map((item) => questions.get(item.index) || "")
        .filter(Boolean);

      const weakTokens = this.topTopicTerms(
        incorrectQuestionTexts.flatMap((text) => this.extractTopicCandidates(text)),
        6
      );
      const strongTokens = this.topTopicTerms(
        correctQuestionTexts.flatMap((text) => this.extractTopicCandidates(text)),
        4
      );

      const current = await this.loadCourseMemory(userId, courseId);
      const mergedWeak = Array.from(new Set([...weakTokens, ...current.weakTopics])).slice(0, MAX_MEMORY_TOPICS);
      const mergedStrong = Array.from(
        new Set([...strongTokens, ...current.strongTopics].filter((token) => !mergedWeak.includes(token)))
      ).slice(0, MAX_MEMORY_TOPICS);
      const recentScores = [...current.recentScores, score].slice(-12);
      const avg = recentScores.reduce((sum, value) => sum + value, 0) / recentScores.length;

      const preferredDifficulty: CourseMemoryProfile["preferredDifficulty"] =
        avg >= 80 ? "hard" : avg <= 45 ? "easy" : "medium";

      await this.saveCourseMemory(userId, courseId, {
        weakTopics: mergedWeak,
        strongTopics: mergedStrong,
        recentScores,
        preferredDifficulty,
        lastUpdatedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.warn("[AI] memory update failed", (error as any)?.message);
    }
  }

  private truncate(text: string, max = MAX_ITEM_CHARS) {
    return text.length > max ? text.slice(0, max) + "\n...[truncated]" : text;
  }

  private emptyMessage() {
    return "No study content found. Upload files or add notes first.";
  }

  private logRequest(
    userId: string,
    action: AiAction,
    target: {
      scope: "course" | "file" | "library" | "materials";
      courseId?: string;
      fileId?: string;
      noteCount?: number;
      fileCount?: number;
      count?: number;
    }
  ): void {
    const parts = [`action=${action}`, `user=${userId}`, `scope=${target.scope}`];
    if (target.courseId) parts.push(`course=${target.courseId}`);
    if (target.fileId) parts.push(`file=${target.fileId}`);
    if (target.noteCount !== undefined) parts.push(`notes=${target.noteCount}`);
    if (target.fileCount !== undefined) parts.push(`files=${target.fileCount}`);
    if (target.count !== undefined) parts.push(`items=${target.count}`);
    console.info(`[AI] request ${parts.join(" ")}`);
  }

  private logResponse(userId: string, action: AiAction, output: string) {
    console.info(
      `[AI] response action=${action} user=${userId} length=${output.length}`
    );
  }

  private sanitizeQuizOutput(raw: string) {
    if (!raw) return "";
    const stripped = raw.replace(
      /\s*\(?(?:correct\s*answer|answer)\s*[:\-]\s*[A-Za-z]\)?/gi,
      ""
    );
    const lines = stripped.split(/\r?\n/);
    const filtered = lines.filter(
      (line) =>
        !/^\s*(?:correct\s*answer|answer|answer key)\b/i.test(line)
    );
    return filtered.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  private parseQuizAnswerKey(raw: string): QuizAnswer[] {
    if (!raw) return [];
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return [];

    try {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as {
        answers?: Array<{
          index?: number;
          correctOption?: string;
          explanation?: string;
        }>;
      };

      if (!Array.isArray(parsed.answers)) return [];

      return parsed.answers
        .map((item): QuizAnswer | null => {
          const index = Number(item.index);
          if (!Number.isFinite(index) || index <= 0) return null;
          const option = typeof item.correctOption === "string"
            ? item.correctOption.trim().toUpperCase()
            : "";
          if (!option) return null;
          if (option !== "UNKNOWN" && !/^[A-Z]$/.test(option)) return null;
          const explanation = typeof item.explanation === "string"
            ? item.explanation.trim()
            : undefined;
          const answer: QuizAnswer = explanation
            ? { index, correctOption: option, explanation }
            : { index, correctOption: option };
          return answer;
        })
        .filter((item): item is QuizAnswer => item !== null);
    } catch {
      return [];
    }
  }

  private storeQuizRecord(record: QuizRecord): string {
    this.pruneQuizStore();
    this.quizStore.set(record.id, record);
    return record.id;
  }

  private getQuizRecord(quizId: string): QuizRecord | undefined {
    this.pruneQuizStore();
    return this.quizStore.get(quizId);
  }

  private pruneQuizStore() {
    const now = Date.now();
    for (const [id, record] of this.quizStore.entries()) {
      if (now - record.createdAt > QUIZ_TTL_MS) {
        this.quizStore.delete(id);
      }
    }
  }

  private evaluateQuizRecord(record: QuizRecord, answersText: string): string {
    if (!record.answers.length) {
      return JSON.stringify([{ explanation: "Quiz answer key unavailable. Generate a new quiz to check answers." }]);
    }

    const provided = this.parseUserAnswers(answersText);
    if (!provided.size) {
      return JSON.stringify([{ explanation: "No answers detected. Provide answers like 1:A, 2:C." }]);
    }

    const results = record.answers
      .sort((a, b) => a.index - b.index)
      .map((answer) => {
        const userAnswer = provided.get(answer.index);
        if (!userAnswer) {
          return {
            index: answer.index,
            isCorrect: false,
            correctOption: answer.correctOption,
            explanation: "No answer provided.",
          };
        }
        if (answer.correctOption === "UNKNOWN") {
          return {
            index: answer.index,
            isCorrect: false,
            correctOption: "UNKNOWN",
            explanation: "Unable to verify from the materials.",
          };
        }
        const normalized = userAnswer.toUpperCase();
        const isCorrect = normalized === answer.correctOption;
        
        return {
          index: answer.index,
          isCorrect,
          correctOption: answer.correctOption,
          explanation: answer.explanation || "",
        };
      });

    return JSON.stringify(results);
  }

  private parseUserAnswers(raw: string): Map<number, string> {
    const result = new Map<number, string>();
    if (!raw) return result;

    const regex = /(\d+)\s*[:\)\-]\s*([A-Za-z])/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(raw)) !== null) {
      const index = Number(match[1]);
      const option = match[2]?.trim().toUpperCase();
      if (Number.isFinite(index) && option) {
        result.set(index, option);
      }
    }

    if (result.size) return result;

    const trimmed = raw.trim();
    if (!trimmed) return result;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          const index = Number(item?.index ?? item?.question);
          const option = typeof item?.answer === "string" ? item.answer.trim().toUpperCase() : "";
          if (Number.isFinite(index) && option) {
            result.set(index, option);
          }
        });
      } else if (parsed && typeof parsed === "object") {
        Object.entries(parsed).forEach(([key, value]) => {
          const index = Number(key);
          const option = typeof value === "string" ? value.trim().toUpperCase() : "";
          if (Number.isFinite(index) && option) {
            result.set(index, option);
          }
        });
      }
    } catch {
      return result;
    }

    return result;
  }
}
