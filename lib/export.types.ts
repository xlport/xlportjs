import { ReadStream } from 'fs'
import * as Shared from './shared.types'
export type Body = FileBody | UrlBody | TemplateIdBody

export type FileBody = {
  template: Buffer | ReadStream
  data: DataWithSheets
}

export type UrlBody = {
  templateUrl: string
  data: DataWithSheets
}

export type TemplateIdBody = {
  templateId: string
  data: DataWithSheets
}

export type NamedRange = Value
export type Value = Shared.Scalar | ScalarWithOptions
export type ScalarWithOptions = { data: Shared.Scalar; format?: string; indent?: IndentLevel }
export type IndentLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20
export type Table = TableData | TableWithColumnModifications
export type TableData = Record<string, Value>[]
export type TableWithColumnModifications = {
  columns: ColumnDefinition[]
  data: TableData
}
export type SheetName = string
export type ColumnName = string
export type ColumnDefinition = {
  name: ColumnName
  fromTemplateColumn: ColumnName
  format?: string
  indent?: IndentLevel
}

export type DataElement = NamedRange | Table
export type DataWithoutSheets = { [key in string]?: DataElement }
export type DataWithSheets = DataWithoutSheets & { sheets?: Sheet[] }

export type Sheet = {
  name: SheetName
  fromTemplateSheet: Sheet
  color?: HexColor
  data: DataWithoutSheets
}

export type HexColor = `#${HexValue}${HexValue}${HexValue}`
type HexValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
