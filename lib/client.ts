import { put as putPromise } from 'request-promise'
import { put as putRequest } from 'request'
import { readFile } from 'fs'
import { extname } from 'path'
import { promisify } from 'util'
import { Stream } from 'stream'
import * as Import from './import.types'
import * as Export from './export.types'

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

export class XlPort {
  private config: Required<ClientOptions>
  constructor(config: ClientOptions) {
    this.config = {
      url: config.url ? config.url.replace(/\/$/, '') : 'https://api.xlport.io',
      apiKey: config.apiKey,
    }
  }
  public async importFromFile(
    file: string | Buffer,
    request: Import.Request = Import.defaultRequest,
  ): Promise<Import.Response> {
    return putPromise({
      url: `${this.config.url}/import`,
      headers: {
        Authorization: 'xlport apikey ' + this.config.apiKey,
      },
      method: 'put',
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
      .then(JSON.parse)
      .then((response) => {
        if (!response) throw Error('Response body is empty')
        return response
      })
  }
  public exportToFile(body: Export.Body): Stream {
    return putRequest({
      url: `${this.config.url}/export`,
      headers: {
        Authorization: 'xlport apikey ' + this.config.apiKey,
      },
      body: 'templateId' in body ? JSON.stringify(body) : 'templateUrl' in body ? JSON.stringify(body) : null,
      formData:
        'template' in body
          ? {
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
            }
          : undefined,
      encoding: null,
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
