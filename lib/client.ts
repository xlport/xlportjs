import { createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import http from 'http'
import https from 'https'

import Axios, { AxiosInstance, AxiosError, toFormData } from 'axios'
import { extname } from 'path'
import { Stream } from 'stream'
import { Import } from './import.types'
import { Export } from './export.types'
import FormData from 'form-data'
import { localImport } from './local-import'

export type ClientOptions = {
  /**
   * URL of the xlPort server.
   * @default 'https://xlport.compute.molnify.com'
   */
  url?: string

  /**
   * API key for xlport server authentication.
   * Required unless localOnly is true.
   */
  apiKey?: string

  /**
   * Enable local fallback using ExcelJS when the xlport server cannot be reached.
   * Useful for sandboxed environments without network access.
   * @default true
   */
  localFallback?: boolean

  /**
   * Skip the xlport server entirely and use local parsing only.
   * When true, the apiKey is not required.
   * @default false
   */
  localOnly?: boolean
}

export type ExcelFileExtension = 'xls' | 'xlsx' | 'xlsm' | 'xlsb'
export type ExcelDefaultMimeType = 'application/vnd.ms-excel'
export type ExcelMimeType =
  | ExcelDefaultMimeType
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel.sheet.macroEnabled.12'
  | 'application/vnd.ms-excel.sheet.binary.macroEnabled.12'

export const excelDefaultMimeType = 'application/vnd.ms-excel'
export const mimeTypes: MimeTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
}
export type MimeTypes = Record<ExcelFileExtension, ExcelMimeType>

type ResolvedClientOptions = {
  url: string
  apiKey: string
  localFallback: boolean
  localOnly: boolean
}

export class Client {
  private config: ResolvedClientOptions
  private get authHeader() {
    return 'xlport apikey ' + this.config.apiKey
  }
  public axios: AxiosInstance
  private httpAgent: http.Agent
  private httpsAgent: https.Agent

  constructor(config: ClientOptions) {
    const localOnly = config.localOnly ?? false
    if (!localOnly && !config.apiKey) throw Error('API Key is required when localOnly is false')
    this.config = {
      url: config.url ? config.url.replace(/\/$/, '') : 'https://xlport.compute.molnify.com',
      apiKey: config.apiKey ?? '',
      localFallback: config.localFallback ?? true,
      localOnly,
    }

    // Create agents for proper connection management
    this.httpAgent = new http.Agent({ keepAlive: false })
    this.httpsAgent = new https.Agent({ keepAlive: false })

    this.axios = Axios.create({
      httpAgent: this.httpAgent,
      httpsAgent: this.httpsAgent,
      headers: {
        Authorization: this.authHeader,
      },
    })
  }

  /**
   * Destroy the client and close all connections.
   * Call this when you're done using the client to prevent open handles.
   */
  public destroy(): void {
    // Clear interceptors
    this.axios.interceptors.request.clear?.()
    this.axios.interceptors.response.clear?.()

    // Destroy the agents to close all sockets
    this.httpAgent.destroy()
    this.httpsAgent.destroy()
  }
  public async importFromFile(
    file: string | Buffer,
    request: Import.Request = Import.defaultRequest,
    filename: string = 'file.xlsx',
  ): Promise<Import.Response> {
    // Helper to get file buffer only when needed (lazy loading)
    const getFileBuffer = async (): Promise<Buffer> => {
      if (typeof file === 'string') {
        return readFile(file)
      }
      return file
    }

    // If localOnly mode is enabled, skip the server entirely
    if (this.config.localOnly) {
      const fileBuffer = await getFileBuffer()
      return localImport(fileBuffer, request)
    }

    const formData = new FormData()
    if (typeof file === 'string') {
      try {
        const options = { contentType: this.getExcelMimeType(file) }
        formData.append('file', createReadStream(file), options)
      } catch (error) {
        console.error(error)
        throw error
      }
    } else {
      formData.append('file', file, { contentType: this.getExcelMimeType(filename), filename })
    }
    formData.append('request', JSON.stringify(request))

    try {
      const response = await this.axios.put(`${this.config.url}/import`, formData, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'multipart/form-data',
          ...formData.getHeaders(),
        },
      })
      if (!response.data) throw Error('Response body is empty')
      return response.data
    } catch (error) {
      // Check if this is a network error and fallback is enabled
      if (this.config.localFallback && this.isNetworkError(error)) {
        console.warn('xlport server unreachable, falling back to local ExcelJS import')
        const fileBuffer = await getFileBuffer()
        return localImport(fileBuffer, request)
      }
      throw error
    }
  }

  /**
   * Check if an error is a network-related error (connection refused, timeout, etc.)
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof AxiosError) {
      // Network errors (no response received)
      if (!error.response) {
        return true
      }
      // Server errors that indicate the server is not available
      const status = error.response.status
      if (status === 502 || status === 503 || status === 504) {
        return true
      }
    }
    return false
  }
  public exportToFile(body: Export.Body): Promise<Stream> {
    let data =
      'templateId' in body || 'templateUrl' in body
        ? body
        : toFormData({
            template: {
              value: body.template,
              options: {
                filename: 'template.xlsx',
                contentType: 'application/vnd.ms-excel',
              },
            },
            data: {
              value: Buffer.from(JSON.stringify(body.data)),
              options: {
                filename: 'data.json',
                contentType: 'application/json',
              },
            },
          })
    return this.axios.put(`${this.config.url}/export`, data, { responseType: 'stream' }).then((response) => {
      if (response.status !== 200) throw Error(response.statusText)
      return response.data as Stream
    })
  }

  private getExcelMimeType(path: string): ExcelMimeType {
    return mimeTypes[<ExcelFileExtension>extname(path)] || excelDefaultMimeType
  }
}
