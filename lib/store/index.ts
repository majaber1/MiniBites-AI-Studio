// ---------------------------------------------------------------------------
// Kiswani persistent storage layer.
// Keeps MiniBites production keys backward-compatible while adding projects.
// ---------------------------------------------------------------------------
import { cleanEnv } from "@/lib/env";
import type { Production, StudioProject } from "../types";
import { MemoryStore } from "./memory";
import { UpstashStore } from "./upstash";
import { DiskStore } from "./disk";

export interface Store {
  readonly durable: boolean;
  readonly name: string;
  getProduction(id: string): Promise<Production | null>;
  saveProduction(p: Production): Promise<void>;
  listProductions(ownerKey: string): Promise<Production[]>;
  listAllProductions(limit?: number): Promise<Production[]>;
  getProject(id: string): Promise<StudioProject | null>;
  saveProject(project: StudioProject): Promise<void>;
  listProjects(ownerKey: string): Promise<StudioProject[]>;
  incrCounter(key: string, ttlSeconds: number): Promise<number>;
  acquireLock(key: string, ttlSeconds: number): Promise<string | null>;
  releaseLock(key: string, token: string): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __kiswaniStore: Store | undefined;
  // Legacy singleton may exist during hot reload from the old build.
  // eslint-disable-next-line no-var
  var __minibitesStore: Store | undefined;
}

export function getStore(): Store {
  // Always sync: if __minibitesStore is set, it's the active store (used by tests)
  if (globalThis.__minibitesStore) {
    globalThis.__kiswaniStore = globalThis.__minibitesStore;
    return globalThis.__kiswaniStore;
  }
  if (globalThis.__kiswaniStore) return globalThis.__kiswaniStore;
  const url = cleanEnv("UPSTASH_REDIS_REST_URL");
  const token = cleanEnv("UPSTASH_REDIS_REST_TOKEN");
  const store: Store = url && token ? new UpstashStore(url, token) : new DiskStore();
  globalThis.__kiswaniStore = store;
  globalThis.__minibitesStore = store;
  return store;
}
