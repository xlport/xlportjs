import ExcelJS from 'exceljs'
import { Import } from './import.types'
import { Primitives } from './shared.types'

/**
 * Local Excel import implementation using ExcelJS.
 * Used as a fallback when the xlport server cannot be reached.
 */
export async function localImport(
  fileBuffer: Buffer,
  request: Import.Request = Import.defaultRequest,
): Promise<Import.Response> {
  try {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(fileBuffer)

    const data: Import.Data = {}
    const extractAllProperties = request.properties.includes('*')
    const extractAllTables = !!(request.tables && Array.isArray(request.tables) && request.tables[0] === '*')

    // Extract properties (named ranges/defined names)
    const properties = extractDefinedNames(workbook, request.properties, extractAllProperties)
    if (Object.keys(properties).length > 0) {
      data.properties = properties
    }

    // Extract tables
    const tables = extractTables(workbook, request.tables, extractAllTables)
    if (Object.keys(tables).length > 0) {
      data.tables = tables
    }

    return {
      status: 'success',
      data,
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error during local import',
    }
  }
}

/**
 * Extract defined names (named ranges) from the workbook.
 * These become properties in the output.
 * Uses ExcelJS public forEach API to iterate over defined names.
 */
function extractDefinedNames(
  workbook: ExcelJS.Workbook,
  requestedProperties: string[],
  extractAll: boolean,
): Record<string, Import.Property> {
  const properties: Record<string, Import.Property> = {}
  const sheetProperties: Record<string, Record<string, Primitives>> = {}

  // Use the public forEach API to iterate over defined names
  // forEach callback receives: (name, range, sheetScope)
  // range is an object with: { sheetName, address, col, row, '$col$row' }
  // Note: ExcelJS TypeScript definitions don't match runtime behavior, so we use 'any'
  const definedNames = workbook.definedNames as any
  if (!definedNames || typeof definedNames.forEach !== 'function') {
    return properties
  }

  definedNames.forEach((name: string, range: DefinedNameRange, sheetScope: string | undefined) => {
    // Skip if not requested and not extracting all
    if (!extractAll && !requestedProperties.includes(name)) {
      return
    }

    // Skip table-related names (they start with _xlnm)
    if (name.startsWith('_xlnm')) {
      return
    }

    // Get the cell value from the range
    const worksheet = workbook.getWorksheet(range.sheetName)
    if (!worksheet) {
      return
    }

    const cell = worksheet.getCell(range.row, range.col)
    const value = getCellValue(cell)

    // If sheetScope is defined, this is a sheet-scoped name
    if (sheetScope) {
      if (!sheetProperties[sheetScope]) {
        sheetProperties[sheetScope] = {}
      }
      sheetProperties[sheetScope][name] = value
    } else {
      properties[name] = value
    }
  })

  // Merge sheet-specific properties
  for (const [sheetName, props] of Object.entries(sheetProperties)) {
    properties[sheetName] = props
  }

  return properties
}

/**
 * Type for the range object passed to definedNames.forEach callback
 */
interface DefinedNameRange {
  sheetName: string
  address: string
  col: number
  row: number
  '$col$row': string
}

/**
 * Extract tables from the workbook.
 */
function extractTables(
  workbook: ExcelJS.Workbook,
  requestedTables: Import.Request['tables'],
  extractAll: boolean,
): Record<string, Import.Table | Import.SheetTables> {
  const tables: Record<string, Import.Table | Import.SheetTables> = {}

  workbook.eachSheet((worksheet) => {
    // Extract Excel tables (ListObjects)
    const sheetTables = (worksheet as any).tables || {}

    for (const [tableName, tableInfo] of Object.entries(sheetTables)) {
      if (!extractAll && !isTableRequested(tableName, requestedTables)) {
        continue
      }

      const tableRef = (tableInfo as any).table?.tableRef
      if (!tableRef) {
        continue
      }

      const requestedColumns = getRequestedColumns(tableName, requestedTables, extractAll)
      const tableData = extractTableData(worksheet, tableRef, tableName, tableInfo, requestedColumns)
      if (tableData.length > 0) {
        tables[tableName] = tableData
      }
    }
  })

  // If no tables found via Excel table objects, try to find tables by detecting
  // contiguous data regions with headers
  if (Object.keys(tables).length === 0 && extractAll) {
    workbook.eachSheet((worksheet) => {
      const detectedTables = detectTablesInSheet(worksheet)
      for (const [tableName, tableData] of Object.entries(detectedTables)) {
        if (tableData.length > 0) {
          tables[tableName] = tableData
        }
      }
    })
  }

  return tables
}

/**
 * Check if a table is requested based on the request configuration
 */
function isTableRequested(
  tableName: string,
  requestedTables: Import.Request['tables'],
): boolean {
  if (!requestedTables) return false
  if (Array.isArray(requestedTables) && requestedTables[0] === '*') return true

  if (Array.isArray(requestedTables)) {
    for (const tableSpec of requestedTables) {
      if (typeof tableSpec === 'object' && tableName in tableSpec) {
        return true
      }
    }
  }

  return false
}

/**
 * Get the requested columns for a specific table.
 * Returns null if all columns should be extracted.
 */
function getRequestedColumns(
  tableName: string,
  requestedTables: Import.Request['tables'],
  extractAll: boolean,
): string[] | null {
  // If extracting all tables, return all columns
  if (extractAll) return null
  if (!requestedTables) return null

  if (Array.isArray(requestedTables)) {
    for (const tableSpec of requestedTables) {
      if (typeof tableSpec === 'object' && tableName in tableSpec) {
        const columns = tableSpec[tableName]
        // If columns array is empty or contains '*', return all columns
        if (columns.length === 0 || columns.includes('*')) {
          return null
        }
        return columns
      }
    }
  }

  return null
}

/**
 * Extract data from an Excel table
 * @param requestedColumns - If provided, only extract these columns. If null, extract all.
 */
function extractTableData(
  worksheet: ExcelJS.Worksheet,
  tableRef: string,
  _tableName: string,
  tableInfo: any,
  requestedColumns: string[] | null = null,
): Import.Table {
  const data: Import.Table = []

  // Parse table reference (e.g., "A1:D10")
  const [startRef, endRef] = tableRef.split(':')
  const startCell = worksheet.getCell(startRef)
  const endCell = worksheet.getCell(endRef)

  // ExcelJS cell.row and cell.col are numbers
  const startRow = Number(startCell.row)
  const endRow = Number(endCell.row)
  const startCol = Number(startCell.col)
  const endCol = Number(endCell.col)

  // Get headers from the first row of the table
  const allHeaders: string[] = []
  const columns = tableInfo.table?.columns || []

  if (columns.length > 0) {
    for (const col of columns) {
      allHeaders.push(col.name)
    }
  } else {
    // Fall back to reading headers from the first row
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getCell(startRow, col)
      const value = getCellValue(cell)
      allHeaders.push(value !== null ? String(value) : `Column${col}`)
    }
  }

  // Determine which columns to include (filter by requestedColumns if specified)
  const columnsToInclude = requestedColumns
    ? allHeaders.filter((h) => requestedColumns.includes(h))
    : allHeaders

  // Extract data rows (skip header row)
  for (let row = startRow + 1; row <= endRow; row++) {
    const rowData: Record<string, Primitives> = {}
    let hasData = false

    for (let col = startCol; col <= endCol; col++) {
      const header = allHeaders[col - startCol]
      if (!header) continue
      // Skip columns not in the requested list
      if (!columnsToInclude.includes(header)) continue

      const cell = worksheet.getCell(row, col)
      const value = getCellValue(cell)
      rowData[header] = value
      if (value !== null) hasData = true
    }

    if (hasData) {
      data.push(rowData)
    }
  }

  return data
}

/**
 * Detect tables in a worksheet by finding contiguous data regions with headers.
 * This is a fallback when no formal Excel tables are defined.
 */
function detectTablesInSheet(worksheet: ExcelJS.Worksheet): Record<string, Import.Table> {
  const tables: Record<string, Import.Table> = {}
  const sheetName = worksheet.name

  // Find the used range
  const dimensions = worksheet.dimensions
  if (!dimensions) {
    return tables
  }

  // Simple heuristic: look for rows that appear to be headers
  // (contain text values) followed by data rows
  const firstRow = Number(dimensions.top)
  const lastRow = Number(dimensions.bottom)
  const firstCol = Number(dimensions.left)
  const lastCol = Number(dimensions.right)

  // Check if first row looks like a header
  const headers: string[] = []

  for (let col = firstCol; col <= lastCol; col++) {
    const cell = worksheet.getCell(firstRow, col)
    const value = getCellValue(cell)
    if (value === null) {
      break
    }
    headers.push(String(value))
  }

  // If we have headers, extract the data
  if (headers.length > 0) {
    const data: Import.Table = []

    for (let row = firstRow + 1; row <= lastRow; row++) {
      const rowData: Record<string, Primitives> = {}
      let hasData = false

      for (let col = firstCol; col <= lastCol; col++) {
        const header = headers[col - firstCol]
        if (!header) continue

        const cell = worksheet.getCell(row, col)
        const value = getCellValue(cell)
        rowData[header] = value
        if (value !== null) hasData = true
      }

      if (hasData) {
        data.push(rowData)
      }
    }

    if (data.length > 0) {
      // Use sheet name as table name if no formal table name exists
      tables[sheetName] = data
    }
  }

  return tables
}

/**
 * Get the value of a cell, converting Excel types to our primitive types.
 */
function getCellValue(cell: ExcelJS.Cell): Primitives {
  const value = cell.value

  if (value === null || value === undefined) {
    return null
  }

  // Handle different cell value types
  if (typeof value === 'object') {
    // Date object
    if (value instanceof Date) {
      return value.toISOString()
    }

    // Rich text
    if ('richText' in value) {
      return (value as ExcelJS.CellRichTextValue).richText
        .map((rt) => rt.text)
        .join('')
    }

    // Formula result
    if ('formula' in value) {
      const formulaValue = value as ExcelJS.CellFormulaValue
      if ('result' in formulaValue && formulaValue.result !== undefined) {
        const result = formulaValue.result
        if (result instanceof Date) {
          return result.toISOString()
        }
        if (typeof result === 'object' && result !== null && 'error' in result) {
          return null // Return null for formula errors
        }
        return result as Primitives
      }
      // Formula without cached result - return null
      // Note: ExcelJS doesn't evaluate formulas, only reads cached results
      return null
    }

    // Hyperlink
    if ('hyperlink' in value) {
      const hyperlinkValue = value as ExcelJS.CellHyperlinkValue
      return hyperlinkValue.text ?? hyperlinkValue.hyperlink ?? null
    }

    // Shared formula
    if ('sharedFormula' in value) {
      const result = (value as any).result
      if (result === undefined) {
        return null // No cached result for shared formula
      }
      if (result instanceof Date) {
        return result.toISOString()
      }
      return result as Primitives ?? null
    }

    // Error value
    if ('error' in value) {
      return null
    }

    return null
  }

  // Boolean
  if (typeof value === 'boolean') {
    return value
  }

  // Number
  if (typeof value === 'number') {
    return value
  }

  // String
  if (typeof value === 'string') {
    return value
  }

  return null
}

