import { Request, Response } from "express";
import { AuthUser } from "../auth/auth.middleware";
import { AiService } from "./ai.service";
import { HttpError } from "../../utils/httpErrors";
import { prisma } from "../../db/client";
const service = new AiService();

const parseFileId = (input: unknown): string | undefined => {
  if (!input) return undefined;

  if (Array.isArray(input)) {
    const ids = input
      .filter((item): item is string => typeof item === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length ? ids[0] : undefined;
  }

  if (typeof input === "string") {
    const ids = input
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length ? ids[0] : undefined;
  }

  return undefined;
};

const parseFileIds = (input: unknown): string[] => {
  if (!input) return [];

  if (Array.isArray(input)) {
    return input
      .filter((item): item is string => typeof item === "string")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  if (typeof input === "string") {
    return input
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
};

const parseNoteIds = (input: unknown): string[] => {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.filter((i): i is string => typeof i === "string").map(s => s.trim()).filter(Boolean);
  }
  if (typeof input === "string") {
    return input.split(",").map(s => s.trim()).filter(Boolean);
  }
  return [];
};

const parseCourseId = (input: unknown): string | undefined => {
  if (!input) return undefined;

  if (Array.isArray(input)) {
    const ids = input
      .filter((item): item is string => typeof item === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length ? ids[0] : undefined;
  }

  if (typeof input === "string") {
    const ids = input
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    return ids.length ? ids[0] : undefined;
  }

  return undefined;
};

const normalizeOutput = (output?: string): string => {
  const trimmed = (output ?? "").trim();
  return trimmed || "AI response was empty.";
};

type OutputAlias = "summary" | "notes" | "quiz" | "studyPlan";

const buildOutputPayload = (output: string, alias?: OutputAlias) => {
  const payload: { output: string; summary?: string; notes?: string; quiz?: string; studyPlan?: string } = { output };
  if (alias) {
    payload[alias] = output;
  }
  return payload;
};

const resolveErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "AI request failed.";
};

const respondUnauthorized = (res: Response, alias?: OutputAlias): void => {
  res.status(401).json(buildOutputPayload("Unauthorized", alias));
};

const logRequest = (
  action: string,
  userId: string,
  target: { fileId?: string; courseId?: string } = {}
): void => {
  const parts = [`action=${action}`, `user=${userId}`];
  if (target.courseId) parts.push(`course=${target.courseId}`);
  if (target.fileId) parts.push(`file=${target.fileId}`);
  console.info(`[AI] request ${parts.join(" ")}`);
};

const handleError = (
  res: Response,
  error: unknown,
  action: string,
  userId: string,
  target: { fileId?: string; courseId?: string } = {},
  alias?: OutputAlias
): void => {
  const message = resolveErrorMessage(error);
  const status = error instanceof HttpError ? error.status : 500;
  const parts = [`action=${action}`, `user=${userId}`];
  if (target.courseId) parts.push(`course=${target.courseId}`);
  if (target.fileId) parts.push(`file=${target.fileId}`);
  console.error(`[AI] failed ${parts.join(" ")}`, error);
  res.status(status).json(buildOutputPayload(message, alias));
};

export const listFiles = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  logRequest("list-files", user.id);

  try {
    const files = await service.listFilesForUser(user);
    res.json({ files });
  } catch (error) {
    handleError(res, error, "list-files", user.id);
  }
};

export const summarize = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res, "summary");
    return;
  }

  const fileIds = parseFileIds(req.body?.fileId ?? req.body?.fileIds ?? req.query?.fileId ?? req.query?.fileIds);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  logRequest("summarize", user.id, { fileId: fileIds?.[0], courseId });

  try {
    const result = (fileIds.length || noteIds.length)
      ? await service.summarize(user, fileIds, noteIds)
      : courseId
        ? await service.summarizeCourse(user, courseId)
        : await service.summarizeLibrary(user);
    const output = normalizeOutput(result.output);
    res.json({ output, summary: output });
  } catch (error) {
    handleError(res, error, "summarize", user.id, { fileId: fileIds?.[0], courseId }, "summary");
  }
};

export const notes = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res, "notes");
    return;
  }

  const fileIds = parseFileIds(req.body?.fileId ?? req.body?.fileIds ?? req.query?.fileId ?? req.query?.fileIds);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  logRequest("notes", user.id, { fileId: fileIds?.[0], courseId });

  try {
    const result = (fileIds.length || noteIds.length)
      ? await service.generateNotes(user, fileIds, noteIds)
      : courseId
        ? await service.generateNotesForCourse(user, courseId)
        : await service.generateNotesFromLibrary(user);
    const output = normalizeOutput(result.output);

    // Auto-save
    await prisma.aiOutput.create({
      data: {
        userId: user.id,
        type: "NOTES",
        title: `AI Notes - ${new Date().toLocaleDateString()}`,
        content: output,
        courseId: courseId || null
      }
    });

    res.json({ output, notes: output });
  } catch (error) {
    handleError(res, error, "notes", user.id, { fileId: fileIds?.[0], courseId }, "notes");
  }
};

export const quiz = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res, "quiz");
    return;
  }

  const fileIds = parseFileIds(req.body?.fileId ?? req.body?.fileIds ?? req.query?.fileId ?? req.query?.fileIds);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  const topic = typeof req.body?.topic === "string" ? req.body.topic.trim() : undefined;
  const difficulty = typeof req.body?.difficulty === "string" ? req.body.difficulty.trim() : undefined;
  const questionCount = typeof req.body?.questionCount === "number" ? req.body.questionCount : undefined;

  logRequest("quiz", user.id, { fileId: fileIds?.[0], courseId });

  try {
    const result = (fileIds.length || noteIds.length)
      ? await service.generateQuiz(user, fileIds, noteIds, topic, difficulty, questionCount)
      : courseId
        ? await service.generateQuizForCourse(user, courseId, topic, difficulty, questionCount)
        : await service.generateQuizFromLibrary(user, topic, difficulty, questionCount);
    const output = normalizeOutput(result.output);

    // Auto-save
    const saved = await prisma.aiOutput.create({
      data: {
        userId: user.id,
        type: "QUIZ",
        title: topic ? `Quiz: ${topic}` : `AI Quiz - ${new Date().toLocaleDateString()}`,
        content: output,
        courseId: courseId || null
      }
    });

    const payload: { output: string; quiz: string; quizId?: string } = {
      output,
      quiz: output,
      quizId: result.quizId
    };
    res.json(payload);
  } catch (error) {
    handleError(res, error, "quiz", user.id, { fileId: fileIds?.[0], courseId }, "quiz");
  }
};

export const chat = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  const fileIds = parseFileIds(req.body?.fileIds ?? req.body?.fileId ?? req.query?.fileIds ?? req.query?.fileId);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  logRequest("chat", user.id, { courseId, fileId: fileIds?.[0] });

  if (!courseId || !message) {
    res.status(400).json({ output: "courseId and message required" });
    return;
  }

  try {
    const result = await service.chat(user, courseId, message, fileIds, noteIds);
    const output = normalizeOutput(result.output);
    res.json({ output });
  } catch (error) {
    handleError(res, error, "chat", user.id, { courseId, fileId: fileIds?.[0] });
  }
};

export const getChatHistory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  const courseId = parseCourseId(req.query?.courseId);
  if (!courseId) {
    res.status(400).json({ error: "courseId is required" });
    return;
  }

  try {
    const history = await service.getChatHistory(user, courseId);
    res.json(history);
  } catch (error) {
    handleError(res, error, "chat" as any, user.id, { courseId });
  }
};

export const getCourseMemory = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  const courseId = parseCourseId(req.query?.courseId ?? req.body?.courseId);
  if (!courseId) {
    res.status(400).json({ error: "courseId is required" });
    return;
  }

  try {
    const memory = await service.getCourseMemory(user, courseId);
    res.json({ memory });
  } catch (error) {
    handleError(res, error, "memory", user.id, { courseId });
  }
};

export const quizCheck = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  const quizText = typeof req.body?.quizText === "string" ? req.body.quizText.trim() : "";
  const quizId = typeof req.body?.quizId === "string" ? req.body.quizId.trim() : "";
  const rawAnswers = req.body?.answers;
  const answers =
    typeof rawAnswers === "string"
      ? rawAnswers.trim()
      : rawAnswers
        ? JSON.stringify(rawAnswers)
        : "";
  logRequest("quiz-check", user.id, { courseId });

  if (!courseId || (!quizText && !quizId) || !answers) {
    res.status(400).json({ output: "courseId, quizText or quizId, and answers required" });
    return;
  }

  try {
    const result = await service.checkQuizAnswers(
      user,
      courseId,
      quizText,
      answers,
      quizId || undefined
    );
    const output = normalizeOutput(result.output);
    res.json({ output, evaluation: output });
  } catch (error) {
    handleError(res, error, "quiz-check", user.id, { courseId });
  }
};

export const flashcards = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res);
    return;
  }

  const fileIds = parseFileIds(req.body?.fileId ?? req.body?.fileIds ?? req.query?.fileId ?? req.query?.fileIds);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  logRequest("flashcards", user.id, { fileId: fileIds?.[0], courseId });

  if (!courseId && !fileIds.length && !noteIds.length) {
    res.status(400).json({ flashcards: [], output: "courseId, fileIds or noteIds required" });
    return;
  }

  try {
    const result = (fileIds.length || noteIds.length)
      ? await service.generateFlashcards(user, fileIds, noteIds)
      : await service.generateFlashcardsForCourse(user, courseId!);
    res.json({ flashcards: result.flashcards, output: result.output });
  } catch (error) {
    handleError(res, error, "flashcards", user.id, { fileId: fileIds?.[0], courseId });
  }
};

export const studyPlan = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;

  if (!user) {
    respondUnauthorized(res, "studyPlan");
    return;
  }

  const fileIds = parseFileIds(req.body?.fileId ?? req.body?.fileIds ?? req.query?.fileId ?? req.query?.fileIds);
  const noteIds = parseNoteIds(req.body?.noteIds ?? req.query?.noteIds);
  const courseId = parseCourseId(req.body?.courseId ?? req.query?.courseId);
  const duration = (req.body?.duration ?? req.query?.duration) as string | undefined;
  logRequest("study_plan", user.id, { fileId: fileIds?.[0], courseId });

  try {
    const result = (fileIds.length || noteIds.length)
      ? await service.generateStudyPlan(user, fileIds, noteIds, duration)
      : courseId
        ? await service.generateStudyPlanForCourse(user, courseId, duration)
        : await service.generateStudyPlanFromLibrary(user);
    const output = normalizeOutput(result.output);

    // Auto-save
    await prisma.aiOutput.create({
      data: {
        userId: user.id,
        type: "STUDY_PLAN",
        title: `Study Plan (${duration || 'Weekly'}) - ${new Date().toLocaleDateString()}`,
        content: output,
        courseId: courseId || null
      }
    });

    res.json({ output, studyPlan: output });
  } catch (error) {
    handleError(res, error, "study_plan", user.id, { fileId: fileIds?.[0], courseId }, "studyPlan");
  }
};

/* ─── AI Outputs (save / list / delete) ─── */

export const saveAiOutput = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;
  if (!user) { respondUnauthorized(res); return; }

  const { type, title, content, courseId } = req.body;
  if (!type || !title || !content) {
    res.status(400).json({ error: "type, title, and content are required" });
    return;
  }

  try {
    const record = await prisma.aiOutput.create({
      data: { userId: user.id, type, title, content, courseId: courseId || null },
    });
    res.json({ data: record });
  } catch (error) {
    res.status(500).json({ error: "Failed to save AI output" });
  }
};

export const listAiOutputs = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;
  if (!user) { respondUnauthorized(res); return; }

  try {
    const outputs = await prisma.aiOutput.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({ data: outputs });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch AI outputs" });
  }
};

export const deleteAiOutput = async (req: Request, res: Response): Promise<void> => {
  const user = req.user as AuthUser | undefined;
  if (!user) { respondUnauthorized(res); return; }

  const id = req.params.id;
  try {
    await prisma.aiOutput.deleteMany({ where: { id, userId: user.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete AI output" });
  }
};
