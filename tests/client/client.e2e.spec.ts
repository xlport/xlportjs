import { Client } from '../../lib'
import * as dotenv from 'dotenv'
// import { createReadStream, createWriteStream } from 'fs'
// const streamEqual = require('stream-equal')
// import { Stream } from 'stream'

import * as simpleExport from './export/simple-export/request.json'

// const writeToFile = (stream: Stream, path: string): Promise<void> => {
//   const writeStream = stream.pipe(createWriteStream(path))
//   return new Promise((resolve, reject) => {
//     writeStream.on('finish', resolve)
//     writeStream.on('error', reject)
//   })
// }

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
