import { Client } from '../../lib'
import * as dotenv from 'dotenv'
// import { createReadStream, createWriteStream } from 'fs'
// const streamEqual = require('stream-equal')
// import { Stream } from 'stream'

import * as simpleExport from './export/simple-export/request.json'
import * as import1Object from './import/1object/expected.json'
import * as import1Table from './import/1table/expected.json'
import * as importLargeTable from './import/1table-10col-100rows/expected.json'
import * as importMultipleObjects from './import/multipleObjects/expected.json'
import * as importMultipleObjectsAndTables from './import/multipleObjectsAndTables/expected.json'
import { createReadStream } from 'fs'

// const writeToFile = (stream: Stream, path: string): Promise<void> => {
//   const writeStream = stream.pipe(createWriteStream(path))
//   return new Promise((resolve, reject) => {
//     writeStream.on('finish', resolve)
//     writeStream.on('error', reject)
//   })
// }
const round = (value: number, precision: number) =>
  Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)
const roundNumbers = (obj: any, precision = 8) => {
  if (Array.isArray(obj)) {
    obj.forEach((element) => {
      if (typeof element === 'number') {
        //round to precision
        element = round(element, precision)
      } else {
        roundNumbers(element, precision)
      }
    })
  } else if (typeof obj === 'object') {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const element = obj[key]
        if (typeof element === 'number') {
          obj[key] = round(element, precision)
        } else {
          roundNumbers(element, precision)
        }
      }
    }
  } else if (typeof obj === 'number') {
    obj = round(obj, precision)
  }
  return obj
}
describe('Client', () => {
  const getClient = () => {
    dotenv.config({ path: './tests/client/.env' })
    return new Client({ apiKey: process.env.XLPORT_APIKEY! })
  }

  it('should throw if API Key is undefined', () => {
    expect(() => new Client({ apiKey: undefined as any })).toThrow()
  })

  it('should be able to create a client', () => {
    const client = getClient()
    expect(client).toBeDefined()
  })

  it('should be able to download a file', async () => {
    const client = getClient()
    const file = await client.exportToFile(simpleExport)
    expect(file).toBeDefined()
  })

  it('should be able to upload a template', async () => {
    const client = getClient()
    const result = await client.exportToFile({
      template: createReadStream('./tests/client/export/simple-export/template.xlsx'),
      data: { test: 'Test' },
    })
    expect(result).toBeDefined()
  })

  it('should import data - 1object', async () => {
    const client = getClient()
    const result = await client.importFromFile('./tests/client/import/1object/Source.xlsx')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data.properties).toEqual(import1Object.properties)
    }
  })

  it('should import data - 1table', async () => {
    const client = getClient()
    const result = await client.importFromFile('./tests/client/import/1table/Source.xlsx')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data.tables).toEqual(import1Table.tables)
    }
  })
  it('should import data - large table', async () => {
    const client = getClient()
    const result = await client.importFromFile('./tests/client/import/1table-10col-100rows/Source.xlsx')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(roundNumbers(result.data.tables)).toEqual(roundNumbers(importLargeTable.tables))
    }
  })
  it('should import data - multipleObjects', async () => {
    const client = getClient()
    const result = await client.importFromFile('./tests/client/import/multipleObjects/Source.xlsx')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data.properties).toEqual(importMultipleObjects.properties)
    }
  })
  it('should import data - multipleObjectsAndTables', async () => {
    const client = getClient()
    const result = await client.importFromFile('./tests/client/import/multipleObjectsAndTables/Source.xlsx')
    expect(result.status).toBe('success')
    if (result.status === 'success') {
      expect(result.data.properties).toEqual(importMultipleObjectsAndTables.properties)
      expect(result.data.tables).toEqual(importMultipleObjectsAndTables.tables)
    }
  })
  // it('should be able to download a file and match it to the expected', async () => {
  //   const file = createReadStream('./tests/client/export/simple-export/expected.xlsx')
  //   // const xlport = createReadStream('./tests/client/export/simple-export/expected.xlsx')
  //   const xlport = getClient().exportToFile(simpleExport)

  //   const result = await streamEqual(file, xlport)
  //   // , (a: any, b: any) => {
  //   //   console.log(a.data.data)
  //   //   // const jA = { ...a, data: null }
  //   //   // const jB = { ...b, data: null }
  //   //   // console.log(JSON.stringify(a.data).slice(0, 250))
  //   //   const result = assert.deepStrictEqual(a.data, b.data, 'data is not equal')
  //   //   console.log('result', result)
  //   //   return result
  //   // })
  //   expect(result).toBeTruthy()
  // })

  // it.only('save file', async () => {
  //   const xlport = getClient().exportToFile(simpleExport)
  //   const target = './tests/client/export/simple-export/test.xlsx'
  //   await writeToFile(xlport, target)
  //   // const file1 = createReadStream('./tests/client/export/simple-export/expected.xlsx')
  //   const file1 = createReadStream(target)
  //   const file2 = createReadStream('./tests/client/export/simple-export/expected.xlsx')
  //   expect(await streamEqual(file1, file2)).toBeTruthy()
  // })
})
