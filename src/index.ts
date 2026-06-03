#!/usr/bin/env node

import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readImage as callVolc } from "./providers/volc.js";
import type { VolcConfig } from "./types.js";
import pkg from '../package.json' with { type: "json" };

const LOG_DIR = join(homedir(), ".vision-mcp");
const LOG_FILE = join(LOG_DIR, "vision-mcp.log");

async function log(level: string, msg: string, data?: unknown) {
  const ts = new Date().toISOString();
  const line = data
    ? `[${ts}] [${level}] ${msg} ${JSON.stringify(data)}\n`
    : `[${ts}] [${level}] ${msg}\n`;
  process.stderr.write(line);
  try {
    await appendFile(LOG_FILE, line);
  } catch {}
}

await mkdir(LOG_DIR, { recursive: true }).catch(() => {});

const API_KEY = process.env.VOLC_API_KEY;
if (!API_KEY) {
  await log("FATAL", "需要设置 VOLC_API_KEY 环境变量");
  process.exit(1);
}

const config: VolcConfig = {
  apiKey: API_KEY,
  model: process.env.VISION_MODEL ?? "doubao-seed-2-0-lite-260428",
  baseUrl:
    process.env.VISION_BASE_URL ??
    "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  timeout: parseInt(process.env.VISION_TIMEOUT_MS ?? "60000", 10),
};

await log("INFO", `启动配置: model=${config.model}`);

const server = new Server(
  { name: "vision-mcp", version: pkg.version },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

server.setRequestHandler(ListToolsRequestSchema, async () => {
  await log("DEBUG", "列出工具");
  return {
    tools: [
      {
        name: "read_image",
        description: "理解图片内容并返回文字描述，支持本地路径与 URL",
        inputSchema: {
          type: "object",
          properties: {
            image: {
              type: "string",
              description: "图片来源，支持本地绝对路径或 http(s) 链接",
            },
            prompt: {
              type: "string",
              description: "对图片的具体提问，例如：这个报错信息是什么、描述图表的趋势",
              default: "详细描述这张图片的内容",
            },
          },
          required: ["image"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name !== "read_image") {
    throw new Error(`未知工具: ${req.params.name}`);
  }

  const { image, prompt } = req.params.arguments as {
    image: string;
    prompt?: string;
  };

  await log("INFO", `调用 read_image: image=${image}`);
  await log("DEBUG", `参数: prompt="${prompt ?? "默认"}"`);

  try {
    const result = await callVolc({ image, prompt }, config);

    await log("INFO", "图片理解成功", {
      contentLength: result.content.length,
      usage: result.usage,
    });

    const contents = [{ type: "text" as const, text: result.content }];

    if (result.usage) {
      contents.push({
        type: "text",
        text: `[用量] 输入 ${result.usage.inputTokens} / 输出 ${result.usage.outputTokens} tokens`,
      });
    }

    return { content: contents };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log("ERROR", `图片理解失败: ${msg}`, {
      image,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return {
      content: [{ type: "text" as const, text: `图片理解失败: ${msg}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
await log("INFO", "vision-mcp 已就绪");
