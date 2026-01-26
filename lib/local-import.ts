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
 */
function extractDefinedNames(
  workbook: ExcelJS.Workbook,
  requestedProperties: string[],
  extractAll: boolean,
): Record<string, Import.Property> {
  const properties: Record<string, Import.Property> = {}
  const sheetProperties: Record<string, Record<string, Primitives>> = {}

  // Get all defined names from the workbook
  const definedNames = (workbook as any).definedNames

  if (!definedNames || !definedNames._matrixMap) {
    return properties
  }

  // Iterate through defined names
  for (const [name, matrix] of Object.entries(definedNames._matrixMap)) {
    // Skip if not requested and not extracting all
    if (!extractAll && !requestedProperties.includes(name)) {
      continue
    }

    // Skip table-related names (they start with _xlnm)
    if (name.startsWith('_xlnm')) {
      continue
    }

    const ranges = (matrix as any).getMatrix()
    if (!ranges || Object.keys(ranges).length === 0) {
      continue
    }

    // Get the first (and typically only) reference
    for (const [sheetId, sheetRanges] of Object.entries(ranges)) {
      for (const [, rowRanges] of Object.entries(sheetRanges as any)) {
        for (const [, cellRef] of Object.entries(rowRanges as any)) {
          const refStr = cellRef as string
          const value = getValueFromReference(workbook, refStr)

          // Check if this is a sheet-scoped name
          const sheet = workbook.getWorksheet(parseInt(sheetId))
          if (sheet && isSheetScopedName(definedNames, name, sheet.name)) {
            if (!sheetProperties[sheet.name]) {
              sheetProperties[sheet.name] = {}
            }
            sheetProperties[sheet.name][name] = value
          } else {
            properties[name] = value
          }
          break
        }
        break
      }
      break
    }
  }

  // Merge sheet-specific properties
  for (const [sheetName, props] of Object.entries(sheetProperties)) {
    properties[sheetName] = props
  }

  return properties
}

/**
 * Check if a defined name is sheet-scoped
 */
function isSheetScopedName(definedNames: any, name: string, sheetName: string): boolean {
  // ExcelJS stores sheet-scoped names differently
  // For simplicity, we'll check if there are multiple definitions with the same name
  const refs = definedNames.getMatrix(name, sheetName)
  return refs !== undefined
}

/**
 * Get value from a cell reference string
 */
function getValueFromReference(workbook: ExcelJS.Workbook, refStr: string): Primitives {
  // Parse reference like "Sheet1!$A$1" or "'Sheet Name'!$A$1"
  const match = refStr.match(/^(?:'([^']+)'|([^!]+))!\$?([A-Z]+)\$?(\d+)(?::\$?[A-Z]+\$?\d+)?$/)
  if (!match) {
    return null
  }

  const sheetName = match[1] || match[2]
  const col = match[3]
  const row = parseInt(match[4])

  const worksheet = workbook.getWorksheet(sheetName)
  if (!worksheet) {
    return null
  }

  const cell = worksheet.getCell(`${col}${row}`)
  return getCellValue(cell)
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

      const tableData = extractTableData(worksheet, tableRef, tableName, tableInfo)
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
 * Extract data from an Excel table
 */
function extractTableData(
  worksheet: ExcelJS.Worksheet,
  tableRef: string,
  _tableName: string,
  tableInfo: any,
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
  const headers: string[] = []
  const columns = tableInfo.table?.columns || []

  if (columns.length > 0) {
    for (const col of columns) {
      headers.push(col.name)
    }
  } else {
    // Fall back to reading headers from the first row
    for (let col = startCol; col <= endCol; col++) {
      const cell = worksheet.getCell(startRow, col)
      const value = getCellValue(cell)
      headers.push(value !== null ? String(value) : `Column${col}`)
    }
  }

  // Extract data rows (skip header row)
  for (let row = startRow + 1; row <= endRow; row++) {
    const rowData: Record<string, Primitives> = {}
    let hasData = false

    for (let col = startCol; col <= endCol; col++) {
      const header = headers[col - startCol]
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
      return (value as ExcelJS.CellHyperlinkValue).text || (value as ExcelJS.CellHyperlinkValue).hyperlink
    }

    // Shared formula
    if ('sharedFormula' in value) {
      const result = (value as any).result
      if (result instanceof Date) {
        return result.toISOString()
      }
      return result as Primitives
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

