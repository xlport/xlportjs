import * as Shared from './shared.types'
export type Request = {
  properties: string[]
  tables?: Record<string, string[]>[] | ['*']
}

export type Response = Success | Error

export interface Error {
  status: 'error'
  message: string
}

export interface Success {
  status: 'success'
  data: {
    properties?: Record<string, Shared.Scalar>
    tables?: Record<string, Shared.Scalar>[]
  }
}

export const defaultRequest: Request = {
  properties: ['*'],
  tables: ['*'],
}
