import Database from 'better-sqlite3'
import initialMigration from './migrations/001_init.sql?raw'

const CURRENT_SCHEMA_VERSION = 1

export function createDatabase(filename: string): Database.Database {
  const db = new Database(filename)

  try {
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
    db.pragma('journal_mode = WAL')

    const version = db.pragma('user_version', { simple: true }) as number
    if (version > CURRENT_SCHEMA_VERSION) {
      throw new Error('数据库版本较新，请使用新版本应用打开')
    }

    if (version < CURRENT_SCHEMA_VERSION) {
      db.transaction(() => {
        db.exec(initialMigration)
      })()
    }

    return db
  } catch (error) {
    db.close()
    throw error
  }
}
