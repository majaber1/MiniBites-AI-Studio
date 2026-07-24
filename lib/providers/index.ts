import type { VideoProvider } from "./types";
import { FalProvider } from "./fal";
import { WanSelfHostedProvider } from "./wan";
import { MockProvider } from "./mock";

/** Selected with VIDEO_PROVIDER = fal | wan | mock (default: fal). */
export function getVideoProvider(): VideoProvider {
  const which = (process.env.VIDEO_PROVIDER ?? "fal").toLowerCase();
  if (which === "mock") return new MockProvider();
  if (which === "wan") return new WanSelfHostedProvider();
  return new FalProvider();
}
