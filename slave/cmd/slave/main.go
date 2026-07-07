package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/asbajans/rr/slave/internal/config"
	"github.com/asbajans/rr/slave/internal/db"
	"github.com/asbajans/rr/slave/internal/scheduler"
)

func main() {
	configPath := flag.String("config", "slave.yaml", "path to configuration file")
	flag.Parse()

	log.SetFlags(log.Ldate | log.Ltime | log.Lshortfile)
	log.Println("[slave] starting Rahatio slave node")

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("[slave] failed to load config: %v", err)
	}

	database, err := db.Open(cfg.Database.Path)
	if err != nil {
		log.Fatalf("[slave] failed to open database: %v", err)
	}
	defer database.Close()

	cronScheduler := scheduler.Start(cfg, database)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		count, _ := database.CountProducts()
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"ok","products":%d}`, count)
	})

	addr := fmt.Sprintf(":%d", cfg.Server.Port)
	server := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go func() {
		log.Printf("[slave] health endpoint on %s/health", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[slave] server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[slave] shutting down...")
	cronScheduler.Stop()
	server.Close()
	log.Println("[slave] stopped")
}
