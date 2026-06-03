# vision-mcp

给纯文本大模型加上视觉能力的 MCP Server。通过调用多模态 API，让 DeepSeek、GLM、Kimi 等纯文本模型也能"看懂"图片。

## 安装

```bash
git clone https://github.com/你的用户名/vision-mcp.git
cd vision-mcp
pnpm install
pnpm build
```

## 配置

设置火山引擎 API Key：

```bash
export VOLC_API_KEY=你的火山引擎API Key
```

可选环境变量：

| 变量 | 默认值 | 说明 |
|:-----|:------|:-----|
| `VISION_MODEL` | `doubao-seed-2-0-lite-260428` | 多模态模型名称 |
| `VISION_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | API 端点 |
| `VISION_TIMEOUT_MS` | `60000` | 请求超时（毫秒） |

## MCP 配置

### Claude Desktop

编辑 `claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "vision-mcp": {
      "command": "node",
      "args": ["/绝对路径/vision-mcp/dist/index.js"],
      "env": {
        "VOLC_API_KEY": "你的火山引擎API Key"
      }
    }
  }
}
```

### OpenCode

编辑 `opencode.jsonc`，在 `mcp` 字段下添加：

```json
{
  "mcp": {
    "vision-mcp": {
      "type": "local",
      "command": ["node", "/绝对路径/vision-mcp/dist/index.js"],
      "enabled": true,
      "environment": {
        "VOLC_API_KEY": "你的火山引擎API Key"
      }
    }
  }
}
```

## 工具

### `read_image`

理解图片内容并返回文字描述。

**参数：**

| 参数 | 必填 | 说明 |
|:-----|:----:|:-----|
| `image` | ✅ | 图片来源：本地绝对路径或 http(s) URL |
| `prompt` | ❌ | 对图片的具体提问，默认"详细描述这张图片的内容" |

**示例：**

```
read_image image=/Users/xxx/截图.png prompt="这个报错信息是什么"
read_image image=https://example.com/chart.png prompt="描述这张图表的趋势"
```

## 配置

| 环境变量 | 默认值 | 说明 |
|:---------|:------|:-----|
| `VOLC_API_KEY` | — | **必填**。火山引擎 API Key |
| `VISION_MODEL` | `doubao-seed-2-0-lite` | 多模态模型名称 |
| `VISION_BASE_URL` | `https://ark.cn-beijing.volces.com/api/v3/chat/completions` | API 端点 |
| `VISION_TIMEOUT_MS` | `60000` | 请求超时（毫秒） |
| `VISION_MAX_DIM` | `1024` | 本地图片压缩阈值（像素） |

## 工作原理

```
你（含图片路径的文字 prompt）
  ↓
纯文本 LLM（DeepSeek / GLM / 其他）
  ↓ 遇到图片 → 调用 read_image 工具
vision-mcp MCP Server
  ↓ 本地图片 → base64 编码 + 可选压缩
  ↓ 远程图片 → 直接传 URL
多模态 API（火山引擎 Doubao）
  ↓ 返回图片文字描述
纯文本 LLM 拿到描述后继续回答你的问题
```

## 支持的提供商

目前内置火山引擎 Doubao 系列模型。架构设计上通过 `providers/` 目录隔离厂商差异，欢迎提交新厂商的适配。

## License

MIT
