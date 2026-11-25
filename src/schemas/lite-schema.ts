import type { CollectionSchema, RolePermissions } from 'deepspace/schema'
import {
  MAX_DEADLINE_LENGTH, MAX_DESCRIPTION_LENGTH, MAX_NOTE_LENGTH,
  MAX_SOURCE_LENGTH, MAX_TITLE_LENGTH,
} from '../domain/contracts'

const denied: RolePermissions = { read: false, create: false, update: false, delete: false }
const applicationPermissions: RolePermissions = {
  read: 'own', create: false, update: false, delete: false, writableFields: [],
}
const requirementPermissions: RolePermissions = {
  read: 'own', create: false, update: 'own', delete: false,
  writableFields: ['title', 'description', 'deadlineRaw', 'targetDate', 'note', 'reviewStatus', 'completed'],
}

export const applicationsSchema: CollectionSchema = {
  name: 'applications',
  ownerField: 'ownerId',
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'name', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: MAX_TITLE_LENGTH },
    { name: 'sourceUrl', storage: 'text', interpretation: 'url', required: true, immutable: true, maxLength: 2_000 },
    { name: 'sourceText', storage: 'text', interpretation: 'plain', required: true, immutable: true, maxLength: MAX_SOURCE_LENGTH },
  ],
  permissions: { '*': denied, viewer: applicationPermissions, member: applicationPermissions, admin: applicationPermissions },
}

export const requirementsSchema: CollectionSchema = {
  name: 'requirements',
  ownerField: 'ownerId',
  uniqueOn: ['applicationId', 'extractionKey'],
  columns: [
    { name: 'ownerId', storage: 'text', interpretation: 'plain', userBound: true, immutable: true, required: true },
    { name: 'applicationId', storage: 'text', interpretation: 'plain', immutable: true, required: true, maxLength: 200 },
    { name: 'extractionKey', storage: 'text', interpretation: 'plain', immutable: true, required: true, maxLength: 100 },
    { name: 'title', storage: 'text', interpretation: 'plain', required: true, maxLength: MAX_TITLE_LENGTH },
    { name: 'description', storage: 'text', interpretation: 'plain', required: true, maxLength: MAX_DESCRIPTION_LENGTH },
    { name: 'deadlineRaw', storage: 'text', interpretation: 'plain', default: '', maxLength: MAX_DEADLINE_LENGTH },
    { name: 'sourceDeadlineRaw', storage: 'text', interpretation: 'plain', immutable: true, default: '', maxLength: MAX_DEADLINE_LENGTH },
    { name: 'evidenceQuote', storage: 'text', interpretation: 'plain', immutable: true, required: true, maxLength: MAX_SOURCE_LENGTH },
    { name: 'reviewStatus', storage: 'text', interpretation: { kind: 'select', options: ['draft', 'accepted'] }, required: true, default: 'draft', maxLength: 8 },
    { name: 'completed', storage: 'number', interpretation: 'boolean', required: true, default: false },
    { name: 'note', storage: 'text', interpretation: 'plain', default: '', maxLength: MAX_NOTE_LENGTH },
    { name: 'targetDate', storage: 'text', interpretation: 'plain', default: '', maxLength: 10 },
  ],
  permissions: { '*': denied, viewer: { ...requirementPermissions, update: false }, member: requirementPermissions, admin: requirementPermissions },
}
