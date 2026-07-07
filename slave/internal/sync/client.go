package sync

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	baseURL    string
	apiKey     string
	hmacSecret string
	storeCode  string
	httpClient *http.Client
}

func NewClient(baseURL, apiKey, hmacSecret, storeCode string, timeout int) *Client {
	return &Client{
		baseURL:    strings.TrimRight(baseURL, "/"),
		apiKey:     apiKey,
		hmacSecret: hmacSecret,
		storeCode:  storeCode,
		httpClient: &http.Client{Timeout: time.Duration(timeout) * time.Second},
	}
}

func (c *Client) sign(method, rawPath, body string) (string, string) {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	path := strings.TrimLeft(rawPath, "/")
	payload := fmt.Sprintf("%s\n%s\n%s\n%s", method, path, timestamp, body)

	mac := hmac.New(sha256.New, []byte(c.hmacSecret))
	mac.Write([]byte(payload))
	signature := hex.EncodeToString(mac.Sum(nil))

	return timestamp, signature
}

func (c *Client) doRequest(method, path string, body io.Reader) (*http.Response, error) {
	var bodyBytes []byte
	if body != nil {
		bodyBytes, _ = io.ReadAll(body)
	}

	req, err := http.NewRequest(method, c.baseURL+path, strings.NewReader(string(bodyBytes)))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	timestamp, signature := c.sign(method, path, string(bodyBytes))
	req.Header.Set("X-API-Key", c.apiKey)
	req.Header.Set("X-Timestamp", timestamp)
	req.Header.Set("X-Signature", signature)
	req.Header.Set("X-Store-Code", c.storeCode)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, fmt.Errorf("api error %d: %s", resp.StatusCode, string(respBody))
	}

	return resp, nil
}

func (c *Client) Get(path string) ([]byte, error) {
	resp, err := c.doRequest(http.MethodGet, path, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (c *Client) Post(path string, data interface{}) ([]byte, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	resp, err := c.doRequest(http.MethodPost, path, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func (c *Client) Put(path string, data interface{}) ([]byte, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	resp, err := c.doRequest(http.MethodPut, path, strings.NewReader(string(body)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
