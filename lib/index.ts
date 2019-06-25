import { put as putPromise } from 'request-promise';

import { put as putRequest } from 'request';
import { readFile, ReadStream } from 'fs';
import { extname } from 'path';
import { promisify } from 'util';
import { Stream } from 'stream';

type xlPortJs = {
  importFromFile: (file: string | Buffer) => Promise<ImportResponse>;
  exportToFile: (data: ExportBody) => Stream;
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
  tables?: Record<string, string[]>[] | ['*'];
};

type ExportRawType = Boolean | string | number;
export type ExportDetails = ExportRawType | Record<string, ExportRawType>;
export type ExportData = { [key in string]?: ExportDetails };

type ExportDetails = ExportRawType | Record<string, ExportRawType>;

type ExportData = { [key in string]?: ExportDetails };

interface TemplateIdBody {
  templateId: string;
  data: ExportData;
}

interface UrlBody {
  templateUrl: string;
  data: ExportData;
}

interface FileBody {
  template: Buffer | ReadStream;
  data: ExportData;
}

type ExportBody = FileBody | UrlBody | TemplateIdBody;

type ImportResponse = ImportSuccess | ImportError;

interface ImportError {
  status: 'error';
  message: string;
}

interface ImportSuccess {
  status: 'success';
  data: {
    properties?: Record<string, ImportValue>;
    tables?: Record<string, ImportValue>[];
  };
}

type ImportValue = boolean | string | number;

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
  importFromFile: async (file: string | Buffer, request: ImportRequest = defaultImportRequest): Promise<ImportResponse> =>
    putPromise({
      url: 'https://xlport.compute.molnify.com/import',
      headers: {
        Authorization: 'xlport apikey ' + apiKey,
      },
      method: 'put',
      formData: {
        file:
          typeof file === 'string'
            ? await loadFile(file)
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
        if (!response) throw Error('Response body is empty');
        return response;
      }),
  exportToFile: (body: ExportBody): Stream =>
    putRequest({
      url: 'https://xlport.compute.molnify.com/export',
      headers: {
        Authorization: 'xlport apikey ' + apiKey,
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
    }),
});
