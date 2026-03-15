import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TaskTime API',
      version: '1.0.0',
      description:
        'TaskTime MVP — импортозамещение Jira для российского финансового сектора.\n\n' +
        '**Аутентификация:** Bearer JWT (получить через POST /api/auth/login)',
    },
    servers: [
      { url: '/api', description: 'Current server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
        Issue: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            number: { type: 'integer' },
            title: { type: 'string' },
            description: { type: 'string', nullable: true },
            type: { type: 'string', enum: ['EPIC', 'STORY', 'TASK', 'SUBTASK', 'BUG'] },
            status: { type: 'string', enum: ['OPEN', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'] },
            priority: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
            estimatedHours: { type: 'number', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Sprint: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            goal: { type: 'string', nullable: true },
            state: { type: 'string', enum: ['PLANNED', 'ACTIVE', 'CLOSED'] },
            startDate: { type: 'string', format: 'date-time', nullable: true },
            endDate: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        EstimateResult: {
          type: 'object',
          properties: {
            hours: { type: 'number', example: 8 },
            confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
            reasoning: { type: 'string' },
            sessionId: { type: 'string', format: 'uuid' },
          },
        },
        DecomposeResult: {
          type: 'object',
          properties: {
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  estimatedHours: { type: 'number' },
                },
              },
            },
            sessionId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Аутентификация и управление сессиями' },
      { name: 'Issues', description: 'Задачи (EPIC, STORY, TASK, SUBTASK, BUG)' },
      { name: 'Sprints', description: 'Управление спринтами' },
      { name: 'AI', description: 'AI-оценка и декомпозиция задач' },
      { name: 'Integrations', description: 'Telegram и GitLab интеграции' },
      { name: 'Reports', description: 'Отчёты и экспорт' },
    ],
  },
  apis: ['./src/modules/**/*.router.ts', './src/modules/**/*.router.js'],
};

export const swaggerSpec = swaggerJsdoc(options);
