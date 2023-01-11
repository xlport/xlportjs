import * as columnFormattingSource from './export/column-formatting.json'
import * as dateSource from './export/date.json'
import * as daysSource from './export/days.json'
import * as formatsSource from './export/formats.json'
import * as formulasAndLookupsSource from './export/formulas-and-lookups.json'
import * as multiColumnWithFixedColumnSource from './export/multi-column-with-fixed-column.json'
import * as multipleObjectsSource from './export/multiple-objects.json'
import * as multipleObjectsAndTablesSource from './export/multiple-objects-and-tables.json'
import * as multipleTablesSource from './export/multiple-tables.json'
import * as multiSheetColumnFixedTopleftSource from './export/multi-sheet-column-fixed-topleft.json'
import * as multiSheetColumnSource from './export/multi-sheet-column.json'
import * as multiSheetColumnFixedSource from './export/multi-sheet-column-fixed.json'
import * as multiSheetColumnSimpleSource from './export/multi-sheet-column-simple.json'
import * as multiSheetColumnSimpleDashSource from './export/multi-sheet-column-simple-dash.json'
import * as multiSheetSimpleSource from './export/multi-sheet-simple.json'
import * as objectSource from './export/object.json'
import * as queryTableSource from './export/query-table.json'
import * as queryTableSimpleSource from './export/query-table-simple.json'
import * as sheetsSource from './export/sheets.json'
import * as tableSource from './export/table.json'
import * as tableWithCalculationsSource from './export/table-with-calculations.json'
import * as utcSource from './export/utc.json'
import type { Export } from '../lib/export.types'

//convert string literal types (e.g. Export.HexColor) to string and literal numbers (e.g. Export.IndentLevel) to number
type Widen<T> = T extends string
  ? string
  : T extends number
  ? number
  : T extends boolean
  ? boolean
  : T extends Array<infer A>
  ? Array<Widen<A>>
  : T extends Record<infer X, infer Y>
  ? Record<X, Widen<Y>>
  : T

type WidenExport = Widen<Export.TemplateIdBody>
export const columnFormatting: WidenExport = columnFormattingSource
export const date: Export.TemplateIdBody = dateSource
export const days: Export.TemplateIdBody = daysSource
export const formats: WidenExport = formatsSource
export const formulasAndLookups: Export.TemplateIdBody = formulasAndLookupsSource
export const multiColumnWithFixedColumn: Export.TemplateIdBody = multiColumnWithFixedColumnSource
export const multipleObjects: Export.TemplateIdBody = multipleObjectsSource
export const multipleObjectsAndTables: Export.TemplateIdBody = multipleObjectsAndTablesSource
export const multipleTables: Export.TemplateIdBody = multipleTablesSource
export const multiSheetColumnFixedTopleft: WidenExport = multiSheetColumnFixedTopleftSource
export const multiSheetColumn: WidenExport = multiSheetColumnSource
export const multiSheetColumnFixed: WidenExport = multiSheetColumnFixedSource
export const multiSheetColumnSimple: WidenExport = multiSheetColumnSimpleSource
export const multiSheetColumnSimpleDash: WidenExport = multiSheetColumnSimpleDashSource
export const multiSheetSimple: WidenExport = multiSheetSimpleSource
export const object: Export.TemplateIdBody = objectSource
export const queryTable: Export.TemplateIdBody = queryTableSource
export const queryTableSimple: Export.TemplateIdBody = queryTableSimpleSource
export const sheets: Export.TemplateIdBody = sheetsSource
export const table: Export.TemplateIdBody = tableSource
export const tableWithCalculations: Export.TemplateIdBody = tableWithCalculationsSource
export const utc: Export.TemplateIdBody = utcSource
