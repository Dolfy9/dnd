import { useQuery } from "@tanstack/react-query";
import type { MeResponse, NavSection, PageData, SearchResult, User } from "./types";

let csrf = "";

export function setCsrf(v: string) {
  csrf = v;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  method: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(csrf && method !== "GET" ? { "X-CSRF": csrf } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const text = await r.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* html odpověď */
  }
  if (!r.ok) {
    const msg = (data as { chyba?: string; detail?: string }).chyba
      || (data as { detail?: string }).detail
      || `HTTP ${r.status}`;
    throw new ApiError(r.status, typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export async function upload<T = unknown>(url: string, file: Blob, filename: string): Promise<T> {
  const fd = new FormData();
  fd.append("file", file, filename);
  const r = await fetch(url, {
    method: "POST",
    headers: { ...(csrf ? { "X-CSRF": csrf } : {}) },
    body: fd,
    credentials: "same-origin",
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new ApiError(r.status, data.chyba || data.detail || `HTTP ${r.status}`);
  }
  return r.json() as Promise<T>;
}

export const get = <T = unknown>(url: string) => api<T>("GET", url);
export const post = <T = unknown>(url: string, body?: unknown) => api<T>("POST", url, body);
export const put = <T = unknown>(url: string, body?: unknown) => api<T>("PUT", url, body);
export const del = <T = unknown>(url: string) => api<T>("DELETE", url);

// ---------- auth ----------
export async function login(login_: string, password: string) {
  const r = await api<{ ok: boolean; csrf: string; user: User }>(
    "POST", "/api/auth/login", { login: login_, password });
  setCsrf(r.csrf);
  return r.user;
}

export async function logout() {
  await api("POST", "/api/auth/logout");
  setCsrf("");
}

export const useMe = () =>
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const r = await get<MeResponse>("/api/auth/me");
      if (r.csrf) setCsrf(r.csrf);
      return r.user;
    },
    staleTime: 60_000,
  });

export const useNav = (enabled: boolean) =>
  useQuery({
    queryKey: ["nav"],
    queryFn: () => get<{ sections: NavSection[] }>("/api/nav"),
    staleTime: 30_000,
    enabled,
  });

export const usePage = (path: string) =>
  useQuery({
    queryKey: ["page", path],
    queryFn: () => get<PageData>(`/api/page?path=${encodeURIComponent(path)}`),
    retry: false,
  });

export const search = (q: string) =>
  get<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`);

export const useEntityOptions = (type: string, q: string) =>
  useQuery({
    queryKey: ["entities", type, q],
    queryFn: () =>
      get<{ items: Array<{ id: number; name: string; path: string; type: string }> }>(
        `/api/entities?type=${encodeURIComponent(type)}&q=${encodeURIComponent(q)}`),
    enabled: q.length >= 2 || q === "",
    staleTime: 15_000,
  });
