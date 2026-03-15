import Anthropic from '@anthropic-ai/sdk';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';

export interface EstimateResult {
  hours: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
  sessionId: string;
}

function buildPrompt(issue: {
  title: string;
  description: string | null;
  type: string;
  priority: string;
  children: { title: string; type: string }[];
}): string {
  const childrenText =
    issue.children.length > 0
      ? `\nChild issues (${issue.children.length}):\n` +
        issue.children.map((c) => `  - [${c.type}] ${c.title}`).join('\n')
      : '';

  return `You are an expert software project estimator. Estimate the effort in hours for the following task.

Task details:
- Type: ${issue.type}
- Priority: ${issue.priority}
- Title: ${issue.title}
- Description: ${issue.description || '(no description)'}${childrenText}

Respond ONLY with a valid JSON object in this exact format (no markdown, no extra text):
{
  "hours": <number between 0.5 and 200>,
  "confidence": "<low|medium|high>",
  "reasoning": "<1-3 sentences explaining the estimate>"
}

Guidelines:
- SUBTASK: 0.5–8h
- TASK: 1–24h
- STORY: 4–40h
- EPIC: 20–200h
- BUG: 0.5–16h
- confidence=high when description is detailed; low when sparse
- Account for children count in estimation`;
}

export async function estimateIssue(issueId: string, userId: string): Promise<EstimateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError(503, 'ANTHROPIC_API_KEY not configured');

  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { children: { select: { title: true, type: true } } },
  });
  if (!issue) throw new AppError(404, 'Issue not found');

  const client = new Anthropic({ apiKey });
  const startedAt = new Date();

  const prompt = buildPrompt(issue);

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const finishedAt = new Date();
  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  let parsed: { hours: number; confidence: 'low' | 'medium' | 'high'; reasoning: string };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    throw new AppError(502, 'AI returned invalid response format');
  }

  if (typeof parsed.hours !== 'number' || parsed.hours <= 0) {
    throw new AppError(502, 'AI returned invalid hours value');
  }

  // Save estimate to issue
  await prisma.issue.update({
    where: { id: issueId },
    data: { estimatedHours: new Decimal(Math.round(parsed.hours * 100) / 100) },
  });

  // Log AI session
  const session = await prisma.aiSession.create({
    data: {
      issueId,
      userId,
      model: 'claude-haiku-4-5-20251001',
      provider: 'anthropic',
      startedAt,
      finishedAt,
      tokensInput: response.usage.input_tokens,
      tokensOutput: response.usage.output_tokens,
      costMoney: new Decimal(0),
      notes: `estimate: ${parsed.hours}h (${parsed.confidence})`,
    },
  });

  return {
    hours: parsed.hours,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    sessionId: session.id,
  };
}
