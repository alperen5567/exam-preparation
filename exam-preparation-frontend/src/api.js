const API_BASE = process.env.REACT_APP_API_BASE_URL || "";

const TOKEN_KEY = "authToken";
const USER_KEY = "authUser";

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAuthUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuthSession(token, user) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function clearAuthSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiRequest(
  path,
  { method = "GET", body, headers = {}, auth = true, isFormData = false } = {}
) {
  const resolvedHeaders = new Headers(headers);

  if (auth) {
    const token = getAuthToken();
    if (token) {
      resolvedHeaders.set("Authorization", `Bearer ${token}`);
    }
  }

  if (!isFormData && body !== undefined) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: resolvedHeaders,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (err) {
    const message = err instanceof Error && err.message ? err.message : "Request failed";
    console.error("[api] network error", { path, method, message });
    const error = new Error(`Network error: ${message}`);
    error.isNetworkError = true;
    throw error;
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const nestedErrorMessage =
      data &&
      typeof data === "object" &&
      data.error &&
      typeof data.error === "object" &&
      typeof data.error.message === "string"
        ? data.error.message
        : undefined;
    const message = nestedErrorMessage || data.message || data.error || `Request failed (${response.status})`;
    console.error("[api] request failed", { path, method, status: response.status, message });
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export { API_BASE };
