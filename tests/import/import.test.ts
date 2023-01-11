import * as objectSource from './object.json'
import * as tableSource from './table.json'
import * as largeTableSource from './large-table.json'
import * as multiSheetSource from './multisheet.json'

import type * as Import from '../../lib/import.types'

export const object: Import.ImportData = objectSource
export const table: Import.ImportData = tableSource
export const largeTable: Import.ImportData = largeTableSource
export const multiSheet: Import.ImportData = multiSheetSource
