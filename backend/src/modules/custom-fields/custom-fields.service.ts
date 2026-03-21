import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma/client.js';
import { AppError } from '../../shared/middleware/error-handler.js';
import type { CreateCustomFieldDto, UpdateCustomFieldDto, ReorderCustomFieldsDto } from './custom-fields.dto.js';

const SELECT_TYPES = ['SELECT', 'MULTI_SELECT'] as const;

export async function listCustomFields() {
  return prisma.customField.findMany({
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    include: { _count: { select: { schemaItems: true, values: true } } },
  });
}

export async function getCustomField(id: string) {
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) throw new AppError(404, 'Custom field not found');
  return field;
}

export async function createCustomField(dto: CreateCustomFieldDto) {
  const requiresOptions = SELECT_TYPES.includes(dto.fieldType as typeof SELECT_TYPES[number]);
  if (requiresOptions && (!dto.options || dto.options.length === 0)) {
    throw new AppError(422, 'options are required for SELECT and MULTI_SELECT field types');
  }
  if (!requiresOptions && dto.options && dto.options.length > 0) {
    throw new AppError(422, 'options are only allowed for SELECT and MULTI_SELECT field types');
  }

  const maxOrder = await prisma.customField.aggregate({ _max: { orderIndex: true } });
  const orderIndex = (maxOrder._max.orderIndex ?? -1) + 1;

  return prisma.customField.create({
    data: {
      name: dto.name,
      description: dto.description,
      fieldType: dto.fieldType,
      options: dto.options ? (dto.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      orderIndex,
    },
  });
}

export async function updateCustomField(id: string, dto: UpdateCustomFieldDto) {
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) throw new AppError(404, 'Custom field not found');

  // fieldType cannot be changed if there are values in tasks (handled via IssueCustomFieldValue in PR4)
  // For now, store field_type change restriction in service as a guard
  if (dto.options !== undefined) {
    const isSelectType = SELECT_TYPES.includes(field.fieldType as typeof SELECT_TYPES[number]);
    if (!isSelectType) {
      throw new AppError(422, 'options can only be set for SELECT and MULTI_SELECT field types');
    }
  }

  return prisma.customField.update({
    where: { id },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.options !== undefined && { options: dto.options }),
    },
  });
}

export async function deleteCustomField(id: string) {
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) throw new AppError(404, 'Custom field not found');
  if (field.isSystem) throw new AppError(403, 'System fields cannot be deleted');

  await prisma.customField.delete({ where: { id } });
  return { ok: true };
}

export async function toggleCustomField(id: string) {
  const field = await prisma.customField.findUnique({ where: { id } });
  if (!field) throw new AppError(404, 'Custom field not found');

  return prisma.customField.update({
    where: { id },
    data: { isEnabled: !field.isEnabled },
  });
}

export async function reorderCustomFields(dto: ReorderCustomFieldsDto) {
  const ids = dto.updates.map((u) => u.id);
  const fields = await prisma.customField.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (fields.length !== ids.length) {
    throw new AppError(404, 'One or more custom fields not found');
  }

  await prisma.$transaction(
    dto.updates.map((u) =>
      prisma.customField.update({
        where: { id: u.id },
        data: { orderIndex: u.orderIndex },
      }),
    ),
  );
  return { ok: true };
}
