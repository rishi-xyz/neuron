import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3000),

  SLACK_BOT_TOKEN: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),

  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  COGNEE_API_KEY: z.string().min(1),
  LLM_API_KEY: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const formatted = result.error.format();
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(formatted, null, 2)}`,
    );
  }
  return result.data;
}
