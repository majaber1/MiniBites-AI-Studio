import type { AgentId } from "../types";

export const AGENT_DEFS: Array<{ id: AgentId; name: string; role: string }> = [
  { id: "orchestrator", name: "Orchestrator", role: "Validates the request and coordinates every stage." },
  { id: "recipe", name: "Story / Recipe Agent", role: "Builds the narrative or recipe foundation appropriate to the project." },
  { id: "miniature_director", name: "World / Style Director", role: "Applies the Project Bible, character references, world and visual continuity." },
  { id: "shot_director", name: "Shot Director", role: "Builds the complete 9:16 storyboard." },
  { id: "prompt", name: "Prompt Agent", role: "Writes provider-ready prompts and continuity guards." },
  { id: "video", name: "Video Agent", role: "Submits real jobs to the selected provider and tracks them." },
  { id: "continuity", name: "Continuity Agent", role: "Checks the shared prompt contract across shots." },
  { id: "quality", name: "Quality Agent", role: "Routes generated clips to honest automated checks and human review." },
  { id: "assembly", name: "Assembly Agent", role: "Combines accepted shots into one vertical MP4." },
  { id: "publishing", name: "Publishing Agent", role: "Prepares platform-specific social publishing packages." },
];
