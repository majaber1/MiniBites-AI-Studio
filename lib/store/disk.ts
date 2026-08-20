import fs from "node:fs";
import path from "node:path";
import type { Production, StudioProject } from "../types";
import type { Store } from "./index";

export class DiskStore implements Store {
  readonly durable = true;
  readonly name = "durable disk store";
  private baseDir: string;
  private productionsDir: string;
  private projectsDir: string;
  private memoryCache = {
    productions: new Map<string, Production>(),
    projects: new Map<string, StudioProject>(),
    counters: new Map<string, { n: number; exp: number }>(),
    locks: new Map<string, { token: string; exp: number }>(),
  };

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(process.cwd(), ".kiswani-data");
    this.productionsDir = path.join(this.baseDir, "productions");
    this.projectsDir = path.join(this.baseDir, "projects");
    try {
      if (!fs.existsSync(this.productionsDir)) fs.mkdirSync(this.productionsDir, { recursive: true });
      if (!fs.existsSync(this.projectsDir)) fs.mkdirSync(this.projectsDir, { recursive: true });
      this.loadAllSync();
    } catch {
      // Fallback in read-only environments
    }
  }

  private loadAllSync() {
    try {
      if (fs.existsSync(this.productionsDir)) {
        const files = fs.readdirSync(this.productionsDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const raw = fs.readFileSync(path.join(this.productionsDir, file), "utf8");
            const prod = JSON.parse(raw) as Production;
            this.memoryCache.productions.set(prod.id, prod);
          }
        }
      }
      if (fs.existsSync(this.projectsDir)) {
        const files = fs.readdirSync(this.projectsDir);
        for (const file of files) {
          if (file.endsWith(".json")) {
            const raw = fs.readFileSync(path.join(this.projectsDir, file), "utf8");
            const proj = JSON.parse(raw) as StudioProject;
            this.memoryCache.projects.set(proj.id, proj);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  async getProduction(id: string): Promise<Production | null> {
    const cached = this.memoryCache.productions.get(id);
    if (cached) return cached;
    try {
      const p = path.join(this.productionsDir, id + ".json");
      if (fs.existsSync(p)) {
        const raw = await fs.promises.readFile(p, "utf8");
        const prod = JSON.parse(raw) as Production;
        this.memoryCache.productions.set(prod.id, prod);
        return prod;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async saveProduction(p: Production): Promise<void> {
    this.memoryCache.productions.set(p.id, p);
    try {
      if (!fs.existsSync(this.productionsDir)) await fs.promises.mkdir(this.productionsDir, { recursive: true });
      const filePath = path.join(this.productionsDir, p.id + ".json");
      await fs.promises.writeFile(filePath, JSON.stringify(p, null, 2), "utf8");
    } catch {
      // ignore in read-only environment
    }
  }

  async listProductions(ownerKey: string): Promise<Production[]> {
    return [...this.memoryCache.productions.values()]
      .filter((p) => p.ownerKey === ownerKey)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async listAllProductions(limit = 100): Promise<Production[]> {
    return [...this.memoryCache.productions.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getProject(id: string): Promise<StudioProject | null> {
    const cached = this.memoryCache.projects.get(id);
    if (cached) return cached;
    try {
      const p = path.join(this.projectsDir, id + ".json");
      if (fs.existsSync(p)) {
        const raw = await fs.promises.readFile(p, "utf8");
        const proj = JSON.parse(raw) as StudioProject;
        this.memoryCache.projects.set(proj.id, proj);
        return proj;
      }
    } catch {
      // ignore
    }
    return null;
  }

  async saveProject(project: StudioProject): Promise<void> {
    this.memoryCache.projects.set(project.id, project);
    try {
      if (!fs.existsSync(this.projectsDir)) await fs.promises.mkdir(this.projectsDir, { recursive: true });
      const filePath = path.join(this.projectsDir, project.id + ".json");
      await fs.promises.writeFile(filePath, JSON.stringify(project, null, 2), "utf8");
    } catch {
      // ignore
    }
  }

  async listProjects(ownerKey: string): Promise<StudioProject[]> {
    return [...this.memoryCache.projects.values()]
      .filter((p) => p.ownerKey === ownerKey)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async incrCounter(key: string, ttlSeconds: number): Promise<number> {
    const now = Date.now();
    const cur = this.memoryCache.counters.get(key);
    if (!cur || cur.exp < now) {
      this.memoryCache.counters.set(key, { n: 1, exp: now + ttlSeconds * 1000 });
      return 1;
    }
    cur.n += 1;
    return cur.n;
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<string | null> {
    const now = Date.now();
    const current = this.memoryCache.locks.get(key);
    if (current && current.exp > now) return null;
    const token = crypto.randomUUID();
    this.memoryCache.locks.set(key, { token, exp: now + ttlSeconds * 1000 });
    return token;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    if (this.memoryCache.locks.get(key)?.token === token) {
      this.memoryCache.locks.delete(key);
    }
  }
}
