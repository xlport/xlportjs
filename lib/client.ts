import { put as putPromise } from 'request-promise'
import { put as put } from 'request'
import { promisify } from 'util'
import { readFile } from 'fs'

// import { createReadStream } from 'fs'
// import FormData from 'form-data'
// import Axios, { AxiosInstance, toFormData } from 'axios'
import { extname } from 'path'
import { Stream } from 'stream'
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
  // private get authHeader() {
  //   return 'xlport apikey ' + this.config.apiKey
  // }
  // public axios: AxiosInstance
  constructor(config: ClientOptions) {
    if (config.apiKey === undefined) throw Error('API Key is undefined')
    this.config = {
      url: config.url ? config.url.replace(/\/$/, '') : 'https://xlport.compute.molnify.com',
      apiKey: config.apiKey,
    }
    // this.axios = Axios.create({
    //   headers: {
    //     Authorization: this.authHeader,
    //   },
    // })
  }
  public async importFromFile(
    file: string | Buffer,
    request: Import.Request = Import.defaultRequest,
  ): Promise<Import.Response> {
    // const formData = new FormData()
    // if (typeof file === 'string') {
    //   try {
    //     const options = { contentType: this.getExcelMimeType(file) }
    //     formData.append('file.xlsx', createReadStream(file), options)
    //   } catch (error) {
    //     console.error(error)
    //     throw error
    //   }
    // } else {
    //   formData.append('file.xlsx', file, { contentType: excelDefaultMimeType })
    // }
    // formData.append('request', JSON.stringify(request))

    // return this.axios
    //   .put(`${this.config.url}/import`, formData, {
    //     headers: {
    //       Accept: 'application/json',
    //       'Content-Type': 'multipart/form-data',
    //       ...formData.getHeaders(),
    //     },
    //   })
    //   .then((response) => JSON.parse(response.data))
    //   .then((response) => {
    //     if (!response) throw Error('Response body is empty')
    //     return response
    //   })
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
  // public exportToFile(body: Export.Body): Promise<Stream> {
  // let data =
  //   'templateId' in body || 'templateUrl' in body
  //     ? body
  //     : toFormData({
  //           template: {
  //             value: body.template,
  //             options: {
  //               filename: 'template.xlsx',
  //               contentType: 'application/vnd.ms-excel',
  //             },
  //         },
  //         data: {
  //           value: Buffer.from(JSON.stringify(body.data)),
  //           options: {
  //             filename: 'data.json',
  //             contentType: 'application/json',
  //           },
  //         },
  //       })
  // return this.axios.put(`${this.config.url}/export`, data, { responseType: 'stream' }).then((response) => {
  //   if (response.status !== 200) throw Error(response.statusText)
  //   return response.data as Stream
  // })
  public exportToFile(body: Export.Body): Stream {
    return put({
      url: `${this.config.url}/export`,
      headers: {
        Authorization: 'xlport apikey ' + this.config.apiKey,
      },
      body: 'templateId' in body ? JSON.stringify(body) : 'templateUrl' in body ? JSON.stringify(body) : null,
      formData:
        'template' in body
          ? {
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
