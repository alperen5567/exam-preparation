export interface RegisterDTO {
  fullName: string;
  email: string;
  password: string;
  role?: "STUDENT" | "ADMIN";
}

export interface LoginDTO {
  email: string;
  password: string;
}
