import { AiExplanation, AiMigrationPlan } from './ai-provider';

/** Extract JSON from AI response that may contain markdown, code fences, or extra text. */
export function extractJson(text: string): string {
  const trimmed = text.trim();

  // 1. Try: response is already pure JSON
  if (trimmed.startsWith('{')) {
    const end = findClosingBrace(trimmed);
    if (end >= 0) return trimmed.slice(0, end + 1);
  }

  // 2. Try: JSON inside ```json ... ``` or ``` ... ```
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    const inner = fenceMatch[1].trim();
    if (inner.startsWith('{')) return inner;
  }

  // 3. Try: find first { and last } in the response
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  // 4. Give up, return raw text
  return trimmed;
}

/** Parse AI response into AiExplanation, with text fallback. */
export function parseExplanation(rawResponse: string, fallbackSuggestion?: string): AiExplanation {
  const json = extractJson(rawResponse);

  try {
    const parsed = JSON.parse(json);
    return {
      summary: parsed.summary || '',
      whyItMatters: parsed.whyItMatters || '',
      howToFix: parsed.howToFix || '',
      codeExample: parsed.codeExample || undefined,
    };
  } catch {
    // JSON failed - treat the whole response as a text explanation
    return parseTextExplanation(rawResponse, fallbackSuggestion);
  }
}

/** Parse AI response into AiMigrationPlan, with text fallback. */
export function parseMigrationPlan(rawResponse: string): AiMigrationPlan {
  const json = extractJson(rawResponse);

  try {
    const parsed = JSON.parse(json);
    return {
      steps: Array.isArray(parsed.steps) ? parsed.steps : [parsed.steps || rawResponse.slice(0, 500)],
      estimatedEffort: parsed.estimatedEffort || 'Unknown',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
    };
  } catch {
    // JSON failed - extract steps from numbered list in text
    return parseTextMigrationPlan(rawResponse);
  }
}

/** Best-effort extraction of explanation from plain text response. */
function parseTextExplanation(text: string, fallbackSuggestion?: string): AiExplanation {
  const cleaned = text.trim();

  // Try to split by markdown headers (## Summary, ## Why, etc.)
  const headerSections = splitByHeaders(cleaned);
  if (headerSections) {
    return {
      summary: headerSections.summary || cleaned.slice(0, 500),
      whyItMatters: headerSections.why || '',
      howToFix: headerSections.fix || fallbackSuggestion || '',
      codeExample: extractCodeBlock(cleaned) || undefined,
    };
  }

  // Try keyword-based paragraph splitting
  const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 0);
  if (paragraphs.length >= 3) {
    return {
      summary: paragraphs[0].trim(),
      whyItMatters: paragraphs[1].trim(),
      howToFix: paragraphs.slice(2).join('\n\n').trim(),
      codeExample: extractCodeBlock(cleaned) || undefined,
    };
  }

  // Single block of text - put it all in summary, use rule suggestion for fix
  return {
    summary: cleaned.slice(0, 1000),
    whyItMatters: '',
    howToFix: fallbackSuggestion || '',
    codeExample: extractCodeBlock(cleaned) || undefined,
  };
}

/** Try to split response by markdown-style headers. */
function splitByHeaders(text: string): { summary?: string; why?: string; fix?: string } | null {
  const headerRegex = /^#+\s+(.+)$/gm;
  if (!headerRegex.test(text)) return null;

  const sections: Record<string, string> = {};
  const parts = text.split(/^#+\s+/m).filter(p => p.trim().length > 0);

  for (const part of parts) {
    const firstNewline = part.indexOf('\n');
    if (firstNewline < 0) continue;
    const title = part.slice(0, firstNewline).toLowerCase().trim();
    const body = part.slice(firstNewline).trim();

    if (title.includes('summary') || title.includes('explanation') || title.includes('issue')) {
      sections.summary = body;
    } else if (title.includes('why') || title.includes('matter') || title.includes('impact') || title.includes('problem')) {
      sections.why = body;
    } else if (title.includes('fix') || title.includes('how') || title.includes('solution') || title.includes('resolve')) {
      sections.fix = body;
    }
  }

  return Object.keys(sections).length > 0 ? sections : null;
}

/** Best-effort extraction of migration plan from plain text. */
function parseTextMigrationPlan(text: string): AiMigrationPlan {
  const steps: string[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const stepMatch = line.match(/^\s*(?:\d+[.)]\s*|[-*]\s+)(.+)/);
    if (stepMatch) {
      steps.push(stepMatch[1].trim());
    }
  }

  return {
    steps: steps.length > 0 ? steps : [text.slice(0, 500)],
    estimatedEffort: 'Unknown',
    risks: [],
  };
}

/** Extract a code block from text. */
function extractCodeBlock(text: string): string | undefined {
  const match = text.match(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/);
  return match ? match[1].trim() : undefined;
}

function findClosingBrace(text: string): number {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
