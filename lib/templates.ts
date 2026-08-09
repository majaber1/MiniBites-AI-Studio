import type { CreativeStyle, DurationPreset, StoryMode } from "@/lib/types";

export interface CreativeTemplate {
  id: string;
  dish: string;
  description: string;
  style: CreativeStyle;
  storyMode: StoryMode;
  durationPreset: DurationPreset;
  region: "Saudi & Arab" | "Global" | "Seasonal";
  icon: string;
}

export const CREATIVE_TEMPLATES: CreativeTemplate[] = [
  { id: "saudi-kabsa", dish: "Mini Saudi Kabsa", description: "Authentic rice, spices and a warm traditional serving reveal.", style: "traditional", storyMode: "cinematic", durationPreset: "standard", region: "Saudi & Arab", icon: "🍚" },
  { id: "mandi", dish: "Mini Mandi", description: "Smoky miniature oven preparation with a dramatic rice-and-meat reveal.", style: "traditional", storyMode: "satisfying", durationPreset: "extended", region: "Saudi & Arab", icon: "🔥" },
  { id: "kunafa", dish: "Tiny Kunafa", description: "Crisp golden strands, syrup pour and stretchy cheese macro detail.", style: "luxury", storyMode: "asmr", durationPreset: "quick", region: "Saudi & Arab", icon: "🧀" },
  { id: "arabic-coffee", dish: "Mini Arabic Coffee", description: "Roasting, grinding and a graceful dallah pour beside dates.", style: "traditional", storyMode: "cinematic", durationPreset: "standard", region: "Saudi & Arab", icon: "☕" },
  { id: "shawarma", dish: "Mini Shawarma", description: "Street-food carving, sauce and wrap assembly in tiny scale.", style: "street", storyMode: "satisfying", durationPreset: "standard", region: "Saudi & Arab", icon: "🌯" },
  { id: "pizza", dish: "Mini Pizza", description: "Dough stretch, sauce, tiny toppings and bubbling oven reveal.", style: "cozy", storyMode: "satisfying", durationPreset: "standard", region: "Global", icon: "🍕" },
  { id: "burger", dish: "Mini Burger", description: "Sizzling patty, melting cheese and a polished stack reveal.", style: "cinematic", storyMode: "viral_hook", durationPreset: "quick", region: "Global", icon: "🍔" },
  { id: "sushi", dish: "Mini Sushi", description: "Precise knife work and clean roll assembly in macro detail.", style: "macro", storyMode: "asmr", durationPreset: "standard", region: "Global", icon: "🍣" },
  { id: "bakery", dish: "Tiny Bakery", description: "Mini dough shaping, oven rise and a warm pastry collection.", style: "cozy", storyMode: "satisfying", durationPreset: "extended", region: "Global", icon: "🥐" },
  { id: "ramadan", dish: "Mini Ramadan Iftar", description: "Dates, soup and small plates prepared with a respectful festive mood.", style: "traditional", storyMode: "cinematic", durationPreset: "extended", region: "Seasonal", icon: "🌙" },
];

export function getCreativeTemplate(id: string | null): CreativeTemplate | undefined {
  return CREATIVE_TEMPLATES.find((template) => template.id === id);
}
