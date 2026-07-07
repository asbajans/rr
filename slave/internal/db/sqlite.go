package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
}

type Product struct {
	ID        string    `json:"id"`
	Code      string    `json:"code"`
	Label     string    `json:"label"`
	Price     float64   `json:"price"`
	Stock     int       `json:"stock"`
	Image     string    `json:"image"`
	Status    int       `json:"status"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Order struct {
	ID        string    `json:"id"`
	Data      string    `json:"data"`
	Synced    bool      `json:"synced"`
	CreatedAt time.Time `json:"created_at"`
}

func Open(path string) (*DB, error) {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("create data dir: %w", err)
	}

	conn, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	conn.SetMaxOpenConns(1)

	db := &DB{conn: conn}
	if err := db.migrate(); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return db, nil
}

func (d *DB) Close() error {
	return d.conn.Close()
}

func (d *DB) migrate() error {
	schema := `
	CREATE TABLE IF NOT EXISTS products (
		id TEXT PRIMARY KEY,
		code TEXT NOT NULL UNIQUE,
		label TEXT NOT NULL,
		price REAL DEFAULT 0,
		stock INTEGER DEFAULT 0,
		image TEXT DEFAULT '',
		status INTEGER DEFAULT 1,
		updated_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS orders (
		id TEXT PRIMARY KEY,
		data TEXT NOT NULL,
		synced INTEGER DEFAULT 0,
		created_at TEXT NOT NULL DEFAULT (datetime('now'))
	);

	CREATE TABLE IF NOT EXISTS sync_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		category TEXT NOT NULL,
		status TEXT NOT NULL,
		message TEXT DEFAULT '',
		started_at TEXT NOT NULL,
		finished_at TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
	CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(synced);
	`
	_, err := d.conn.Exec(schema)
	return err
}

func (d *DB) UpsertProduct(p Product) error {
	_, err := d.conn.Exec(`
		INSERT INTO products (id, code, label, price, stock, image, status, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(code) DO UPDATE SET
			label = excluded.label,
			price = excluded.price,
			stock = excluded.stock,
			image = excluded.image,
			status = excluded.status,
			updated_at = excluded.updated_at
	`, p.ID, p.Code, p.Label, p.Price, p.Stock, p.Image, p.Status, p.UpdatedAt)
	return err
}

func (d *DB) GetProduct(code string) (*Product, error) {
	p := &Product{}
	err := d.conn.QueryRow(`
		SELECT id, code, label, price, stock, image, status, updated_at
		FROM products WHERE code = ?
	`, code).Scan(&p.ID, &p.Code, &p.Label, &p.Price, &p.Stock, &p.Image, &p.Status, &p.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return p, err
}

func (d *DB) GetProducts() ([]Product, error) {
	rows, err := d.conn.Query(`
		SELECT id, code, label, price, stock, image, status, updated_at
		FROM products ORDER BY updated_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []Product
	for rows.Next() {
		var p Product
		if err := rows.Scan(&p.ID, &p.Code, &p.Label, &p.Price, &p.Stock, &p.Image, &p.Status, &p.UpdatedAt); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, nil
}

func (d *DB) SaveOrder(o Order) error {
	_, err := d.conn.Exec(`
		INSERT INTO orders (id, data, synced, created_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(id) DO NOTHING
	`, o.ID, o.Data, boolToInt(o.Synced), o.CreatedAt)
	return err
}

func (d *DB) GetUnsyncedOrders() ([]Order, error) {
	rows, err := d.conn.Query(`
		SELECT id, data, synced, created_at FROM orders WHERE synced = 0 ORDER BY created_at ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []Order
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.Data, &o.Synced, &o.CreatedAt); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}

func (d *DB) MarkOrderSynced(id string) error {
	_, err := d.conn.Exec(`UPDATE orders SET synced = 1 WHERE id = ?`, id)
	return err
}

func (d *DB) LogSync(category, status, message string) error {
	_, err := d.conn.Exec(`
		INSERT INTO sync_log (category, status, message, started_at, finished_at)
		VALUES (?, ?, ?, datetime('now'), datetime('now'))
	`, category, status, message)
	return err
}

func (d *DB) GetSyncLog(limit int) ([]map[string]string, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := d.conn.Query(`
		SELECT category, status, message, started_at, finished_at
		FROM sync_log ORDER BY id DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []map[string]string
	for rows.Next() {
		var category, status, message, started, finished string
		if err := rows.Scan(&category, &status, &message, &started, &finished); err != nil {
			return nil, err
		}
		logs = append(logs, map[string]string{
			"category":    category,
			"status":      status,
			"message":     message,
			"started_at":  started,
			"finished_at": finished,
		})
	}
	return logs, nil
}

func (d *DB) CountProducts() (int, error) {
	var count int
	err := d.conn.QueryRow(`SELECT COUNT(*) FROM products`).Scan(&count)
	return count, err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
