import { Request, Response } from "express";
import { authService } from "./auth.service";
import { userRepo } from "../users/user.repo";

export const authController = {
  async register(req: Request, res: Response) {
    const { fullName, email, password } = req.body ?? {};
    const result = await authService.register({ fullName, email, password });
    res.status(201).json(result);
  },
  async login(req: Request, res: Response) {
    const { email, password } = req.body ?? {};
    const result = await authService.login({ email, password });
    res.json(result);
  },
  async getMe(req: Request, res: Response) {
    // req.user is set by authMiddleware
    const authUser = req.user;
    if (!authUser) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const user = await userRepo.getById(authUser.id);
    if (!user) {
      res.status(401).json({ message: "User not found" });
      return;
    }
    // Return only safe fields
    res.json({ id: user.id, fullName: user.fullName, email: user.email, role: user.role });
  },
};
