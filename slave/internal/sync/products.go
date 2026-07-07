package sync

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/asbajans/rr/slave/internal/db"
)

type ProductAPIResponse struct {
	Data []ProductItem `json:"data"`
}

type ProductItem struct {
	ID     string  `json:"id"`
	Code   string  `json:"code"`
	Label  string  `json:"label"`
	Price  float64 `json:"price"`
	Stock  int     `json:"stock"`
	Image  string  `json:"image"`
	Status int     `json:"status"`
}

func (s *Syncer) SyncProducts() error {
	start := time.Now()

	resp, err := s.client.Get("/api/products")
	if err != nil {
		s.db.LogSync("products", "error", fmt.Sprintf("fetch failed: %v", err))
		return fmt.Errorf("fetch products: %w", err)
	}

	var apiResp ProductAPIResponse
	if err := json.Unmarshal(resp, &apiResp); err != nil {
		s.db.LogSync("products", "error", fmt.Sprintf("parse failed: %v", err))
		return fmt.Errorf("parse products: %w", err)
	}

	var updated int
	for _, p := range apiResp.Data {
		product := db.Product{
			ID:        p.ID,
			Code:      p.Code,
			Label:     p.Label,
			Price:     p.Price,
			Stock:     p.Stock,
			Image:     p.Image,
			Status:    p.Status,
			UpdatedAt: time.Now(),
		}
		if err := s.db.UpsertProduct(product); err != nil {
			s.db.LogSync("products", "warning", fmt.Sprintf("upsert %s: %v", p.Code, err))
			continue
		}
		updated++
	}

	msg := fmt.Sprintf("synced %d/%d products in %s", updated, len(apiResp.Data), time.Since(start))
	s.db.LogSync("products", "ok", msg)
	return nil
}

func (s *Syncer) SyncStock(code string, stock int) error {
	data := map[string]interface{}{
		"sku":   code,
		"stock": stock,
	}

	_, err := s.client.Put("/api/stocks", data)
	if err != nil {
		return fmt.Errorf("sync stock %s: %w", code, err)
	}

	return nil
}

type RemoteProductItem struct {
	ProductID string  `json:"product.id"`
	Code      string  `json:"product.code"`
	Label     string  `json:"product.label"`
	Price     float64 `json:"price"`
	Stock     int     `json:"stock"`
	Image     string  `json:"image"`
	Status    int     `json:"product.status"`
}

type RemoteProductResponse struct {
	Data []RemoteProductItem `json:"data"`
	Page map[string]int      `json:"page"`
}
