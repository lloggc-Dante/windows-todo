import Database from 'better-sqlite3'
import initialMigration from './migrations/001_init.sql?raw'
import seriesStartMigration from './migrations/002_series_start.sql?raw'

const MIGRATIONS = [initialMigration, seriesStartMigration]
const CURRENT_SCHEMA_VERSION = MIGRATIONS.length

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

    for (let nextVersion = version; nextVersion < CURRENT_SCHEMA_VERSION; nextVersion += 1) {
      db.transaction(() => {
        db.exec(MIGRATIONS[nextVersion])
      })()
    }

    return db
  } catch (error) {
    db.close()
    throw error
  }
}
