import { ConfigManager, Role, getModelForRole } from './config';
import { OllamaClient, ChatMessage, repairJson } from './services/ollamaClient';
import { redactSecrets } from './services/redact';
import { ReviewResponse, validateReviewResponse } from './services/schema';

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  role: Role;
  overrideModel?: string;
  history: ChatHistoryMessage[];
  stream?: boolean;
  onToken?: (token: string) => void;
}

export interface TaskContext {
  content: string;
  source: string;
  truncated: boolean;
  fileName?: string;
  languageId?: string;
}

export class LogosRouter {
  constructor(private readonly config: ConfigManager, private readonly client: OllamaClient) {}

  public async chat(request: ChatRequest): Promise<string> {
    const cfg = this.config.get();
    const model = getModelForRole(cfg, request.role, request.overrideModel);
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(request.role),
      },
      ...request.history.map((entry) => ({
        role: entry.role,
        content: redactSecrets(entry.content),
      })),
    ];

    return this.client.chat({
      model,
      messages,
      stream: request.stream ?? cfg.enableStreaming,
      onToken: request.onToken,
    });
  }

  public async review(context: TaskContext): Promise<ReviewResponse> {
    const cfg = this.config.get();
    const model = getModelForRole(cfg, 'coder');
    const prompt = this.composeReviewPrompt(context, cfg.severityGate);
    const response = await this.client.generate({
      model,
      prompt,
      stream: false,
    });
    return this.parseReviewResponse(response);
  }

  public async refactor(context: TaskContext): Promise<ReviewResponse> {
    const cfg = this.config.get();
    const model = getModelForRole(cfg, 'coder');
    const prompt = this.composeRefactorPrompt(context);
    const response = await this.client.generate({
      model,
      prompt,
      stream: false,
    });
    return this.parseReviewResponse(response);
  }

  public async explain(context: TaskContext): Promise<string> {
    const cfg = this.config.get();
    const model = getModelForRole(cfg, 'coder');
    const prompt = this.composeExplainPrompt(context);
    return this.client.generate({
      model,
      prompt,
      stream: false,
    });
  }

  public async generateDocs(context: TaskContext): Promise<string> {
    const cfg = this.config.get();
    const model = getModelForRole(cfg, 'writer');
    const prompt = this.composeDocsPrompt(context);
    return this.client.generate({
      model,
      prompt,
      stream: false,
    });
  }

  private parseReviewResponse(response: string): ReviewResponse {
    const trimmed = response.trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (error) {
      parsed = repairJson(trimmed);
      if (!parsed) {
        throw new Error(`Logos: Unable to parse model response as JSON.\n${trimmed}`);
      }
    }

    const validation = validateReviewResponse(parsed);
    if (!validation.ok || !validation.data) {
      throw new Error(`Logos: Review response failed validation: ${validation.error ?? 'Unknown error'}`);
    }

    return validation.data;
  }

  private buildSystemPrompt(role: Role): string {
    const base = `You are Logos, a focused ${role} assistant integrated directly into VS Code. You only work with local context provided to you. Provide concise answers, use Markdown for formatting when appropriate, and never mention network calls or remote services.`;
    if (role === 'coder') {
      return `${base} When sharing code, use fenced blocks with language hints. Offer actionable suggestions and highlight potential risks.`;
    }
    if (role === 'writer') {
      return `${base} Help craft clear prose, documentation, and release notes while preserving technical accuracy.`;
    }
    if (role === 'scratchpad') {
      return `${base} Think out loud, explore ideas, and ask clarifying questions if context is ambiguous.`;
    }
    return base;
  }

  private composeReviewPrompt(context: TaskContext, severityGate: string): string {
    const header = `You are Logos, performing a pragmatic code review. Analyze the provided input and produce JSON matching this schema exactly:\n{\n  "summary": string,\n  "items": [\n    {\n      "category": "security|correctness|performance|readability|maintainability|tests",\n      "severity": "S1|S2|S3|S4",\n      "lines": {"start": number, "end": number},\n      "message": string,\n      "patch": string\n    }\n  ]\n}`;
    const severityMsg = severityGate === 'off'
      ? 'Report all meaningful findings.'
      : severityGate === 'S1S2'
        ? 'Focus on severity S1 and S2 issues. Mention lower severity items only if they unlock a fix.'
        : 'Prioritize severity S1 issues only.';
    const truncatedNotice = context.truncated ? '\nNOTE: The input was truncated. Do not assume missing context.' : '';

    return `${header}\n${severityMsg}\n- Keep patches minimal and valid unified diffs targeted to the snippet.\n- Use empty string for patch if no fix is suggested.\n- Reference lines relative to the provided context.\n- Respond with JSON only.\nContext source: ${context.source}${context.fileName ? `\nFile: ${context.fileName}` : ''}${context.languageId ? `\nLanguage: ${context.languageId}` : ''}${truncatedNotice}\n\n<CONTEXT>\n${redactSecrets(context.content)}\n</CONTEXT>`;
  }

  private composeRefactorPrompt(context: TaskContext): string {
    const truncatedNotice = context.truncated ? '\nNOTE: The input was truncated. Focus on the visible section only.' : '';
    return `You are Logos, assisting with a safe refactor. Return JSON using the schema described earlier (summary, items[]) where each item describes a refactor opportunity and provides a unified diff patch to apply.\nGuidance:\n- Ensure patches apply cleanly and keep behavior correct.\n- Keep patches minimal and targeted.\n- Explain the benefit in the message.\n- Use empty patch string if no change is required.${truncatedNotice}\n\n<CONTEXT>\n${redactSecrets(context.content)}\n</CONTEXT>`;
  }

  private composeExplainPrompt(context: TaskContext): string {
    const truncatedNotice = context.truncated ? '\nNOTE: Context truncated; mention assumptions explicitly.' : '';
    return `Explain the following code or text for a teammate. Provide:\n1. A plain-language summary.\n2. Key behaviors or responsibilities.\n3. Potential risks or edge cases.\n4. Suggestions for tests.\nKeep it concise and actionable.${truncatedNotice}\n\n<CONTEXT>\n${redactSecrets(context.content)}\n</CONTEXT>`;
  }

  private composeDocsPrompt(context: TaskContext): string {
    const truncatedNotice = context.truncated ? '\nNOTE: Context truncated; scope docs to visible code only.' : '';
    return `Write documentation for the provided selection. Include:\n- A heading or title.\n- A short "What it does" section.\n- A "Why it matters" note.\n- Usage or examples if relevant.\nKeep tone professional and concise.${truncatedNotice}\n\n<CONTEXT>\n${redactSecrets(context.content)}\n</CONTEXT>`;
  }
}
