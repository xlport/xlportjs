import { ReadStream } from 'fs'

export type XlPortClientOptions = {
  url?: string
  apiKey: string
}

export type ExcelFileExtension = 'xls' | 'xlsx' | 'xlsm' | 'xlsb'
export type ExcelDefaultMimeType = 'application/vnd.ms-excel'
export type ExcelMimeType =
  | ExcelDefaultMimeType
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel.sheet.macroEnabled.12'
  | 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'

export const excelDefaultMimeType = 'application/vnd.ms-excel'
type Dictionary<K extends string, T> = { [P in K]?: T }
export type MimeTypes = Dictionary<ExcelFileExtension, ExcelMimeType> //Record<ExcelFileExtension extends string, ExcelMimeType>;

export type ImportRequest = {
  properties: string[]
  tables?: Record<string, string[]>[] | ['*']
}

export type ExportNamedRange = ExportScalar | ExportScalarWithOptions
export type ExportScalar = boolean | string | number
export type ExportScalarWithOptions = { data: ExportScalar; format?: string; indent?: IndentLevel }
export type IndentLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
export type ExportTable = ExportTablePlain | ExportTableWithColumnModifications
export type ExportTablePlain = Record<string, ExportNamedRange>[]
export type ExportTableWithColumnModifications = {
  columns: ExportTableColumn[]
  data: ExportTablePlain
}
export type ExportTableColumn = {
  name: string
  fromTemplateColumn: string
  format?: string
}

export type ExportDetails = ExportNamedRange | ExportTable
export type ExportDataWithSheets = ExportData & { sheets?: ExportSheet[] }
export type ExportData = { [key in string]?: ExportDetails }

export type ExportSheet = {
  name: string
  fromTemplateSheet: string
  color?: HexColor
  data: ExportData
}

export type HexColor = `#${HexValue}${HexValue}${HexValue}`
type HexValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'

interface TemplateIdBody {
  templateId: string
  data: ExportDataWithSheets
}

interface UrlBody {
  templateUrl: string
  data: ExportDataWithSheets
}

interface FileBody {
  template: Buffer | ReadStream
  data: ExportDataWithSheets
}

export type ExportBody = FileBody | UrlBody | TemplateIdBody

export type ImportResponse = ImportSuccess | ImportError

export interface ImportError {
  status: 'error'
  message: string
}

export interface ImportSuccess {
  status: 'success'
  data: {
    properties?: Record<string, ImportValue>
    tables?: Record<string, ImportValue>[]
  }
}

export type ImportValue = boolean | string | number

export const defaultImportRequest: ImportRequest = {
  properties: ['*'],
  tables: ['*'],
}

export const mimeTypes: MimeTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
}
