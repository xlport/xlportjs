import * as columnFormattingSource from './column-formatting.json'
import * as dateSource from './date.json'
import * as daysSource from './days.json'
import * as formatsSource from './formats.json'
import * as formulasAndLookupsSource from './formulas-and-lookups.json'
import * as multiColumnWithFixedColumnSource from './multi-column-with-fixed-column.json'
import * as multipleObjectsSource from './multiple-objects.json'
import * as multipleObjectsAndTablesSource from './multiple-objects-and-tables.json'
import * as multipleTablesSource from './multiple-tables.json'
import * as multiSheetColumnFixedTopleftSource from './multi-sheet-column-fixed-topleft.json'
import * as multiSheetColumnSource from './multi-sheet-column.json'
import * as multiSheetColumnFixedSource from './multi-sheet-column-fixed.json'
import * as multiSheetColumnSimpleSource from './multi-sheet-column-simple.json'
import * as multiSheetColumnSimpleDashSource from './multi-sheet-column-simple-dash.json'
import * as multiSheetSimpleSource from './multi-sheet-simple.json'
import * as objectSource from './object.json'
import * as queryTableSource from './query-table.json'
import * as queryTableSimpleSource from './query-table-simple.json'
import * as sheetsSource from './sheets.json'
import * as tableSource from './table.json'
import * as tableWithCalculationsSource from './table-with-calculations.json'
import * as utcSource from './utc.json'
import type * as Export from '../../lib/export.types'

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
