export const mlServiceTimeoutMs = 90_000;
const mlServiceMaxAttempts = 3;
const mlServiceInitialRetryDelayMs = 1_000;

export function mlServiceUrl(): string {
  const configuredUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
  return /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `http://${configuredUrl}`;
}

function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number): number {
  const exponentialDelay = mlServiceInitialRetryDelayMs * 2 ** (attempt - 1);
  return exponentialDelay + Math.floor(Math.random() * 250);
}

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

export async function requestMlService(path: string, init: RequestInit): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= mlServiceMaxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${mlServiceUrl()}${path}`, {
        ...init,
        signal: AbortSignal.timeout(mlServiceTimeoutMs),
      });
      if (response.ok || !isTransientStatus(response.status) || attempt === mlServiceMaxAttempts) return response;
      await response.body?.cancel();
      console.warn("ML service returned a transient error; retrying", {
        status: response.status,
        attempt,
        maxAttempts: mlServiceMaxAttempts,
      });
    } catch (error) {
      lastError = error;
      if (attempt === mlServiceMaxAttempts) throw error;
      console.warn("ML service request failed; retrying", {
        error,
        attempt,
        maxAttempts: mlServiceMaxAttempts,
      });
    }
    await sleep(retryDelayMs(attempt));
  }

  throw lastError instanceof Error ? lastError : new Error("ML service request failed");
}
