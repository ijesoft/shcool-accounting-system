import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email("Invalid email address").max(200),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password too long"),
})

export type LoginInput = z.infer<typeof loginSchema>
