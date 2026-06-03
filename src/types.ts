/** 火山引擎图片理解 API 配置 */
export interface VolcConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
  timeout?: number;
}

/** 工具调用请求参数 */
export interface ReadImageArgs {
  /** 图片路径：本地绝对路径或 URL */
  image: string;
  /** 分析指令，默认"详细描述这张图片的内容" */
  prompt?: string;
}

export interface ProviderResponse {
  content: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
