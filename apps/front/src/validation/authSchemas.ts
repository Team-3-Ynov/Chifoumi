import { z } from "zod";

// Client-side rules mirror the API DTOs (apps/api/src/auth/dto/*.dto.ts).
export const emailSchema = z.string().min(1, "L'email est requis").email("Format d'email invalide");

export const strongPasswordSchema = z
  .string()
  .min(10, "Au moins 10 caractères")
  .max(128, "128 caractères maximum");

export const displayNameSchema = z
  .string()
  .min(3, "Entre 3 et 30 caractères")
  .max(30, "Entre 3 et 30 caractères")
  .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, tirets et underscores uniquement");

// Login mirrors the API's LoginDto (password is only length-checked at register
// time), so here we just require a non-empty password.
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Le mot de passe est requis"),
});

export const registerSchema = z.object({
  email: emailSchema,
  password: strongPasswordSchema,
  displayName: displayNameSchema,
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
