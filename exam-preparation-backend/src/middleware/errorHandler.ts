import { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpErrors";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }
  console.error(err);
  res.status(500).json({ error: { message: "Internal Server Error" } });
}