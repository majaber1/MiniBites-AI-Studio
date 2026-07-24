import type { Production } from "../types";
import type { Store } from "./index";

/** Durable store backed by the Upstash Redis REST API (no SDK required). */
export class UpstashStore implements Store {
  readonly durable = true;
  readonly name = "Upstash Redis";
  constructor(private url: string, private token: string) {}

  private async cmd<T = unknown>(command: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Storage error (HTTP ${res.status}). Check Upstash credentials.`);
    const data = (await res.json()) as { result: T };
    return data.result;
  }

  async getProduction(id: string) {
    const raw = await this.cmd<string | null>(["GET", `mb:prod:${id}`]);
    return raw ? (JSON.parse(raw) as Production) : null;
  }
  async saveProduction(p: Production) {
    await this.cmd(["SET", `mb:prod:${p.id}`, JSON.stringify(p)]);
    await this.cmd(["ZADD", `mb:owner:${p.ownerKey}`, Date.parse(p.createdAt), p.id]);
  }
  async listProductions(ownerKey: string) {
    const ids = await this.cmd<string[]>(["ZREVRANGE", `mb:owner:${ownerKey}`, 0, 49]);
    const out: Production[] = [];
    for (const id of ids ?? []) {
      const p = await this.getProduction(id);
      if (p) out.push(p);
    }
    return out;
  }
  async incrCounter(key: string, ttlSeconds: number) {
    const n = await this.cmd<number>(["INCR", `mb:ctr:${key}`]);
    if (n === 1) await this.cmd(["EXPIRE", `mb:ctr:${key}`, ttlSeconds]);
    return n;
  }
}
