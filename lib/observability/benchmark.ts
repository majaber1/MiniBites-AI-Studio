// ---------------------------------------------------------------------------
// Kiswani AI Studio — Benchmark & Route Analytics Aggregator
// ---------------------------------------------------------------------------

import type { Production } from "../types";
import type { BenchmarkEntry } from "./types";
import { getAttempts, getQualityReview } from "./tracker";

export function aggregateBenchmarks(productions: Production[]): BenchmarkEntry[] {
  const groups = new Map<string, {
    project: string;
    task: string;
    route: string;
    model: string;
    channel: string;
    attempts: number;
    techSuccesses: number;
    accepted: number;
    rejected: number;
    latencies: number[];
    estimatedCosts: number[];
    actualCosts: number[];
  }>();

  for (const p of productions) {
    const attempts = getAttempts(p.id);
    const quality = getQualityReview(p.id);
    const projectName = p.projectName ?? "Studio Project";
    const task = "Short-form Video Generation";
    const model = p.selectedVideoModel || p.provider;
    const channel = p.providerChoice === "google" ? "Gemini API" : p.providerChoice === "fal" ? "fal.ai API" : "Local Mock";
    const route = `${model} (${channel})`;
    const key = `${p.projectId ?? "general"}_${model}_${channel}`;

    const current = groups.get(key) ?? {
      project: projectName,
      task,
      route,
      model,
      channel,
      attempts: 0,
      techSuccesses: 0,
      accepted: 0,
      rejected: 0,
      latencies: [],
      estimatedCosts: [],
      actualCosts: [],
    };

    if (attempts.length > 0) {
      for (const a of attempts) {
        current.attempts += 1;
        if (a.result === "SUCCESS") current.techSuccesses += 1;
        if (a.durationMs) current.latencies.push(a.durationMs);
        if (a.estimatedCostUsd) current.estimatedCosts.push(a.estimatedCostUsd);
        if (a.actualCostUsd) current.actualCosts.push(a.actualCostUsd);
      }
    } else {
      current.attempts += p.shots.length || 1;
      const completed = p.shots.filter((s) => s.status === "completed").length;
      current.techSuccesses += completed;
      if (p.usage?.estimatedCostUsd) current.estimatedCosts.push(p.usage.estimatedCostUsd);
    }

    if (p.approved || quality.humanQualityState === "ACCEPT" || quality.humanQualityState === "ACCEPTABLE") {
      current.accepted += 1;
    } else if (quality.humanQualityState === "REJECT") {
      current.rejected += 1;
    }

    groups.set(key, current);
  }

  // Convert to BenchmarkEntry array
  const entries: BenchmarkEntry[] = [];
  for (const item of groups.values()) {
    const totalRuns = item.attempts || 1;
    const avgLatency = item.latencies.length ? Math.round(item.latencies.reduce((a, b) => a + b, 0) / item.latencies.length) : null;
    const avgEstCost = item.estimatedCosts.length ? item.estimatedCosts.reduce((a, b) => a + b, 0) / item.estimatedCosts.length : null;
    const avgActCost = item.actualCosts.length ? item.actualCosts.reduce((a, b) => a + b, 0) / item.actualCosts.length : null;

    const totalAccepted = item.accepted;
    const costPerAccepted = totalAccepted > 0 && avgActCost !== null ? (avgActCost * item.attempts) / totalAccepted : null;

    entries.push({
      project: item.project,
      task: item.task,
      route: item.route,
      model: item.model,
      channel: item.channel,
      attempts: item.attempts,
      technicalSuccessPercent: Math.round((item.techSuccesses / totalRuns) * 100),
      acceptedPercent: Math.round((item.accepted / (item.accepted + item.rejected || 1)) * 100),
      rejectedPercent: Math.round((item.rejected / (item.accepted + item.rejected || 1)) * 100),
      averageLatencyMs: avgLatency,
      estimatedCostUsd: avgEstCost ? Number(avgEstCost.toFixed(3)) : null,
      actualCostUsd: avgActCost ? Number(avgActCost.toFixed(3)) : null,
      costPerAcceptedOutputUsd: costPerAccepted ? Number(costPerAccepted.toFixed(3)) : null,
    });
  }

  return entries;
}
