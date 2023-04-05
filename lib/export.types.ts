import { ReadStream } from 'fs'
import * as Shared from './shared.types'
export namespace Export {
  export type Body = FileBody | UrlBody | TemplateIdBody

  export type FileBody = {
    template: Buffer | ReadStream
    data: DataWithSheets
  }

  export const bodyHasFile = (body: Body): body is FileBody => 'template' in body

  export type UrlBody = {
    templateUrl: string
    data: DataWithSheets
  }

  export type TemplateIdBody = {
    templateId: string
    data: DataWithSheets
  }

  export type NamedRange = Value
  export type Value = Shared.Primitives | ScalarWithOptions
  export type ScalarWithOptions = { data: Shared.Primitives; format?: string; indent?: IndentLevel }
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
  export type DataWithoutSheets = Record<string, any>
  export type DataWithSheets = DataWithoutSheets & { sheets?: Sheet[] }

  export type Sheet = {
    name: SheetName
    fromTemplateSheet: SheetName
    tabColor?: HexColor
    data: DataWithoutSheets
  }

  export type HexColor = `#${string}`
}
