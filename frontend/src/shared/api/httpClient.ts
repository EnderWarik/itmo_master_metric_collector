import { envConfig } from '../config/env';

export async function httpClient<TResponse>(
  path: string,
  init?: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${envConfig.apiBaseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await safeReadError(response);
    throw new Error(message ?? `Request failed with ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

async function safeReadError(response: Response): Promise<string | null> {
  try {
    const payload = await response.json();
    if (payload?.message) {
      return payload.message as string;
    }
    return JSON.stringify(payload);
  } catch {
    return response.statusText;
  }
}

