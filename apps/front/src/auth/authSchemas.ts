import { z } from "zod";

export const loginFormSchema = z.object({
  email: z.string().trim().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis.").max(128, "Mot de passe trop long."),
});

export const registerFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(3, "Display name : 3 caractères minimum.")
    .max(30, "Display name : 30 caractères maximum.")
    .regex(/^[a-zA-Z0-9_-]+$/, "Display name : alphanumérique uniquement (_ et - autorisés)."),
  email: z.string().trim().email("Email invalide."),
  password: z
    .string()
    .min(10, "Mot de passe : 10 caractères minimum.")
    .max(128, "Mot de passe trop long."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;
export type RegisterFormValues = z.infer<typeof registerFormSchema>;
