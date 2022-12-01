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

export type ExportRawType = Boolean | string | number
export type ExportDetails = ExportRawType | Record<string, ExportRawType>[]
export type ExportData = { [key in string]?: ExportDetails }

interface TemplateIdBody {
  templateId: string
  data: ExportData
}

interface UrlBody {
  templateUrl: string
  data: ExportData
}

interface FileBody {
  template: Buffer | ReadStream
  data: ExportData
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
