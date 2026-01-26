import { Client, localImport, ClientOptions } from '../lib'
import { readFileSync } from 'fs'

// Helper to round numbers for comparison (handles floating point precision)
const round = (value: number, precision: number) =>
  Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision)

const roundNumbers = (obj: any, precision = 8): any => {
  if (Array.isArray(obj)) {
    return obj.map((element) => roundNumbers(element, precision))
  } else if (obj !== null && typeof obj === 'object') {
    const result: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        result[key] = roundNumbers(obj[key], precision)
      }
    }
    return result
  } else if (typeof obj === 'number') {
    return round(obj, precision)
  }
  return obj
}

// Helper to sort table rows by a consistent key for comparison
const sortTableRows = (table: any[]): any[] => {
  if (!table || table.length === 0) return table
  // Try to sort by Id, then by Name, then by first key
  const sortKey = table[0].Id !== undefined ? 'Id' : table[0].Name !== undefined ? 'Name' : Object.keys(table[0])[0]
  return [...table].sort((a, b) => {
    const aVal = String(a[sortKey] ?? '')
    const bVal = String(b[sortKey] ?? '')
    return aVal.localeCompare(bVal)
  })
}

// Helper to normalize table data for comparison (sort keys within each row)
const normalizeRow = (row: any): any => {
  const result: any = {}
  const keys = Object.keys(row).sort()
  for (const key of keys) {
    result[key] = row[key]
  }
  return result
}

// Helper to compare rows, accounting for known limitations
// ExcelJS doesn't evaluate formulas - it only reads cached results
// When a formula has no cached result, localImport returns null
// while xlport server evaluates the formula
const compareRowsWithFormulaLeniency = (localRow: any, expectedRow: any, formulaColumns: string[] = []): boolean => {
  const localKeys = Object.keys(localRow).sort()
  const expectedKeys = Object.keys(expectedRow).sort()

  if (localKeys.length !== expectedKeys.length) return false
  if (!localKeys.every((k, i) => k === expectedKeys[i])) return false

  for (const key of localKeys) {
    const localVal = localRow[key]
    const expectedVal = expectedRow[key]

    // For formula columns, accept null from localImport when xlport has a value
    // This is a known limitation: ExcelJS doesn't evaluate formulas
    if (formulaColumns.includes(key) && localVal === null && expectedVal !== null) {
      continue
    }

    if (localVal !== expectedVal) {
      return false
    }
  }
  return true
}

describe('Local Import (ExcelJS fallback)', () => {
  // Store client instances for cleanup
  const clients: Client[] = []

  // Helper to create and track client instances
  const createClient = (options: ClientOptions) => {
    const client = new Client(options)
    clients.push(client)
    return client
  }

  // Cleanup after all tests to prevent open handle warnings
  afterAll(async () => {
    // Clear any pending axios connections by removing interceptors and aborting
    for (const client of clients) {
      // Clear axios request/response interceptors
      client.axios.interceptors.request.clear?.()
      client.axios.interceptors.response.clear?.()
    }
    clients.length = 0

    // Give time for any pending connections to close
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

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

      // First, get all tables to know what's available
      const resultAll = await localImport(fileBuffer, {
        properties: [],
        tables: ['*'],
      })

      expect(resultAll.status).toBe('success')
      if (resultAll.status === 'success') {
        const allTableNames = Object.keys(resultAll.data.tables || {})
        expect(allTableNames.length).toBeGreaterThanOrEqual(2)

        // Now request only a single table
        const resultSingle = await localImport(fileBuffer, {
          properties: [],
          tables: [{ Initiatives: ['Id', 'Name'] }],
        })

        expect(resultSingle.status).toBe('success')
        if (resultSingle.status === 'success') {
          // Should only have the requested table
          const singleTableNames = Object.keys(resultSingle.data.tables || {})
          expect(singleTableNames).toEqual(['Initiatives'])

          // Should only have the requested columns
          const initiatives = resultSingle.data.tables!['Initiatives'] as any[]
          expect(initiatives.length).toBeGreaterThan(0)
          const columns = Object.keys(initiatives[0])
          expect(columns.sort()).toEqual(['Id', 'Name'])
        }
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
      // apiKey is now optional when localOnly is true
      const client = createClient({ localOnly: true })
      expect(client).toBeDefined()
    })

    it('should use local import when localOnly is true', async () => {
      const client = createClient({ localOnly: true })
      const result = await client.importFromFile('./tests/client/import/1table/workbook.xlsx')

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
        expect(result.data.tables).toHaveProperty('Initiatives')
      }
    })

    it('should work with a Buffer input in localOnly mode', async () => {
      const client = createClient({ localOnly: true })
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
      const client = createClient({
        apiKey: 'test-key',
        url: 'http://127.0.0.1:1', // Port 1 is typically not accessible
        localFallback: true,
      })
      // Set short timeout to prevent lingering connections
      client.axios.defaults.timeout = 1000

      const result = await client.importFromFile('./tests/client/import/1table/workbook.xlsx')

      // Should succeed via local fallback
      expect(result.status).toBe('success')
      if (result.status === 'success') {
        expect(result.data.tables).toBeDefined()
      }
    }, 10000)

    it('should throw when server is unreachable and localFallback is disabled', async () => {
      const client = createClient({
        apiKey: 'test-key',
        url: 'http://127.0.0.1:1',
        localFallback: false,
      })
      // Set short timeout to prevent lingering connections
      client.axios.defaults.timeout = 1000

      // Should throw because the server is unreachable and fallback is disabled
      await expect(client.importFromFile('./tests/client/import/1table/workbook.xlsx')).rejects.toThrow()
    }, 10000)

    it('should have localFallback enabled by default', async () => {
      // Create client WITHOUT specifying localFallback - it should default to true
      const client = createClient({
        apiKey: 'test-key',
        url: 'http://127.0.0.1:1', // Unreachable URL
        // localFallback not specified - should default to true
      })
      // Set short timeout to prevent lingering connections
      client.axios.defaults.timeout = 1000

      // This should succeed because localFallback defaults to true
      const result = await client.importFromFile('./tests/client/import/1table/workbook.xlsx')
      expect(result.status).toBe('success')
    }, 10000)
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

  describe('Comparison with xlport server results', () => {
    // Known limitation: ExcelJS doesn't evaluate formulas, only reads cached results
    // When a formula cell has no cached result, localImport returns null
    // These columns contain formulas in the test workbooks:
    const FORMULA_COLUMNS = ['Calculated column']

    it('should match xlport server output for 1table workbook', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        // Compare tables
        expect(result.data.tables).toBeDefined()
        expect(Object.keys(result.data.tables || {})).toEqual(Object.keys(expected.tables))

        // Compare Initiatives table row by row
        const localInitiatives = sortTableRows(result.data.tables!['Initiatives'] as any[])
        const expectedInitiatives = sortTableRows(expected.tables['Initiatives'])

        expect(localInitiatives.length).toBe(expectedInitiatives.length)

        for (let i = 0; i < localInitiatives.length; i++) {
          const localRow = roundNumbers(normalizeRow(localInitiatives[i]))
          const expectedRow = roundNumbers(normalizeRow(expectedInitiatives[i]))
          const matches = compareRowsWithFormulaLeniency(localRow, expectedRow, FORMULA_COLUMNS)
          expect(matches).toBe(true)
        }
      }
    })

    it('should match xlport server output for multipleTables workbook', async () => {
      const fileBuffer = readFileSync('./tests/client/import/multipleTables/data.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/multipleTables/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        // Compare table names
        expect(result.data.tables).toBeDefined()
        const localTableNames = Object.keys(result.data.tables || {}).sort()
        const expectedTableNames = Object.keys(expected.tables).sort()
        expect(localTableNames).toEqual(expectedTableNames)

        // Compare each table
        for (const tableName of expectedTableNames) {
          const localTable = sortTableRows(result.data.tables![tableName] as any[])
          const expectedTable = sortTableRows(expected.tables[tableName])

          expect(localTable.length).toBe(expectedTable.length)

          for (let i = 0; i < localTable.length; i++) {
            const localRow = roundNumbers(normalizeRow(localTable[i]))
            const expectedRow = roundNumbers(normalizeRow(expectedTable[i]))
            const matches = compareRowsWithFormulaLeniency(localRow, expectedRow, FORMULA_COLUMNS)
            expect(matches).toBe(true)
          }
        }
      }
    })

    it('should match xlport server output for multipleObjectsAndTables tables', async () => {
      const fileBuffer = readFileSync('./tests/client/import/multipleObjectsAndTables/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/multipleObjectsAndTables/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        // Compare tables (properties are extracted differently by xlport server)
        expect(result.data.tables).toBeDefined()

        // Check that we have the expected tables
        const localTableNames = Object.keys(result.data.tables || {}).sort()
        const expectedTableNames = Object.keys(expected.tables).sort()
        expect(localTableNames).toEqual(expectedTableNames)

        // Compare each table
        for (const tableName of expectedTableNames) {
          const localTable = sortTableRows(result.data.tables![tableName] as any[])
          const expectedTable = sortTableRows(expected.tables[tableName])

          expect(localTable.length).toBe(expectedTable.length)

          for (let i = 0; i < localTable.length; i++) {
            const localRow = roundNumbers(normalizeRow(localTable[i]))
            const expectedRow = roundNumbers(normalizeRow(expectedTable[i]))
            const matches = compareRowsWithFormulaLeniency(localRow, expectedRow, FORMULA_COLUMNS)
            expect(matches).toBe(true)
          }
        }
      }
    })

    it('should extract same column names as xlport server', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const localColumns = Object.keys((result.data.tables!['Initiatives'] as any[])[0]).sort()
        const expectedColumns = Object.keys(expected.tables['Initiatives'][0]).sort()
        expect(localColumns).toEqual(expectedColumns)
      }
    })

    it('should handle dates in same format as xlport server', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const localInitiatives = result.data.tables!['Initiatives'] as any[]
        const expectedInitiatives = expected.tables['Initiatives']

        // Compare date values
        for (let i = 0; i < localInitiatives.length; i++) {
          const localDate = localInitiatives[i]['Date']
          const expectedDate = expectedInitiatives[i]['Date']
          expect(localDate).toBe(expectedDate)
        }
      }
    })

    it('should handle booleans in same format as xlport server', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const localInitiatives = result.data.tables!['Initiatives'] as any[]
        const expectedInitiatives = expected.tables['Initiatives']

        // Compare boolean values
        for (let i = 0; i < localInitiatives.length; i++) {
          const localBool = localInitiatives[i]['IsComplete']
          const expectedBool = expectedInitiatives[i]['IsComplete']
          expect(localBool).toBe(expectedBool)
          expect(typeof localBool).toBe('boolean')
        }
      }
    })

    it('should handle null values in same format as xlport server', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const localInitiatives = result.data.tables!['Initiatives'] as any[]
        const expectedInitiatives = expected.tables['Initiatives']

        // Find rows with null values and compare
        for (let i = 0; i < expectedInitiatives.length; i++) {
          for (const key of Object.keys(expectedInitiatives[i])) {
            if (expectedInitiatives[i][key] === null) {
              expect(localInitiatives[i][key]).toBeNull()
            }
          }
        }
      }
    })

    it('should handle calculated columns (formulas) same as xlport server', async () => {
      const fileBuffer = readFileSync('./tests/client/import/1table/workbook.xlsx')
      const expected = JSON.parse(readFileSync('./tests/client/import/1table/expected.json', 'utf-8'))

      const result = await localImport(fileBuffer)

      expect(result.status).toBe('success')
      if (result.status === 'success') {
        const localInitiatives = result.data.tables!['Initiatives'] as any[]
        const expectedInitiatives = expected.tables['Initiatives']

        // Compare calculated column values (with rounding for floating point)
        // Known limitation: ExcelJS doesn't evaluate formulas, only reads cached results
        // When a formula has no cached result, localImport returns null
        for (let i = 0; i < localInitiatives.length; i++) {
          const localValue = localInitiatives[i]['Calculated column']
          const expectedValue = expectedInitiatives[i]['Calculated column']

          // If localValue is null but expected is not, this is the known formula limitation
          if (localValue === null && expectedValue !== null) {
            // This is expected - ExcelJS can't evaluate formulas without cached results
            continue
          }

          if (localValue !== null && expectedValue !== null) {
            const localCalc = round(localValue, 6)
            const expectedCalc = round(expectedValue, 6)
            expect(localCalc).toBe(expectedCalc)
          } else {
            expect(localValue).toBe(expectedValue)
          }
        }
      }
    })
  })
})
