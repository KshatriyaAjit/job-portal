import { GoogleGenAI } from "@google/genai";

export const DEFAULT_PRIMARY_MODEL = "gemini-3.8-flash";
export const DEFAULT_FALLBACK_MODEL = "gemini-3.7-flash";

/**
 * Checks whether a given model identifier represents a legacy/deprecated model.
 */
export function isOutdatedModel(modelName?: string): boolean {
  if (!modelName) return false;
  const lower = modelName.trim().toLowerCase();
  return (
    lower.startsWith("gemini-2.5") ||
    lower.startsWith("gemini-2.0") ||
    lower.startsWith("gemini-1.5") ||
    lower.startsWith("gemini-1.0") ||
    lower === "gemini-pro"
  );
}

/**
 * Safely resolves a model name, ensuring that legacy/deprecated models in environment
 * variables do not silently override the modern defaults.
 */
export function resolveModelName(envVal: string | undefined, defaultModel: string): string {
  if (!envVal || envVal.trim() === "") {
    return defaultModel;
  }
  const trimmed = envVal.trim();
  if (isOutdatedModel(trimmed)) {
    console.warn(
      `[AI Configuration] Warning: Configured model '${trimmed}' is outdated or unavailable to new users. Using modern default '${defaultModel}' instead.`
    );
    return defaultModel;
  }
  return trimmed;
}

export const PRIMARY_MODEL = resolveModelName(process.env.GEMINI_MODEL, DEFAULT_PRIMARY_MODEL);
export const FALLBACK_MODEL = resolveModelName(process.env.GEMINI_FALLBACK_MODEL, DEFAULT_FALLBACK_MODEL);

/**
 * Determines whether an error is a model unavailability / 404 configuration error.
 * Model availability errors must NEVER be treated as transient retryable errors.
 */
export function isModelUnavailableError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status = (error as { status?: number })?.status;

  return (
    status === 404 ||
    lower.includes("404") ||
    lower.includes("not found") ||
    lower.includes("no longer available") ||
    lower.includes("update your code to use") ||
    lower.includes("model not supported") ||
    lower.includes("unsupported model")
  );
}

/**
 * Determines whether an error is an authentication / API key misconfiguration.
 */
export function isInvalidApiKeyError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status = (error as { status?: number })?.status;

  return (
    status === 401 ||
    status === 403 ||
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("invalid api key") ||
    lower.includes("permission_denied")
  );
}

/**
 * Determines whether an error is transient (retryable) or permanent (non-retryable).
 * Model unavailability (404) and authentication errors (401/403) are explicitly non-transient.
 */
export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  // Permanent failure classes
  if (isInvalidApiKeyError(error)) return false;
  if (isModelUnavailableError(error)) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  // Other non-retryable permanent request errors
  if (
    lower.includes("invalid_argument") ||
    lower.includes("bad request") ||
    lower.includes("parsing_error")
  ) {
    return false;
  }

  const status = (error as { status?: number })?.status;

  // Transient retryable errors
  return (
    status === 503 ||
    status === 429 ||
    lower.includes("503") ||
    lower.includes("service unavailable") ||
    lower.includes("high demand") ||
    lower.includes("overloaded") ||
    lower.includes("unavailable") ||
    lower.includes("429") ||
    lower.includes("resource exhausted") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("ai_request_timeout") ||
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout")
  );
}

export interface GenAIClient {
  interactions?: {
    create: (params: { model: string; input: string }) => Promise<{ output_text?: string | null }>;
  };
  models?: {
    generateContent: (params: { model: string; contents: string }) => Promise<{ text?: string | null }>;
  };
  getGenerativeModel?: (params: { model: string }) => {
    generateContent: (prompt: string) => Promise<{
      response?: { text?: () => string };
      text?: string;
    }>;
  };
}

/**
 * Executes a single Gemini generation attempt with timeout protection.
 * Supports both @google/genai (Interactions API / models.generateContent) and legacy adapters.
 */
export async function executeGenerationWithTimeout(
  ai: GoogleGenAI | GenAIClient,
  modelName: string,
  prompt: string,
  timeoutMs: number
): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("AI_REQUEST_TIMEOUT")), timeoutMs)
  );

  const generatePromise = (async (): Promise<string> => {
    const client = ai as GenAIClient;

    // 1. Prefer modern @google/genai Interactions API if available
    if (client.interactions && typeof client.interactions.create === "function") {
      const interaction = await client.interactions.create({
        model: modelName,
        input: prompt,
      });
      return interaction.output_text ?? "";
    }

    // 2. @google/genai models.generateContent
    if (client.models && typeof client.models.generateContent === "function") {
      const resp = await client.models.generateContent({
        model: modelName,
        contents: prompt,
      });
      return resp.text ?? "";
    }

    // 3. Fallback adapter for getGenerativeModel
    if (typeof client.getGenerativeModel === "function") {
      const model = client.getGenerativeModel({ model: modelName });
      const resp = await model.generateContent(prompt);
      return typeof resp.response?.text === "function" ? resp.response.text() : String(resp.text ?? "");
    }

    throw new Error("UNSUPPORTED_GENAI_CLIENT: Client does not support interactions or generateContent.");
  })();

  return await Promise.race([generatePromise, timeoutPromise]);
}

/**
 * Calls Gemini with bounded retries, exponential backoff with jitter, and model fallback.
 * Critical: If a model throws a 404 / Model Unavailable error, it breaks retry attempts for
 * that model immediately and moves to the fallback model.
 */
export async function callGeminiWithRetryAndFallback(
  ai: GoogleGenAI | GenAIClient,
  prompt: string,
  primaryModelName: string,
  fallbackModelName?: string
): Promise<{ text: string; modelUsed: string }> {
  const isTest = process.env.NODE_ENV === "test";
  const baseDelayMs = isTest ? 5 : 500;
  const maxDelayMs = isTest ? 25 : 3000;
  const timeoutMs = isTest ? 5000 : 15000;
  const maxRetriesPerModel = 2; // 1 initial attempt + 2 retries = 3 attempts per model

  const modelsToTry = [primaryModelName];
  if (fallbackModelName && fallbackModelName !== primaryModelName) {
    modelsToTry.push(fallbackModelName);
  }

  let lastError: unknown = null;

  for (let mIndex = 0; mIndex < modelsToTry.length; mIndex++) {
    const currentModelName = modelsToTry[mIndex];
    const isFallback = mIndex > 0;

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        const rawText = await executeGenerationWithTimeout(ai, currentModelName, prompt, timeoutMs);
        if (isFallback) {
          console.info(`[AI Evaluation] Fallback model '${currentModelName}' succeeded after primary model failure.`);
        }
        return { text: rawText, modelUsed: currentModelName };
      } catch (err: unknown) {
        lastError = err;

        // Permanent authentication failure: fail immediately
        if (isInvalidApiKeyError(err)) {
          throw err;
        }

        // Model unavailable (404): DO NOT retry this model repeatedly.
        // Immediately break out of attempts for this model and attempt fallback model if available.
        if (isModelUnavailableError(err)) {
          console.warn(
            `[AI Evaluation] Model '${currentModelName}' is unavailable (404/not found). Skipping retries for this model.`
          );
          break;
        }

        // Other non-transient permanent errors: do not retry this model
        if (!isTransientError(err)) {
          break;
        }

        // Transient error (503, 429, timeout): backoff and retry if attempts remain
        if (attempt < maxRetriesPerModel) {
          const expDelay = baseDelayMs * Math.pow(2, attempt);
          const jitter = Math.random() * (baseDelayMs / 2);
          const delay = Math.min(maxDelayMs, expDelay + jitter);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // Current model could not complete
    if (mIndex < modelsToTry.length - 1) {
      console.warn(
        `[AI Evaluation] Model '${currentModelName}' could not complete evaluation. Falling back to '${modelsToTry[mIndex + 1]}'...`
      );
    }
  }

  // All retries and fallback models exhausted
  throw lastError;
}
