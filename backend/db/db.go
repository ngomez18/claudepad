package db

import (
	"context"
	"database/sql"
	"embed"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// DB wraps a SQLite connection with migration support.
type DB struct {
	conn *sql.DB
}

// Open opens (or creates) the SQLite database at path, runs all pending
// migrations, and returns a ready-to-use DB.
func Open(path string) (*DB, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return nil, err
	}

	conn, err := sql.Open("sqlite", path+"?_journal_mode=WAL&_foreign_keys=on&_busy_timeout=5000")
	if err != nil {
		return nil, err
	}
	conn.SetMaxOpenConns(1)

	migFS, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		conn.Close()
		return nil, err
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, conn, migFS)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if _, err := provider.Up(context.Background()); err != nil {
		conn.Close()
		return nil, err
	}

	return &DB{conn: conn}, nil
}

// Close closes the underlying database connection.
func (d *DB) Close() error {
	return d.conn.Close()
}
