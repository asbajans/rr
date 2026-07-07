package sync

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/asbajans/rr/slave/internal/db"
)

type OrderPayload struct {
	ID        string      `json:"id"`
	Products  []OrderItem `json:"products"`
	Total     float64     `json:"total"`
	Currency  string      `json:"currency"`
	Status    string      `json:"status"`
	Customer  Customer    `json:"customer"`
	CreatedAt string      `json:"created_at"`
}

type OrderItem struct {
	ProductCode string  `json:"product_code"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
}

type Customer struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Phone string `json:"phone"`
}

func (s *Syncer) PushOrders() error {
	orders, err := s.db.GetUnsyncedOrders()
	if err != nil {
		return fmt.Errorf("get unsynced orders: %w", err)
	}

	if len(orders) == 0 {
		return nil
	}

	var pushed int
	for _, o := range orders {
		var payload OrderPayload
		if err := json.Unmarshal([]byte(o.Data), &payload); err != nil {
			s.db.LogSync("orders", "error", fmt.Sprintf("unmarshal %s: %v", o.ID, err))
			continue
		}

		_, err := s.client.Post("/api/orders", payload)
		if err != nil {
			s.db.LogSync("orders", "error", fmt.Sprintf("push %s: %v", o.ID, err))
			continue
		}

		if err := s.db.MarkOrderSynced(o.ID); err != nil {
			return fmt.Errorf("mark synced %s: %w", o.ID, err)
		}
		pushed++
	}

	s.db.LogSync("orders", "ok", fmt.Sprintf("pushed %d/%d orders", pushed, len(orders)))
	return nil
}

func (s *Syncer) CreateLocalOrder(order db.Order) error {
	raw, err := json.Marshal(order)
	if err != nil {
		return fmt.Errorf("marshal order: %w", err)
	}

	localOrder := db.Order{
		ID:        order.ID,
		Data:      string(raw),
		Synced:    false,
		CreatedAt: time.Now(),
	}

	return s.db.SaveOrder(localOrder)
}
