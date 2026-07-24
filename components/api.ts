"use client";
import type { Production } from "@/lib/types";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (HTTP ${res.status})`, res.status);
  return data;
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export type { Production };
