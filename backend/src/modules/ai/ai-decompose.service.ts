import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { IssueType } from '@prisma/client';

export interface TaskSuggestion {
  title: string;
  description: string;
  estimatedHours: number;
}

export interface DecomposeResult {
  suggestions: TaskSuggestion[];
  sessionId: string;
}

const DECOMPOSABLE_TYPES: IssueType[] = ['EPIC', 'STORY'];

function buildPrompt(issue: {
  title: string;
  description: string | null;
  type: string;
  priority: string;
}): string {
  const childType = issue.type === 'EPIC' ? 'STORY' : 'TASK';

  return `You are an expert software project manager. Decompose the following ${issue.type} into ${childType}-level items.

${issue.type} details:
- Priority: ${issue.priority}
- Title: ${issue.title}
- Description: ${issue.description || '(no description provided)'}

Create 3 to 7 concrete, actionable ${childType} items that together fully implement this ${issue.type}.

Respond ONLY with a valid JSON array (no markdown, no extra text):
[
  {
    "title": "<concise action-oriented title>",
    "description": "<1-2 sentences of what needs to be done>",
    "estimatedHours": <number>
  }
]

Guidelines:
- Each item should be independently deliverable
- Titles should start with a verb (Implement, Add, Create, Fix, Update, etc.)
- estimatedHours: 1–24 per TASK/STORY item
- Cover backend, frontend, and testing aspects where applicable`;
}

export async function decomposeIssue(issueId: string, userId: string): Promise<DecomposeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new AppError(503, 'ANTHROPIC_API_KEY not configured');

  const issue = await prisma.issue.findUnique({ where: { id: issueId } });
  if (!issue) throw new AppError(404, 'Issue not found');

  if (!DECOMPOSABLE_TYPES.includes(issue.type)) {
    throw new AppError(400, `Only EPIC and STORY can be decomposed. Got: ${issue.type}`);
  }

  const client = new Anthropic({ apiKey });
  const startedAt = new Date();

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: buildPrompt(issue) }],
  });

  const finishedAt = new Date();
  const text = response.content[0].type === 'text' ? response.content[0].text : '[]';

  let suggestions: TaskSuggestion[];
  try {
    suggestions = JSON.parse(text.trim());
    if (!Array.isArray(suggestions)) throw new Error('not an array');
  } catch {
    throw new AppError(502, 'AI returned invalid response format');
  }

  // Sanitise: ensure required fields
  suggestions = suggestions
    .filter((s) => s && typeof s.title === 'string' && s.title.trim())
    .map((s) => ({
      title: String(s.title).trim(),
      description: String(s.description ?? '').trim(),
      estimatedHours: typeof s.estimatedHours === 'number' && s.estimatedHours > 0 ? s.estimatedHours : 4,
    }));

  if (suggestions.length === 0) throw new AppError(502, 'AI returned no suggestions');

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
      costMoney: 0,
      notes: `decompose: ${suggestions.length} suggestions`,
    },
  });

  return { suggestions, sessionId: session.id };
}

export async function applyDecompose(
  issueId: string,
  selectedIndexes: number[],
  suggestions: TaskSuggestion[],
  userId: string,
): Promise<{ created: number }> {
  const parent = await prisma.issue.findUnique({
    where: { id: issueId },
    include: { project: { select: { id: true } } },
  });
  if (!parent) throw new AppError(404, 'Issue not found');

  const childType: IssueType = parent.type === 'EPIC' ? 'STORY' : 'TASK';

  const toCreate = selectedIndexes
    .filter((i) => i >= 0 && i < suggestions.length)
    .map((i) => suggestions[i]);

  if (toCreate.length === 0) throw new AppError(400, 'No valid suggestions selected');

  // Get next issue numbers
  const lastIssue = await prisma.issue.findFirst({
    where: { projectId: parent.project.id },
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  let nextNumber = (lastIssue?.number ?? 0) + 1;

  const issueData = toCreate.map((s) => ({
    projectId: parent.project.id,
    number: nextNumber++,
    title: s.title,
    description: s.description || null,
    type: childType,
    parentId: issueId,
    creatorId: userId,
    estimatedHours: s.estimatedHours,
  }));

  await prisma.issue.createMany({ data: issueData });

  return { created: issueData.length };
}
