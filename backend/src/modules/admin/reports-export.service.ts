import { stringify } from 'csv-stringify/sync';
import PDFDocument from 'pdfkit';
import { prisma } from '../../prisma/client.js';

interface ExportFilters {
  projectId: string;
  sprintId?: string;
  from?: string;
  to?: string;
  status?: string;
}

async function fetchIssues(filters: ExportFilters) {
  return prisma.issue.findMany({
    where: {
      projectId: filters.projectId,
      ...(filters.sprintId ? { sprintId: filters.sprintId } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      assignee: { select: { name: true } },
      sprint: { select: { name: true } },
      project: { select: { key: true } },
      timeLogs: { select: { hours: true } },
    },
    orderBy: { number: 'asc' },
  });
}

type IssueRow = Awaited<ReturnType<typeof fetchIssues>>[number];

function issueToRow(issue: IssueRow) {
  const loggedHours = issue.timeLogs.reduce((s, l) => s + Number(l.hours), 0);
  return {
    ID: issue.id,
    Key: `${issue.project.key}-${issue.number}`,
    Title: issue.title,
    Type: issue.type,
    Status: issue.status,
    Priority: issue.priority,
    Assignee: issue.assignee?.name ?? 'Unassigned',
    Sprint: issue.sprint?.name ?? '',
    'Estimated (h)': issue.estimatedHours != null ? Number(issue.estimatedHours).toFixed(2) : '',
    'Logged (h)': loggedHours.toFixed(2),
    Created: issue.createdAt.toISOString().slice(0, 10),
    Updated: issue.updatedAt.toISOString().slice(0, 10),
  };
}

export async function exportIssuesCsv(filters: ExportFilters): Promise<Buffer> {
  const issues = await fetchIssues(filters);
  const rows = issues.map(issueToRow);
  const csv = stringify(rows, { header: true });
  return Buffer.from(csv, 'utf-8');
}

export async function exportIssuesPdf(filters: ExportFilters): Promise<Buffer> {
  const issues = await fetchIssues(filters);
  const rows = issues.map(issueToRow);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header
    doc.fontSize(14).font('Helvetica-Bold').text('TaskTime — Issues Report', { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor('#666666').text(
      `Project ID: ${filters.projectId}  |  Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      { align: 'center' },
    );
    doc.moveDown(0.5);
    doc.fillColor('#000000');

    if (rows.length === 0) {
      doc.text('No issues found for the given filters.');
      doc.end();
      return;
    }

    // Table columns
    const cols = [
      { key: 'Key', width: 60 },
      { key: 'Title', width: 180 },
      { key: 'Type', width: 55 },
      { key: 'Status', width: 70 },
      { key: 'Priority', width: 55 },
      { key: 'Assignee', width: 80 },
      { key: 'Estimated (h)', width: 60 },
      { key: 'Logged (h)', width: 55 },
      { key: 'Created', width: 65 },
    ] as const;

    const startX = doc.page.margins.left;
    let y = doc.y;
    const rowHeight = 16;
    const headerBg = '#1a1a2e';
    const altBg = '#f5f5f5';

    // Draw header
    doc.rect(startX, y, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill(headerBg);
    doc.fillColor('#ffffff').fontSize(7.5).font('Helvetica-Bold');
    let x = startX;
    for (const col of cols) {
      doc.text(col.key, x + 3, y + 4, { width: col.width - 6, ellipsis: true });
      x += col.width;
    }
    y += rowHeight;

    doc.font('Helvetica').fillColor('#000000').fontSize(7.5);

    for (let i = 0; i < rows.length; i++) {
      if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      const row = rows[i];
      if (i % 2 === 1) {
        doc.rect(startX, y, cols.reduce((s, c) => s + c.width, 0), rowHeight).fill(altBg);
        doc.fillColor('#000000');
      }

      x = startX;
      for (const col of cols) {
        const val = String(row[col.key as keyof typeof row] ?? '');
        doc.text(val, x + 3, y + 4, { width: col.width - 6, ellipsis: true });
        x += col.width;
      }
      y += rowHeight;
    }

    doc.end();
  });
}

export async function exportTimeCsv(filters: ExportFilters): Promise<Buffer> {
  const logs = await prisma.timeLog.findMany({
    where: {
      issue: { projectId: filters.projectId },
      ...(filters.from || filters.to
        ? {
            logDate: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
    },
    include: {
      issue: { select: { number: true, title: true, project: { select: { key: true } } } },
      user: { select: { name: true } },
    },
    orderBy: { logDate: 'asc' },
  });

  const rows = logs.map((l) => ({
    Date: l.logDate.toISOString().slice(0, 10),
    'Issue Key': `${l.issue.project.key}-${l.issue.number}`,
    'Issue Title': l.issue.title,
    User: l.user?.name ?? 'Agent',
    'Hours': Number(l.hours).toFixed(2),
    Source: l.source,
    Note: l.note ?? '',
  }));

  const csv = stringify(rows, { header: true });
  return Buffer.from(csv, 'utf-8');
}
