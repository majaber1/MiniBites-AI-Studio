// ---------------------------------------------------------------------------
// Persistent storage layer.
// Production: Upstash Redis (UPSTASH_REDIS_REST_URL + TOKEN) — durable across
// refreshes, restarts and serverless instances.
// Fallback: in-memory store (labeled NON-DURABLE) so local dev works with
// zero configuration.
// ---------------------------------------------------------------------------
import { cleanEnv } from "@/lib/env";
import type { Production } from "../types";
import { MemoryStore } from "./memory";
import { UpstashStore } from "./upstash";

export interface Store {
  readonly durable: boolean;
  readonly name: string;
  getProduction(id: string): Promise<Production | null>;
  saveProduction(p: Production): Promise<void>;
  listProductions(ownerKey: string): Promise<Production[]>;
  incrCounter(key: string, ttlSeconds: number): Promise<number>;
  acquireLock(key: string, ttlSeconds: number): Promise<boolean>;
  releaseLock(key: string): Promise<void>;
}

declare global {
  // eslint-disable-next-line no-var
  var __minibitesStore: Store | undefined;
}

export function getStore(): Store {
  if (globalThis.__minibitesStore) return globalThis.__minibitesStore;
  const url = cleanEnv("UPSTASH_REDIS_REST_URL");
  const token = cleanEnv("UPSTASH_REDIS_REST_TOKEN");
  const store: Store = url && token ? new UpstashStore(url, token) : new MemoryStore();
  globalThis.__minibitesStore = store;
  return store;
}
