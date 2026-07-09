export function laravelApiUrl(): string {
  return process.env.LARAVEL_API_URL ?? "http://localhost:8000/api";
}
