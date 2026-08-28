import { NextFunction, Request, Response, Router } from "express";
import { chat, flashcards, getChatHistory, getCourseMemory, listFiles, notes, quiz, quizCheck, studyPlan, summarize, saveAiOutput, listAiOutputs, deleteAiOutput } from "./ai.controller";
import { authMiddleware } from "../auth/auth.middleware";

const router = Router();
const handle =
  (handler: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction): void => {
      handler(req, res).catch(next);
    };

// List files available for AI processing
router.get(
  "/files",
  authMiddleware,
  handle(listFiles)
);

router.post(
  "/summarize",
  authMiddleware,
  handle(summarize)
);

router.get(
  "/summarize",
  authMiddleware,
  handle(summarize)
);

router.post(
  "/study-plan",
  authMiddleware,
  handle(studyPlan)
);
router.get(
  "/study-plan",
  authMiddleware,
  handle(studyPlan)
);

router.post(
  "/notes",
  authMiddleware,
  handle(notes)
);
router.get(
  "/notes",
  authMiddleware,
  handle(notes)
);

router.post(
  "/quiz",
  authMiddleware,
  handle(quiz)
);
router.get(
  "/quiz",
  authMiddleware,
  handle(quiz)
);

router.post(
  "/chat",
  authMiddleware,
  handle(chat)
);

router.get(
  "/chat",
  authMiddleware,
  handle(getChatHistory)
);

router.get(
  "/memory",
  authMiddleware,
  handle(getCourseMemory)
);

router.post(
  "/quiz-check",
  authMiddleware,
  handle(quizCheck)
);

router.post(
  "/flashcards",
  authMiddleware,
  handle(flashcards)
);

// AI Outputs (saved results)
router.get(
  "/outputs",
  authMiddleware,
  handle(listAiOutputs)
);

router.post(
  "/outputs",
  authMiddleware,
  handle(saveAiOutput)
);

router.delete(
  "/outputs/:id",
  authMiddleware,
  handle(deleteAiOutput)
);

export default router;
