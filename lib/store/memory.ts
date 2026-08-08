import type { Production } from "../types";
import type { Store } from "./index";

/** NON-DURABLE store for local development only. */
export class MemoryStore implements Store {
  readonly durable = false;
  readonly name = "memory (non-durable — configure Upstash Redis for production)";
  private productions = new Map<string, Production>();
  private counters = new Map<string, { n: number; exp: number }>();
  private locks = new Map<string, number>();

  async getProduction(id: string) {
    return this.productions.get(id) ?? null;
  }
  async saveProduction(p: Production) {
    this.productions.set(p.id, p);
  }
  async listProductions(ownerKey: string) {
    return [...this.productions.values()]
      .filter((p) => p.ownerKey === ownerKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async incrCounter(key: string, ttlSeconds: number) {
    const now = Date.now();
    const cur = this.counters.get(key);
    if (!cur || cur.exp < now) {
      this.counters.set(key, { n: 1, exp: now + ttlSeconds * 1000 });
      return 1;
    }
    cur.n += 1;
    return cur.n;
  }
  async acquireLock(key: string, ttlSeconds: number) {
    const now = Date.now();
    const expiry = this.locks.get(key) ?? 0;
    if (expiry > now) return false;
    this.locks.set(key, now + ttlSeconds * 1000);
    return true;
  }
  async releaseLock(key: string) {
    this.locks.delete(key);
  }
}
