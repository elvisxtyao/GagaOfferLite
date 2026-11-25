import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { applicationsSchema, requirementsSchema } from './schemas/lite-schema'

/** Platform users plus exactly two business record collections. */
export const schemas: CollectionSchema[] = [usersSchema, applicationsSchema, requirementsSchema]
