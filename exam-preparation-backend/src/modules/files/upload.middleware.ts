import multer from "multer";
import fs from "fs";
import path from "path";
import { env } from "../../config/env";

// ensure upload dir exists
if (!fs.existsSync(env.UPLOAD_DIR)) {
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const safeOriginal = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, unique + "-" + safeOriginal);
  },
});

// Allowed mime types: PDF + images + Word + PowerPoint
const allowedMimeTypes = [
  "application/pdf",

  // Images
  "image/png",
  "image/jpeg",
  "image/webp",

  // Word documents
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc

  // PowerPoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-powerpoint", // .ppt

  // Text
  "text/plain",
];

export const upload = multer({
  storage,
  // Keep this aligned with reverse proxy upload limits.
  limits: { fileSize: env.UPLOAD_MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error("Unsupported file type"));
    }
    cb(null, true);
  },
});
