package sync

import (
	"github.com/asbajans/rr/slave/internal/config"
	"github.com/asbajans/rr/slave/internal/db"
)

type Syncer struct {
	client *Client
	db     *db.DB
}

func NewSyncer(cfg *config.Config, database *db.DB) *Syncer {
	client := NewClient(
		cfg.API.BaseURL,
		cfg.API.APIKey,
		cfg.API.HMACSecret,
		cfg.API.StoreCode,
		cfg.API.Timeout,
	)

	return &Syncer{
		client: client,
		db:     database,
	}
}

func (s *Syncer) SyncAll() {
	s.SyncProducts()
	s.PushOrders()
}
