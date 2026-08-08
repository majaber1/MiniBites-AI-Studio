import type { VideoProvider } from "./types";
import type { ProviderCapabilities } from "./types";
import { FalProvider } from "./fal";
import { WanSelfHostedProvider } from "./wan";
import { MockProvider } from "./mock";
import { GoogleVeoProvider } from "./google";
import { cleanEnv } from "@/lib/env";
import type { ProviderChoice } from "@/lib/types";

function build(which: string): VideoProvider {
  if (which === "mock") return new MockProvider();
  if (which === "wan") return new WanSelfHostedProvider();
  if (which === "google") return new GoogleVeoProvider();
  return new FalProvider();
}

/**
 * Per-production provider selection. `choice` (from the dashboard) wins;
 * otherwise VIDEO_PROVIDER = fal | wan | mock (default: fal).
 */
export function getVideoProvider(choice?: ProviderChoice): VideoProvider {
  const which = (choice ?? cleanEnv("VIDEO_PROVIDER") ?? "fal").toLowerCase();
  return build(which);
}

export interface ProviderOption {
  id: ProviderChoice;
  name: string;
  configured: boolean;
  isMock: boolean;
  hint: string;
  isDefault: boolean;
  capabilities: ProviderCapabilities;
}

/** Options for the dashboard provider selector, with real configured state. */
export function listProviderOptions(): ProviderOption[] {
  const def = (cleanEnv("VIDEO_PROVIDER") ?? "fal").toLowerCase();
  return (["fal", "google", "wan", "mock"] as ProviderChoice[]).map((id) => {
    const prov = build(id);
    return {
      id,
      name: prov.name,
      configured: prov.configured,
      isMock: prov.isMock,
      hint: prov.configurationHint,
      isDefault: id === def,
      capabilities: prov.capabilities,
    };
  });
}
