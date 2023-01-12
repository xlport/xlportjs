import { readFile } from 'fs'
import { extname } from 'path'
import { promisify } from 'util'
import { Stream } from 'stream'
import Axios, { AxiosInstance, toFormData } from 'axios'
import { Import } from './import.types'
import { Export } from './export.types'

export type ClientOptions = {
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
export const mimeTypes: MimeTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
}
export type MimeTypes = Record<ExcelFileExtension, ExcelMimeType>

export class Client {
  private config: Required<ClientOptions>
  private get authHeader() {
    return 'xlport apikey ' + this.config.apiKey
  }
  public axios: AxiosInstance
  constructor(config: ClientOptions) {
    this.config = {
      url: config.url ? config.url.replace(/\/$/, '') : 'https://xlport.compute.molnify.com',
      apiKey: config.apiKey,
    }
    this.axios = Axios.create({
      headers: {
        Authorization: this.authHeader,
      },
    })
  }
  public async importFromFile(
    file: string | Buffer,
    request: Import.Request = Import.defaultRequest,
  ): Promise<Import.Response> {
    return this.axios
      .put(`${this.config.url}/import`, {
        formData: {
          file:
            typeof file === 'string'
              ? await this.loadFile(file)
              : {
                  value: file,
                  options: { filename: 'file.xlsx', contentType: excelDefaultMimeType },
                },
          request: {
            value: Buffer.from(JSON.stringify(request)),
            options: {
              filename: 'request.json',
              contentType: 'application/json',
            },
          },
        },
      })
      .then((response) => JSON.parse(response.data))
      .then((response) => {
        if (!response) throw Error('Response body is empty')
        return response
      })
  }
  public exportToFile(body: Export.Body): Promise<Stream> {
    let data =
      'templateId' in body || 'templateUrl' in body
        ? body
        : toFormData({
            template: {
              template: {
                value: body.template,
                options: {
                  filename: 'template.xlsx',
                  contentType: 'application/vnd.ms-excel',
                },
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

  private async loadFile(path: string) {
    return {
      value: await promisify(readFile)(path),
      options: {
        filename: 'file.xlsx',
        contentType: this.getExcelMimeType(path),
      },
    }
  }
}
