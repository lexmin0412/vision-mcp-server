# vision-mcp Agent Guide

## 项目概述

vision-mcp 是一个 MCP (Model Context Protocol) Server，为纯文本 LLM 提供图片理解能力。它通过 MCP 协议暴露 `read_image` 工具，接收图片路径/URL，调用多模态 API，返回文字描述。

## 项目结构

```
vision-mcp/
├── src/
│   ├── index.ts            # MCP Server 入口，工具注册，stdio 通信
│   ├── types.ts            # 类型定义（VolcConfig, ReadImageArgs, ProviderResponse）
│   └── providers/
│       └── volc.ts         # 火山引擎 API 适配层
├── package.json
├── tsconfig.json
├── .mcp.json               # OpenCode/Claude 本地 MCP 配置示例
├── README.md
├── LICENSE
└── AGENTS.md
```

## 核心架构

### 分层设计

1. **协议层** (`src/index.ts`) — 处理 MCP stdio 通信，注册 `read_image` 工具，解析请求参数
2. **提供商适配层** (`src/providers/`) — 封装各厂商 API 的差异
3. **共享类型** (`src/types.ts`) — 统一请求/响应/配置类型

### 数据流

```
MCP Client (OpenCode/Claude)
  → stdin: JSON-RPC (tools/list, tools/call)
  → index.ts: 解析请求 → 调用 providers/xxx.ts
  → providers/xxx.ts: 处理图片 → 调厂商 API → 返回文字
  → stdout: JSON-RPC response
```

## 关键设计决策

### 1. 图片处理策略

- **远程 URL**（`https://...`）：直接透传，让 API 服务端去拉取
- **本地文件**：读文件 → 可选压缩 → base64 编码 → `data:image` URL
- **压缩**：超过 `MAX_DIM`（默认 1024px）的图片用 sharp 等比缩小，减少 token 消耗

### 2. 可降级设计

sharp 是 optional dependency。如果用户环境没装 sharp，压缩逻辑静默失败，走原图发送。通过 `try/catch` + dynamic `import()` 实现。

### 3. 超时控制

每个请求有独立的 AbortController，默认 60 秒超时。超时自动中断 fetch，不会挂死。

## 如何添加新厂商

在 `src/providers/` 下新建文件，实现 `readImage` 函数：

```typescript
import type { VolcConfig, ProviderResponse, ReadImageArgs } from "../types.js";

export async function readImage(
  args: ReadImageArgs,
  config: VolcConfig
): Promise<ProviderResponse> {
  // 你的实现
}
```

然后在 `src/index.ts` 中导入并在 `CallToolRequestSchema` handler 中调用。

## API 参考

### VolcConfig

```typescript
interface VolcConfig {
  apiKey: string;      // API 密钥
  model: string;       // 模型名称
  baseUrl: string;     // API 端点
  timeout?: number;    // 超时毫秒数
}
```

### ReadImageArgs

```typescript
interface ReadImageArgs {
  image: string;       // 本地路径或 http(s) URL
  prompt?: string;     // 分析指令
}
```

### ProviderResponse

```typescript
interface ProviderResponse {
  content: string;     // 图片理解结果
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

## MCP 工具接口

### read_image

- description: 理解图片内容并返回文字描述，支持本地路径与 URL
- inputSchema:
  - `image` (string, required): 图片来源
  - `prompt` (string, optional): 具体提问
- output: `content` (text array)

## 日志

日志写入 `~/.vision-mcp/vision-mcp.log`，同时输出到 stderr。包含启动配置、每次调用的参数、成功/失败信息。
