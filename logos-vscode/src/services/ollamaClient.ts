import { ConfigManager } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface GenerateOptions {
  model: string;
  prompt: string;
  stream?: boolean;
  onToken?: (token: string) => void;
}

export class OllamaClient {
  constructor(private readonly config: ConfigManager) {}

  public async chat(options: ChatOptions): Promise<string> {
    const cfg = this.config.get();
    const stream = options.stream ?? cfg.enableStreaming;
    const url = this.joinUrl('/api/chat');
    const body = JSON.stringify({
      model: options.model,
      messages: options.messages,
      stream,
    });

    const response = await this.performFetch(url, body);

    if (stream && response.body) {
      return this.consumeStream(response.body, (chunk) => {
        const token = this.extractChatToken(chunk);
        if (token) {
          options.onToken?.(token);
        }
        return token;
      });
    }

    const json = await this.readJson(response);
    const content = json?.message?.content ?? '';
    if (content && options.onToken) {
      options.onToken(content);
    }
    return content;
  }

  public async generate(options: GenerateOptions): Promise<string> {
    const cfg = this.config.get();
    const stream = options.stream ?? cfg.enableStreaming;
    const url = this.joinUrl('/api/generate');
    const body = JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      stream,
    });

    const response = await this.performFetch(url, body);
    if (stream && response.body) {
      return this.consumeStream(response.body, (chunk) => {
        const token = this.extractGenerateToken(chunk);
        if (token) {
          options.onToken?.(token);
        }
        return token;
      });
    }

    const json = await this.readJson(response);
    const text = json?.response ?? '';
    if (text && options.onToken) {
      options.onToken(text);
    }
    return text;
  }

  private async performFetch(url: string, body: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });
    } catch (error: unknown) {
      throw this.translateNetworkError(error);
    }

    if (!response.ok) {
      const message = await safeReadText(response);
      throw new Error(`Ollama request failed (${response.status}): ${message}`);
    }

    return response;
  }

  private async consumeStream(stream: ReadableStream<Uint8Array>, mapper: (chunk: string) => string | undefined): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let aggregate = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const text = part.trim();
        if (!text) {
          continue;
        }
        try {
          const mapped = mapper(text);
          if (mapped) {
            aggregate += mapped;
          }
        } catch (error) {
          console.error('Logos: Failed to parse streaming chunk', error);
        }
      }
    }

    if (buffer.trim()) {
      try {
        const mapped = mapper(buffer.trim());
        if (mapped) {
          aggregate += mapped;
        }
      } catch (error) {
        console.error('Logos: Failed to parse trailing streaming chunk', error);
      }
    }

    return aggregate;
  }

  private extractChatToken(chunk: string): string | undefined {
    try {
      const parsed = JSON.parse(chunk);
      const token = parsed?.message?.content ?? '';
      return typeof token === 'string' ? token : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private extractGenerateToken(chunk: string): string | undefined {
    try {
      const parsed = JSON.parse(chunk);
      const token = parsed?.response ?? '';
      return typeof token === 'string' ? token : undefined;
    } catch (error) {
      return undefined;
    }
  }

  private async readJson(response: Response): Promise<any> {
    const text = await safeReadText(response);
    try {
      return JSON.parse(text);
    } catch (error) {
      const repaired = repairJson(text);
      if (repaired) {
        return repaired;
      }
      throw new Error(`Failed to parse JSON response: ${String(error)}\n${text}`);
    }
  }

  private translateNetworkError(error: unknown): Error {
    if (error instanceof Error && (error as any).cause && typeof (error as any).cause === 'object') {
      const cause = (error as any).cause;
      if (cause && (cause as any).code === 'ECONNREFUSED') {
        return new Error('Unable to reach Ollama. Ensure Ollama is running (ollama serve) and accessible at the configured API base URL.');
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    return new Error(`Ollama request failed: ${message}`);
  }

  private joinUrl(path: string): string {
    const base = this.config.get().apiBaseUrl.replace(/\/$/, '');
    return `${base}${path}`;
  }
}

export function repairJson(raw: string): any | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    // Continue
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate);
    } catch (error) {
      // Continue
    }
  }

  const withoutTrailingComma = trimmed.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(withoutTrailingComma);
  } catch (error) {
    // Continue
  }

  for (let i = trimmed.length; i > 0; i--) {
    const slice = trimmed.slice(0, i);
    if (!slice.trim()) {
      continue;
    }
    try {
      return JSON.parse(slice);
    } catch (error) {
      // Continue until minimal parse
    }
  }

  return undefined;
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    console.error('Logos: Failed to read response body', error);
    return '';
  }
}
