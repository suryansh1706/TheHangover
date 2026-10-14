export function mlServiceUrl(): string {
  const configuredUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8000";
  return /^https?:\/\//i.test(configuredUrl) ? configuredUrl : `http://${configuredUrl}`;
}
