import { Client } from '../../lib'
import * as dotenv from 'dotenv'
dotenv.config()

describe('Client', () => {
  it('should be able to create a client', () => {
    const client = new Client({ apiKey: process.env.XLPORT_APIKEY! })
    expect(client).toBeDefined()
  })
})
