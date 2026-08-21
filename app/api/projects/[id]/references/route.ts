import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { requireAuth } from "@/lib/security";
import { generateGoogleImage } from "@/lib/providers/google";
import { cleanEnv } from "@/lib/env";
import type { ProjectKitchenReference, CharacterReferenceAsset } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = requireAuth(req);
  if (denied) return denied;

  const store = getStore();
  const project = await store.getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    kitchenReference: project.bible.kitchenReference,
    characters: project.bible.characters ?? [],
    referenceImageUrls: project.bible.referenceImageUrls ?? [],
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = requireAuth(req);
  if (denied) return denied;

  const store = getStore();
  const project = await store.getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  try {
    const body = (await req.json()) as {
      action: "generate_kitchen" | "approve_kitchen" | "generate_character" | "approve_character";
      prompt?: string;
      characterId?: string;
      imageUrl?: string;
      notes?: string;
      scale?: string;
      lighting?: string;
      palette?: string;
    };

    if (body.action === "generate_kitchen") {
      const prompt = body.prompt || project.bible.kitchenReference?.prompt || 
        "Ultra-realistic macro photograph of a 1:12 scale real working miniature kitchen. Wooden countertop, miniature stainless steel burner stove, tiny copper pan, micro chef knife, mini ceramic plate, realistic edible ingredients in tiny portions, soft natural lighting, shallow depth of field, 9:16 vertical composition.";

      let imageUrl = "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"720\" height=\"1280\"><rect width=\"100%\" height=\"100%\" fill=\"%231a1a1a\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23f39c12\" font-size=\"24\">MiniBites Kitchen Reference Preview</text></svg>";
      let modelUsed = "mock";

      if (cleanEnv("GEMINI_API_KEY")) {
        const result = await generateGoogleImage(prompt, { aspectRatio: "9:16" });
        imageUrl = result.imageUrl;
        modelUsed = result.modelUsed;
      }

      const previewRef: ProjectKitchenReference = {
        id: "kitchen_ref_" + Date.now().toString(36),
        name: "MiniBites 1:12 Master Kitchen Reference",
        imageUrl,
        prompt,
        approved: false,
        scale: body.scale ?? "1:12 miniature scale",
        environment: "Real working miniature kitchen with stainless steel mini stove, wooden prep counter, and dollhouse cookware",
        lighting: body.lighting ?? "Soft warm natural daylight and food-studio highlights",
        palette: body.palette ?? "Warm wood, polished steel, ceramic white, fresh culinary colors",
        notes: body.notes ?? "Permanent master kitchen reference for episode continuity.",
      };

      return NextResponse.json({ reference: previewRef, modelUsed });
    }

    if (body.action === "approve_kitchen") {
      if (!body.imageUrl) throw new Error("Image URL is required to approve kitchen reference.");
      const approvedRef: ProjectKitchenReference = {
        id: "kitchen_" + Date.now().toString(36),
        name: "Approved MiniBites 1:12 Kitchen",
        imageUrl: body.imageUrl,
        prompt: body.prompt,
        approved: true,
        approvedAt: new Date().toISOString(),
        scale: body.scale ?? "1:12 miniature scale",
        environment: "Real working miniature kitchen with stainless steel mini stove, wooden prep counter, and dollhouse cookware",
        lighting: body.lighting,
        palette: body.palette,
        notes: body.notes ?? "Creator-approved permanent kitchen reference.",
      };

      project.bible.kitchenReference = approvedRef;
      project.bible.referenceImageUrls = [approvedRef.imageUrl!];
      project.updatedAt = new Date().toISOString();
      await store.saveProject(project);

      return NextResponse.json({ project, kitchenReference: approvedRef });
    }

    if (body.action === "generate_character") {
      const characterId = body.characterId;
      if (!characterId) throw new Error("Character ID is required.");
      const char = project.bible.characters?.find((c) => c.id === characterId);
      if (!char) throw new Error("Character not found.");

      const prompt = body.prompt || ("Polished 3D character portrait for recurring series. Character: " + char.name + ". Role: " + char.role + ". Visual details: " + char.visualNotes + ". Vertical 9:16 portrait.");

      let imageUrl = "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"720\" height=\"1280\"><rect width=\"100%\" height=\"100%\" fill=\"%231a1a1a\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%232ecc71\" font-size=\"24\">Character Reference Preview</text></svg>";
      let modelUsed = "mock";

      if (cleanEnv("GEMINI_API_KEY")) {
        const result = await generateGoogleImage(prompt, { aspectRatio: "9:16" });
        imageUrl = result.imageUrl;
        modelUsed = result.modelUsed;
      }

      const previewAsset: CharacterReferenceAsset = {
        id: "char_ref_" + Date.now().toString(36),
        url: imageUrl,
        label: char.name + " Visual Reference",
        approved: false,
        prompt,
      };

      return NextResponse.json({ asset: previewAsset, characterId, modelUsed });
    }

    if (body.action === "approve_character") {
      const characterId = body.characterId;
      if (!characterId) throw new Error("Character ID is required.");
      if (!body.imageUrl) throw new Error("Image URL is required.");
      const char = project.bible.characters?.find((c) => c.id === characterId);
      if (!char) throw new Error("Character not found.");

      const approvedAsset: CharacterReferenceAsset = {
        id: "asset_" + Date.now().toString(36),
        url: body.imageUrl,
        label: char.name + " Approved Reference",
        approved: true,
        approvedAt: new Date().toISOString(),
        prompt: body.prompt,
      };

      char.referenceAssets = char.referenceAssets ?? [];
      char.referenceAssets.push(approvedAsset);
      char.referenceImageUrls = [approvedAsset.url, ...(char.referenceImageUrls ?? [])];
      project.updatedAt = new Date().toISOString();
      await store.saveProject(project);

      return NextResponse.json({ project, character: char, asset: approvedAsset });
    }

    if (body.action === "generate_environment") {
      const prompt = body.prompt || (
        "Warm cinematic visual anchor of a modern-traditional Saudi coffee corner. Traditional brass Saudi dallah, finjan cups, Al-Qassim dates tray, warm lighting, subtle futuristic holographic accents, vertical 9:16."
      );
      let imageUrl = "data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"720\" height=\"1280\"><rect width=\"100%\" height=\"100%\" fill=\"%231a1a1a\"/><text x=\"50%\" y=\"50%\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%23f39c12\" font-size=\"24\">Environment Reference Preview</text></svg>";
      let modelUsed = "mock";

      if (cleanEnv("GEMINI_API_KEY")) {
        const result = await generateGoogleImage(prompt, { aspectRatio: "9:16" });
        imageUrl = result.imageUrl;
        modelUsed = result.modelUsed;
      }

      return NextResponse.json({
        asset: {
          id: "env_ref_" + Date.now().toString(36),
          url: imageUrl,
          label: "Environment Master Reference",
          approved: false,
          prompt,
        },
        modelUsed,
      });
    }

    if (body.action === "approve_environment") {
      if (!body.imageUrl) throw new Error("Image URL is required.");
      project.bible.referenceImageUrls = [body.imageUrl, ...(project.bible.referenceImageUrls ?? [])];
      project.updatedAt = new Date().toISOString();
      await store.saveProject(project);
      return NextResponse.json({ project, referenceImageUrls: project.bible.referenceImageUrls });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Reference operation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
