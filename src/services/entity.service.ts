import { entityRepository } from "@/repositories/entity.repository"
import type { CreateEntityInput, UpdateEntityInput } from "@/lib/validators/entity"
import { createEntitySchema } from "@/lib/entity-schema"

function generateSchemaName(code: string): string {
  return `entity_${code.toLowerCase().replace(/[^a-z0-9]/g, "_")}`
}

export const entityService = {
  async list() {
    return entityRepository.findAll()
  },

  async getById(id: string) {
    return entityRepository.findById(id)
  },

  async create(input: CreateEntityInput) {
    const existing = await entityRepository.findByCode(input.code)
    if (existing) {
      throw new Error("Entity code already exists")
    }

    const schemaName = generateSchemaName(input.code)

    const entity = await entityRepository.create({
      code: input.code,
      name: input.name,
      tin: input.tin,
      address: input.address,
      fiscalYearStart: new Date(input.fiscalYearStart),
      schemaName,
    })

    await createEntitySchema(schemaName)

    return entity
  },

  async update(id: string, input: UpdateEntityInput) {
    return entityRepository.update(id, input as Record<string, string>)
  },

  async deactivate(id: string) {
    return entityRepository.delete(id)
  },
}
