import * as objectSource from './import/object.json'
import * as tableSource from './import/table.json'
import * as largeTableSource from './import/large-table.json'
import * as multiSheetSource from './import/multisheet.json'

import type { Import } from '../lib/import.types'

export const object: Import.Data = objectSource
export const table: Import.Data = tableSource
export const largeTable: Import.Data = largeTableSource
export const multiSheet: Import.Data = multiSheetSource
