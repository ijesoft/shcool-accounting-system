/**
 * Splits a SQL script into a list of statements, properly handling:
 * - Line comments (-- ...)
 * - Block comments (/* ... *​/)
 * - Single-quoted string literals with '' escape
 * - Postgres escape strings (E'...' with \X and '' escapes)
 *
 * Dollar-quoted blocks ($$ ... $$) are NOT supported in v1; no current
 * migration uses them.
 *
 * Each returned statement is the trimmed, non-empty body of one `;`-terminated
 * SQL command (without the trailing `;`).
 *
 * Throws if the input contains a non-empty, non-terminated statement at EOF.
 */
export function parseStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let i = 0
  const n = sql.length

  const flush = () => {
    const trimmed = current.trim()
    if (trimmed.length > 0) statements.push(trimmed)
    current = ""
  }

  while (i < n) {
    const c = sql[i]
    const c2 = sql[i + 1]

    if (c === "-" && c2 === "-") {
      while (i < n && sql[i] !== "\n") i++
      continue
    }

    if (c === "/" && c2 === "*") {
      i += 2
      while (i < n && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i += 2
      continue
    }

    if (c === "'") {
      current += c
      i++
      while (i < n) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    if ((c === "E" || c === "e") && c2 === "'") {
      current += c + "'"
      i += 2
      while (i < n) {
        if (sql[i] === "\\" && i + 1 < n) {
          current += sql[i] + sql[i + 1]
          i += 2
        } else if (sql[i] === "'" && sql[i + 1] === "'") {
          current += "''"
          i += 2
        } else if (sql[i] === "'") {
          current += "'"
          i++
          break
        } else {
          current += sql[i]
          i++
        }
      }
      continue
    }

    if (c === ";") {
      flush()
      i++
      continue
    }

    current += c
    i++
  }

  const trailing = current.trim()
  if (trailing.length > 0) {
    throw new Error(
      `Unterminated SQL statement: ${trailing.slice(0, 80)}${trailing.length > 80 ? "..." : ""}`,
    )
  }

  return statements
}
