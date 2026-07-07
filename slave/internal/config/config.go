package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	API      APIConfig      `yaml:"api"`
	Sync     SyncConfig     `yaml:"sync"`
	Database DatabaseConfig `yaml:"database"`
	Server   ServerConfig   `yaml:"server"`
}

type APIConfig struct {
	BaseURL    string `yaml:"base_url"`
	APIKey     string `yaml:"api_key"`
	HMACSecret string `yaml:"hmac_secret"`
	StoreCode  string `yaml:"store_code"`
	Timeout    int    `yaml:"timeout"`
}

type SyncConfig struct {
	Interval   string   `yaml:"interval"`
	Categories []string `yaml:"categories"`
}

type DatabaseConfig struct {
	Path string `yaml:"path"`
}

type ServerConfig struct {
	Port int `yaml:"port"`
}

func (c *Config) Validate() error {
	if c.API.BaseURL == "" {
		return fmt.Errorf("api.base_url is required")
	}
	if c.API.APIKey == "" {
		return fmt.Errorf("api.api_key is required")
	}
	if c.API.StoreCode == "" {
		return fmt.Errorf("api.store_code is required")
	}
	if c.Sync.Interval == "" {
		c.Sync.Interval = "@every 5m"
	}
	if c.Database.Path == "" {
		c.Database.Path = "data/slave.db"
	}
	if c.Server.Port == 0 {
		c.Server.Port = 8080
	}
	if c.API.Timeout == 0 {
		c.API.Timeout = 30
	}
	return nil
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, err
	}

	return &cfg, nil
}
