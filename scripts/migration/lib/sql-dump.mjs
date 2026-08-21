import { createReadStream } from 'node:fs'

/**
 * Stream complete SQL statements without loading an entire WordPress dump.
 * The scanner only treats semicolons outside SQL string/identifier quotes as
 * delimiters. MySQL version comments are returned as ordinary statements and
 * ignored by the caller.
 */
export async function* readSqlStatements(inputPath) {
  const stream = createReadStream(inputPath, { encoding: 'utf8', highWaterMark: 1024 * 1024 })
  let statement = ''
  let quote = null
  let escaped = false

  for await (const chunk of stream) {
    for (let index = 0; index < chunk.length; index += 1) {
      const character = chunk[index]
      statement += character

      if (quote) {
        if (escaped) {
          escaped = false
          continue
        }
        if (character === '\\' && quote !== '`') {
          escaped = true
          continue
        }
        if (character === quote) {
          const next = chunk[index + 1]
          if (next === quote && quote !== '`') {
            statement += next
            index += 1
          } else {
            quote = null
          }
        }
        continue
      }

      if (character === "'" || character === '"' || character === '`') {
        quote = character
        continue
      }

      if (character === ';') {
        const value = statement.trim()
        if (value) yield value
        statement = ''
      }
    }
  }

  if (quote) throw new Error(`Unterminated ${quote} quote at end of SQL dump`)
  const trailing = statement.trim()
  if (trailing) yield trailing
}

export function parseCreateTable(statement) {
  const match = statement.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([^`\s(]+)`?\s*\(/i)
  if (!match) return null

  const table = match[1]
  const openIndex = statement.indexOf('(', match.index + match[0].length - 1)
  if (openIndex < 0) return null

  const columns = []
  const body = statement.slice(openIndex + 1)
  const columnPattern = /(?:^|,\s*|\n\s*)`([^`]+)`\s+[a-z]/gim
  let columnMatch
  while ((columnMatch = columnPattern.exec(body))) columns.push(columnMatch[1])

  return { table, columns }
}

export function parseInsertHeader(statement) {
  const match = statement.match(/^(?:INSERT|REPLACE)\s+INTO\s+`?([^`\s(]+)`?\s*(?:\(([^)]*)\))?\s+VALUES\s*/i)
  if (!match) return null
  const columns = match[2]
    ? [...match[2].matchAll(/`([^`]+)`|([a-zA-Z0-9_]+)/g)].map((column) => column[1] ?? column[2])
    : null
  return { table: match[1], columns, valuesStart: match[0].length }
}

function decodeEscape(character) {
  switch (character) {
    case '0': return '\0'
    case 'b': return '\b'
    case 'n': return '\n'
    case 'r': return '\r'
    case 't': return '\t'
    case 'Z': return '\x1a'
    default: return character
  }
}

function readQuotedValue(source, start) {
  const quote = source[start]
  let value = ''
  let index = start + 1
  while (index < source.length) {
    const character = source[index]
    if (character === '\\') {
      index += 1
      if (index >= source.length) throw new Error('Trailing escape in SQL string')
      value += decodeEscape(source[index])
      index += 1
      continue
    }
    if (character === quote) {
      if (source[index + 1] === quote) {
        value += quote
        index += 2
        continue
      }
      return { value, next: index + 1 }
    }
    value += character
    index += 1
  }
  throw new Error('Unterminated SQL string literal')
}

function readBareValue(source, start) {
  let index = start
  while (index < source.length && source[index] !== ',' && source[index] !== ')') index += 1
  const raw = source.slice(start, index).trim()
  return { value: /^NULL$/i.test(raw) ? null : raw, next: index }
}

/** Parse the VALUES tuples from an INSERT/REPLACE statement. */
export function parseInsertRows(statement, header) {
  const rows = []
  let index = header.valuesStart

  while (index < statement.length) {
    while (index < statement.length && /[\s,;]/.test(statement[index])) index += 1
    if (index >= statement.length) break
    if (statement[index] !== '(') throw new Error(`Expected tuple at SQL offset ${index}`)
    index += 1

    const row = []
    while (index < statement.length) {
      while (index < statement.length && /\s/.test(statement[index])) index += 1
      const result = statement[index] === "'" || statement[index] === '"'
        ? readQuotedValue(statement, index)
        : readBareValue(statement, index)
      row.push(result.value)
      index = result.next
      while (index < statement.length && /\s/.test(statement[index])) index += 1

      if (statement[index] === ',') {
        index += 1
        continue
      }
      if (statement[index] === ')') {
        index += 1
        break
      }
      throw new Error(`Expected comma or tuple terminator at SQL offset ${index}`)
    }
    rows.push(row)
  }

  return rows
}

export function rowObject(columns, values) {
  if (!columns?.length) throw new Error('Cannot map an INSERT without a CREATE TABLE or explicit column list')
  if (columns.length !== values.length) {
    throw new Error(`Column/value mismatch: ${columns.length} columns, ${values.length} values`)
  }
  return Object.fromEntries(columns.map((column, index) => [column, values[index]]))
}
