export type ReviewCategory = 'security' | 'correctness' | 'performance' | 'readability' | 'maintainability' | 'tests';
export type SeverityLevel = 'S1' | 'S2' | 'S3' | 'S4';

export interface ReviewRange {
  start: number;
  end: number;
}

export interface ReviewItem {
  category: ReviewCategory;
  severity: SeverityLevel;
  lines: ReviewRange;
  message: string;
  patch: string;
}

export interface ReviewResponse {
  summary: string;
  items: ReviewItem[];
}

export interface ValidationResult {
  ok: boolean;
  data?: ReviewResponse;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReviewCategory(value: unknown): value is ReviewCategory {
  return (
    value === 'security' ||
    value === 'correctness' ||
    value === 'performance' ||
    value === 'readability' ||
    value === 'maintainability' ||
    value === 'tests'
  );
}

function isSeverity(value: unknown): value is SeverityLevel {
  return value === 'S1' || value === 'S2' || value === 'S3' || value === 'S4';
}

export function validateReviewResponse(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'Response is not an object' };
  }

  const summary = value.summary;
  if (typeof summary !== 'string') {
    return { ok: false, error: 'Missing summary' };
  }

  const itemsRaw = value.items;
  if (!Array.isArray(itemsRaw)) {
    return { ok: false, error: 'Items is not an array' };
  }

  const items: ReviewItem[] = [];
  for (const entry of itemsRaw) {
    if (!isRecord(entry)) {
      return { ok: false, error: 'Invalid item' };
    }

    const { category, severity, lines, message, patch } = entry;
    if (!isReviewCategory(category)) {
      return { ok: false, error: 'Invalid category' };
    }
    if (!isSeverity(severity)) {
      return { ok: false, error: 'Invalid severity' };
    }
    if (!isRecord(lines) || typeof lines.start !== 'number' || typeof lines.end !== 'number') {
      return { ok: false, error: 'Invalid line range' };
    }
    if (typeof message !== 'string') {
      return { ok: false, error: 'Invalid message' };
    }
    if (typeof patch !== 'string') {
      return { ok: false, error: 'Invalid patch' };
    }
    items.push({
      category,
      severity,
      lines: {
        start: lines.start,
        end: lines.end,
      },
      message,
      patch,
    });
  }

  return {
    ok: true,
    data: {
      summary,
      items,
    },
  };
}
