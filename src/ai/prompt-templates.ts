import { AnalysisDiagnostic } from '../analyzers/analyzer.types';

export function buildExplainPrompt(diagnostic: AnalysisDiagnostic, fileContent: string): string {
  const relevantLines = extractRelevantLines(fileContent, diagnostic.location.line, 10);

  return `You are an Angular expert code reviewer. Explain this issue found in an Angular codebase.

Rule: ${diagnostic.ruleId}
Message: ${diagnostic.message}
Severity: ${diagnostic.severity}
File: ${diagnostic.location.file.relativePath}
Line: ${diagnostic.location.line + 1}

Relevant code:
${relevantLines}

${diagnostic.suggestion ? `Tool suggestion: ${diagnostic.suggestion}` : ''}

IMPORTANT: Respond with ONLY a JSON object, no markdown, no code fences, no extra text. Use this exact schema:
{"summary":"1-2 sentence explanation","whyItMatters":"why this is a problem","howToFix":"step-by-step fix for this specific code","codeExample":"fixed code snippet or empty string"}`;
}

export function buildMigrationPrompt(fileContent: string, targetPattern: string): string {
  return `You are an Angular migration expert. Generate a migration plan for this component.

Target migration: ${targetPattern}

Current code:
${fileContent.slice(0, 3000)}

IMPORTANT: Respond with ONLY a JSON object, no markdown, no code fences, no extra text. Use this exact schema:
{"steps":["Step 1: ...","Step 2: ..."],"estimatedEffort":"Small or Medium or Large","risks":["Risk 1: ..."]}`;
}

function extractRelevantLines(content: string, targetLine: number, context: number): string {
  const lines = content.split('\n');
  const start = Math.max(0, targetLine - context);
  const end = Math.min(lines.length, targetLine + context + 1);

  return lines
    .slice(start, end)
    .map((line, i) => {
      const lineNum = start + i + 1;
      const marker = lineNum === targetLine + 1 ? '>>>' : '   ';
      return `${marker} ${lineNum}: ${line}`;
    })
    .join('\n');
}
