import { readFile } from "node:fs/promises";
import type { VolcConfig, ProviderResponse, ReadImageArgs } from "../types.js";

const TIMEOUT_MS = 60_000;
const MAX_DIM = 1024;

function inferMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "jpg": case "jpeg": return "image/jpeg";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "bmp": return "image/bmp";
    default: return "image/png";
  }
}

async function resolveImageUrl(image: string): Promise<string> {
  if (image.startsWith("http://") || image.startsWith("https://")) return image;

  const raw = await readFile(image);
  const mime = inferMimeType(image);

  if (mime !== "image/png" && mime !== "image/jpeg") {
    return `data:${mime};base64,${raw.toString("base64")}`;
  }

  const encode = (b: Uint8Array) =>
    Buffer.from(b.buffer, b.byteOffset, b.byteLength).toString("base64");

  let buf: Uint8Array = raw;
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(raw).metadata();
    if ((meta.width && meta.width > MAX_DIM) || (meta.height && meta.height > MAX_DIM)) {
      buf = await sharp(raw)
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
        .toBuffer();
    }
  } catch {}

  return `data:${mime};base64,${encode(buf)}`;
}

export async function readImage(
  args: ReadImageArgs,
  config: VolcConfig
): Promise<ProviderResponse> {
  const imageUrl = await resolveImageUrl(args.image);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout ?? TIMEOUT_MS);

  try {
    const res = await fetch(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: args.prompt ?? "详细描述这张图片的内容" },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`[火山引擎] ${res.status}: ${body}`);
    }

    const data = (await res.json()) as {
      choices: [{ message: { content: string } }];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0].message.content,
      usage: data.usage
        ? {
            inputTokens: data.usage.prompt_tokens,
            outputTokens: data.usage.completion_tokens,
          }
        : undefined,
    };
  } finally {
    clearTimeout(timer);
  }
}
