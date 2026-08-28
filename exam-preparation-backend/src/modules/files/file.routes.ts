import { Router } from "express";
import { FileController } from "./file.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { upload } from "./upload.middleware";
import { asyncHandler } from "../../utils/asyncHandler";

const router = Router();
const controller = new FileController();

router.post(
  "/upload",
  authMiddleware,
  (req, res, next) => {
    upload.single("file")(req, res, (err: any) => {
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  asyncHandler(controller.upload.bind(controller))
);

router.get(
  "/",
  authMiddleware,
  asyncHandler(controller.list.bind(controller))
);

router.get(
  "/:fileId",
  authMiddleware,
  asyncHandler(controller.download.bind(controller))
);
router.get(
  "/:fileId/download",
  authMiddleware,
  asyncHandler(controller.download.bind(controller))
);

router.delete(
  "/:fileId",
  authMiddleware,
  asyncHandler(controller.remove.bind(controller))
);

export default router;
