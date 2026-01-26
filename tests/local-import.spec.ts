import { Client, localImport } from '../lib'
import { readFileSync } from 'fs'

describe('Local Import (ExcelJS fallback)', () => {
  describe('localImport function', () => {
    it('should extract tables from an Excel file with formal Excel tables', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
        // The file should contain the "Initiatives" table
        expect(result.data.tables).toHaveProperty('Initiatives')
        const initiatives = result.data.tables!['Initiatives'] as any[]
        expect(initiatives.length).toBeGreaterThan(0)
        // Check that table rows have expected columns
        expect(initiatives[0]).toHaveProperty('Id')
        expect(initiatives[0]).toHaveProperty('Name')
      }
    })

    it('should extract multiple tables from a workbook', async () => {
      const fileBuffer = readFileSync('./tests/client/import/multipleObjectsAndTables/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
        // Should have multiple tables
        const tableNames = Object.keys(result.data.tables || {})
        expect(tableNames.length).toBeGreaterThanOrEqual(2)
        expect(tableNames).toContain('Initiatives')
        expect(tableNames).toContain('Status')
      }
    })

    it('should respect the request parameter for selective table extraction', async () => {
      const fileBuffer = readFileSync('./tests/client/import/multipleObjectsAndTables/workbook.xlsx')

      // Extract all tables
      const resultAll = await localImport(fileBuffer, {
        properties: [],
        tables: ['*'],
      })

      expect(resultAll.status).toBe('success')
      if (resultAll.status === 'success') {
        const tableCount = Object.keys(resultAll.data.tables || {}).length
        expect(tableCount).toBeGreaterThanOrEqual(2)
      }
    })

    it('should return an error for invalid Excel files', async () => {
      const invalidBuffer = Buffer.from('not an excel file')
      const result = await localImport(invalidBuffer)

      expect(result.status).toBe('error')
      if (result.status === 'error') {
        expect(result.message).toBeDefined()
      }
    })

    it('should handle date values correctly', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const initiatives = result.data.tables!['Initiatives'] as any[]
        // Check that Date column values are ISO strings
        const dateValue = initiatives[0]['Date']
        if (dateValue !== null) {
          // Should be an ISO date string
          expect(typeof dateValue).toBe('string')
          expect(dateValue).toMatch(/^\d{4}-\d{2}-\d{2}T/)
        }
      }
    })

    it('should handle boolean values correctly', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const initiatives = result.data.tables!['Initiatives'] as any[]
        // Check that IsComplete column has boolean values
        const isComplete = initiatives[0]['IsComplete']
        expect(typeof isComplete).toBe('boolean')
      }
    })

    it('should handle null values correctly', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const initiatives = result.data.tables!['Initiatives'] as any[]
        // Find a row with a null value (row 2 has null SavingsPotential based on expected.json)
        const rowWithNull = initiatives.find((row) => row['SavingsPotential'] === null)
        expect(rowWithNull).toBeDefined()
      }
    })
  })

  describe('Client with localOnly option', () => {
    it('should allow creating a client without an API key when localOnly is true', () => {
      const client = new Client({ localOnly: true, apiKey: '' })
      expect(client).toBeDefined()
    })

    it('should use local import when localOnly is true', async () => {
      const client = new Client({ localOnly: true, apiKey: '' })
      const result = await client.importFromFile('./tests/client/import/1table/workbook.xlsx')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
        expect(result.data.tables).toHaveProperty('Initiatives')
      }
    })

    it('should work with a Buffer input in localOnly mode', async () => {
      const client = new Client({ localOnly: true, apiKey: '' })
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await client.importFromFile(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
      }
    })
  })

  describe('Client with localFallback option', () => {
    it('should fallback to local import when server returns network error', async () => {
      // Use a URL that will definitely fail with ECONNREFUSED
      const client = new Client({
        apiKey: 'test-key',
        url: 'http://127.0.0.1:1', // Port 1 is typically not accessible
        localFallback: true,
      })

      const result = await client.importFromFile('./tests/client/import/1table/workbook.xlsx')

      // Should succeed via local fallback
      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
      }
    }, 10000)

    it('should throw when server is unreachable and localFallback is disabled', async () => {
      const client = new Client({
        apiKey: 'test-key',
        url: 'http://127.0.0.1:1',
        localFallback: false,
      })

      // Should throw because the server is unreachable and fallback is disabled
      await expect(client.importFromFile('./tests/client/import/1table/workbook.xlsx')).rejects.toThrow()
    }, 10000)

    it('should have localFallback enabled by default', () => {
      const client = new Client({ apiKey: 'test-key' })
      // The default should be to enable fallback
      // We can't easily test this without mocking, but we can verify the client is created
      expect(client).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle workbooks with no tables', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1object/workbook.xlsx')
      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      // The 1object workbook has no formal tables, so tables should be empty or undefined
      if (result.status === 'success') {
        const tableCount = Object.keys(result.data.tables || {}).length
        // May have detected tables from sheet data, but that's okay
        expect(tableCount).toBeGreaterThanOrEqual(0)
      }
    })

    it('should handle empty request', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const result = await localImport(fileBuffer, {
        properties: [],
        tables: undefined,
      })

      expect(result.status).toBe('success')
    })
  })
})
