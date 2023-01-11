import * as Shared from './shared.types'
export type Request = {
  properties: string[]
  tables?: Record<string, string[]>[] | ['*']
}

export const defaultRequest: Request = {
  properties: ['*'],
  tables: ['*'],
}

export type Response = Success | Error

export interface Error {
  status: 'error'
  message: string
}

export interface Success {
  status: 'success'
  data: ImportData
}

export type ImportData = {
  properties?: Record<string, Property>
  tables?: Record<string, ImportTable | SheetTables>
}
export type Property = Shared.Scalar | SheetProperties
export type SheetProperties = Record<string, Shared.Scalar>
export type ImportTable = Record<string, Shared.Scalar>[]
export type SheetTables = Record<string, ImportTable>
