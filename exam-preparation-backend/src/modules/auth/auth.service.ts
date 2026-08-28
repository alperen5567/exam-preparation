import { userRepo } from "../users/user.repo";
import { BadRequestError, UnauthorizedError } from "../../utils/httpErrors";
import { hashPassword, comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";
import { RegisterDTO, LoginDTO } from "./auth.types";

export const authService = {
  async register(body: RegisterDTO) {
    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!fullName) throw new BadRequestError("fullName required");
    if (!email) throw new BadRequestError("email required");
    if (!password) throw new BadRequestError("password required");
    if (password.length < 4) throw new BadRequestError("password must be at least 4 characters");

    const existing = await userRepo.getByEmail(email);
    if (existing) throw new BadRequestError("Email already registered", "EMAIL_TAKEN");

    const passwordHash = await hashPassword(password);
    const user = await userRepo.create({ fullName, email, passwordHash, role: "STUDENT" });
    if (!user?.id) throw new BadRequestError("Failed to create user");
    const token = signToken({ id: user.id, role: user.role, email: user.email });

    return { token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } };
  },

  async login(body: LoginDTO) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email) throw new BadRequestError("email required");
    if (!password) throw new BadRequestError("password required");

    const user = await userRepo.getByEmail(email);
    if (!user) throw new UnauthorizedError("User not found");

    const ok = await comparePassword(password, user.passwordHash);
    if (!ok) throw new UnauthorizedError("Invalid credentials");

    const token = signToken({ id: user.id, role: user.role, email: user.email });
    return { token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role } };
  },
};
