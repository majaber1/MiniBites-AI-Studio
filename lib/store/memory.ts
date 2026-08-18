import type { Production, StudioProject } from "../types";
import type { Store } from "./index";

/** NON-DURABLE store for local development only. */
export class MemoryStore implements Store {
  readonly durable = false;
  readonly name = "memory (non-durable — configure Upstash Redis for production)";
  private productions = new Map<string, Production>();
  private projects = new Map<string, StudioProject>();
  private counters = new Map<string, { n: number; exp: number }>();
  private locks = new Map<string, { token: string; exp: number }>();

  async getProduction(id: string) { return this.productions.get(id) ?? null; }
  async saveProduction(p: Production) { this.productions.set(p.id, p); }
  async listProductions(ownerKey: string) {
    return [...this.productions.values()].filter((p) => p.ownerKey === ownerKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listAllProductions(limit = 100) {
    return [...this.productions.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
  async getProject(id: string) { return this.projects.get(id) ?? null; }
  async saveProject(project: StudioProject) { this.projects.set(project.id, project); }
  async listProjects(ownerKey: string) {
    return [...this.projects.values()].filter((p) => p.ownerKey === ownerKey).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
    const current = this.locks.get(key);
    if (current && current.exp > now) return null;
    const token = crypto.randomUUID();
    this.locks.set(key, { token, exp: now + ttlSeconds * 1000 });
    return token;
  }
  async releaseLock(key: string, token: string) {
    if (this.locks.get(key)?.token === token) this.locks.delete(key);
  }
}
