import { put as putPromise } from 'request-promise';

import { Response, put as putRequest } from 'request';
import { readFile } from 'fs';
import { extname } from 'path';
import { promisify } from 'util';
import { Stream } from 'stream';

type xlPortJs = {
  importFromFile: (fileLocation: string) => Promise<any>;
  exportToFile: (data: Export) => Stream;
};

type ExcelFileExtension = 'xls' | 'xlsx' | 'xlsm' | 'xlsb';
type ExcelDefaultMimeType = 'application/vnd.ms-excel';
type ExcelMimeType =
  | ExcelDefaultMimeType
  | 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  | 'application/vnd.ms-excel.sheet.macroEnabled.12'
  | 'application/vnd.ms-excel.sheet.binary.macroEnabled.12';

const excelDefaultMimeType = 'application/vnd.ms-excel';
type Dictionary<K extends string, T> = { [P in K]?: T };
type MimeTypes = Dictionary<ExcelFileExtension, ExcelMimeType>; //Record<ExcelFileExtension extends string, ExcelMimeType>;

export type ImportRequest = {
  properties: string[];
  tables?: Record<string, string[]>[] | string[];
};

type ExportRawType = Boolean | string | number;
export type ExportDetails = ExportRawType | Record<string, ExportRawType>; 
export type ExportData = { [key in string]?: ExportDetails }
export type Export = {
  templateId: string,
  data: ExportData
}

export const defaultImportRequest: ImportRequest = {
  properties: ['*'],
  tables: ['*'],
};

const mimeTypes: MimeTypes = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
  xls: 'application/vnd.ms-excel',
};

const getExcelMimeType = (path: string): ExcelMimeType =>
  mimeTypes[<ExcelFileExtension>extname(path)] || excelDefaultMimeType;

const loadFile = async (path: string) => ({
  value: await promisify(readFile)(path),
  options: {
    filename: 'file.xlsx',
    contentType: getExcelMimeType(path),
  },
});

export const xlPort = (apiKey: string): xlPortJs => ({
  importFromFile: async (file: string, request: ImportRequest = defaultImportRequest) =>
    putPromise({
      url: 'https://xlport.compute.molnify.com/import',
      headers: {
        Authorization: apiKey,
      },
      method: 'put',
      formData: {
        file: await loadFile(file),
        request: {
          value: Buffer.from(JSON.stringify(request)),
          options: {
            filename: 'request.json',
            contentType: 'application/json',
          },
        },
      },
    }).then((response: Response) => {
      const data = response.toJSON();
      if (data) {
        return data;
      } else throw new Error('Response body is empty');
    }),
  exportToFile: (data: Export) =>
    putRequest({
      url: 'https://xlport.compute.molnify.com/export',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      encoding: null,
    }),
});
