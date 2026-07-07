package scheduler

import (
	"log"

	"github.com/robfig/cron/v3"

	"github.com/asbajans/rr/slave/internal/config"
	"github.com/asbajans/rr/slave/internal/db"
	"github.com/asbajans/rr/slave/internal/sync"
)

func Start(cfg *config.Config, database *db.DB) *cron.Cron {
	c := cron.New()

	syncer := sync.NewSyncer(cfg, database)

	c.AddFunc(cfg.Sync.Interval, func() {
		log.Println("[sync] starting sync cycle")
		syncer.SyncAll()
		log.Println("[sync] sync cycle complete")
	})

	c.Start()

	// Run initial sync on startup
	go func() {
		log.Println("[sync] initial sync on startup")
		syncer.SyncAll()
	}()

	log.Printf("[scheduler] sync interval: %s", cfg.Sync.Interval)
	return c
}
