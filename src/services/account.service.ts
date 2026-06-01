import { accountRepository } from "@/repositories/account.repository"
import type { CreateAccountInput, UpdateAccountInput } from "@/lib/validators/account"

export const accountService = {
  async list(entitySchema: string) {
    return accountRepository.findAll(entitySchema)
  },

  async getById(entitySchema: string, id: string) {
    return accountRepository.findById(entitySchema, id)
  },

  async getTree(entitySchema: string) {
    const accounts = await accountRepository.findAll(entitySchema)
    return buildTree(accounts)
  },

  async create(entitySchema: string, input: CreateAccountInput) {
    const existing = await accountRepository.findByCode(entitySchema, input.accountCode)
    if (existing) {
      throw new Error("Account code already exists")
    }
    return accountRepository.create(entitySchema, input)
  },

  async update(entitySchema: string, id: string, input: UpdateAccountInput) {
    return accountRepository.update(entitySchema, id, input)
  },
}

function buildTree(accounts: any[]): any[] {
  const map = new Map<string, any>()
  const roots: any[] = []

  accounts.forEach((acc) => {
    map.set(acc.id, { ...acc, children: [] })
  })

  accounts.forEach((acc) => {
    const node = map.get(acc.id)
    if (acc.parent_id && map.has(acc.parent_id)) {
      map.get(acc.parent_id).children.push(node)
    } else {
      roots.push(node)
    }
  })

  return roots
}
