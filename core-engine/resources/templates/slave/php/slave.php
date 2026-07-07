<?php
/**
 * Rahatio Slave Node
 *
 * Tek dosya, sıfır bağımlılık. Paylaşımlı hosting (cPanel, FTP)
 * veya `php -S` ile çalışır.
 *
 * Kullanım:
 *   1. Panelden indir (config otomatik doldurulur)
 *   2. Hostingine yükle
 *   3. Slave otomatik çalışmaya başlar
 */

// ============================================================
//  KONFİGÜRASYON (Panel otomatik doldurur)
// ============================================================
// #CONFIG_START
$_RAHATIO_CONFIG = [
    'api_url'     => 'https://api.rahatio.com.tr',
    'api_key'     => 'YOUR_API_KEY',
    'hmac_secret' => 'YOUR_HMAC_SECRET',
    'store_code'  => 'YOUR_STORE_CODE',
    'cache_dir'   => '__CACHE_DIR__',
    'site_name'   => 'My Rahatio Store',
];
// #CONFIG_END
// ============================================================

// --- Bootstrap ---
date_default_timezone_set('UTC');
$cfg = $_RAHATIO_CONFIG;

if ($cfg['cache_dir'] === '__CACHE_DIR__') {
    $cfg['cache_dir'] = sys_get_temp_dir() . '/rahatio-slave';
}

if (!is_dir($cfg['cache_dir'])) {
    @mkdir($cfg['cache_dir'], 0755, true);
}

// --- Router ---
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri    = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri    = rtrim($uri, '/') ?: '/';

// Vercel support: rewrite /api/* → api/index.php?route=...
$vercelRoute = $_GET['_route'] ?? null;
if ($vercelRoute) {
    $uri = '/' . ltrim($vercelRoute, '/');
}

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Signature, X-Timestamp, X-Store-Code');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Route matching ---
try {
    if ($uri === '/' || $uri === '/health') {
        health($cfg);
    } elseif ($uri === '/slave-config') {
        configInfo($cfg);
    } elseif ($uri === '/api/sync' && $method === 'POST') {
        syncFromCore($cfg);
    } elseif ($uri === '/api/products' && $method === 'GET') {
        listProducts($cfg);
    } elseif (preg_match('#^/api/products/(\d+)$#', $uri, $m) && $method === 'GET') {
        getProduct($cfg, $m[1]);
    } elseif ($uri === '/api/orders' && $method === 'POST') {
        receiveOrder($cfg);
    } else {
        notFound();
    }
} catch (Throwable $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

// ============================================================
//  HANDLER'LAR
// ============================================================

function health(array $cfg): void {
    $cacheSize = 0;
    $cacheDir = $cfg['cache_dir'];
    if (is_dir($cacheDir)) {
        foreach (glob($cacheDir . '/*.json') as $f) {
            $cacheSize += filesize($f);
        }
    }

    jsonResponse([
        'status'    => 'ok',
        'version'   => '1.0.0',
        'platform'  => 'php',
        'store'     => $cfg['store_code'],
        'site'      => $cfg['site_name'],
        'php'       => PHP_VERSION,
        'cache_dir' => $cacheDir,
        'cache_mb'  => round($cacheSize / 1024 / 1024, 2),
        'time'      => date('c'),
    ]);
}

function configInfo(array $cfg): void {
    jsonResponse([
        'api_url'     => $cfg['api_url'],
        'store_code'  => $cfg['store_code'],
        'site_name'   => $cfg['site_name'],
        'cache_dir'   => $cfg['cache_dir'],
        'php_version' => PHP_VERSION,
    ]);
}

function syncFromCore(array $cfg): void {
    $client = new CoreClient($cfg);
    $products = $client->get('/api/products');

    $cacheFile = $cfg['cache_dir'] . '/products.json';
    $data = [
        'synced_at' => date('c'),
        'products'  => $products['data'] ?? $products ?? [],
    ];
    file_put_contents($cacheFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    jsonResponse(['status' => 'synced', 'count' => count($data['products']), 'time' => $data['synced_at']]);
}

function listProducts(array $cfg): void {
    $cacheFile = $cfg['cache_dir'] . '/products.json';
    if (!is_file($cacheFile)) {
        syncFromCore($cfg);
    }

    $data = json_decode(file_get_contents($cacheFile), true) ?? ['products' => []];
    // Filter only what we need
    $list = array_map(fn($p) => [
        'id'     => $p['product.id'] ?? $p['id'] ?? null,
        'code'   => $p['product.code'] ?? $p['code'] ?? '',
        'label'  => $p['product.label'] ?? $p['label'] ?? '',
        'price'  => $p['price'] ?? null,
        'stock'  => $p['stock'] ?? null,
        'image'  => $p['image'] ?? null,
        'status' => $p['product.status'] ?? $p['status'] ?? 1,
    ], $data['products']);

    jsonResponse(['data' => $list, 'total' => count($list), 'synced_at' => $data['synced_at'] ?? null]);
}

function getProduct(array $cfg, string $id): void {
    $cacheFile = $cfg['cache_dir'] . '/products.json';
    if (!is_file($cacheFile)) {
        syncFromCore($cfg);
    }

    $data = json_decode(file_get_contents($cacheFile), true) ?? ['products' => []];
    foreach ($data['products'] as $p) {
        $pid = $p['product.id'] ?? $p['id'] ?? null;
        if ((string)$pid === $id) {
            jsonResponse($p);
            return;
        }
    }

    // Fallback: fetch from core
    $client = new CoreClient($cfg);
    try {
        $product = $client->get("/api/products/$id");
        jsonResponse($product);
    } catch (Throwable $e) {
        jsonResponse(['error' => 'Product not found'], 404);
    }
}

function receiveOrder(array $cfg): void {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input || empty($input['id'])) {
        jsonResponse(['error' => 'Invalid order data'], 400);
    }

    // Save to local cache
    $ordersFile = $cfg['cache_dir'] . '/orders.json';
    $orders = is_file($ordersFile) ? json_decode(file_get_contents($ordersFile), true) : [];
    $orders[] = array_merge($input, ['received_at' => date('c'), 'synced' => false]);
    file_put_contents($ordersFile, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

    // Try to push to core
    $client = new CoreClient($cfg);
    try {
        $client->post('/api/orders', $input);
        // Mark as synced locally
        $orders = json_decode(file_get_contents($ordersFile), true) ?? [];
        foreach ($orders as $i => $o) {
            if (($o['id'] ?? '') === $input['id']) {
                $orders[$i]['synced'] = true;
                $orders[$i]['synced_at'] = date('c');
                break;
            }
        }
        file_put_contents($ordersFile, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    } catch (Throwable $e) {
        // Will sync later
    }

    jsonResponse(['status' => 'received', 'order_id' => $input['id']], 201);
}

function notFound(): void {
    jsonResponse(['error' => 'Not found', 'path' => $_SERVER['REQUEST_URI'] ?? '/'], 404);
}

// ============================================================
//  CORE API CLIENT (HMAC)
// ============================================================

class CoreClient
{
    private string $baseUrl;
    private string $apiKey;
    private string $hmacSecret;
    private string $storeCode;

    public function __construct(array $cfg)
    {
        $this->baseUrl    = rtrim($cfg['api_url'], '/');
        $this->apiKey     = $cfg['api_key'];
        $this->hmacSecret = $cfg['hmac_secret'];
        $this->storeCode  = $cfg['store_code'];
    }

    public function get(string $path): array
    {
        return $this->request('GET', $path);
    }

    public function post(string $path, array $data): array
    {
        return $this->request('POST', $path, $data);
    }

    public function put(string $path, array $data): array
    {
        return $this->request('PUT', $path, $data);
    }

    private function request(string $method, string $path, ?array $data = null): array
    {
        $body = $data ? json_encode($data) : '';
        $timestamp = (string) time();
        $pathClean = ltrim($path, '/');

        $payload = "$method\n$pathClean\n$timestamp\n$body";
        $signature = hash_hmac('sha256', $payload, $this->hmacSecret);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $this->baseUrl . '/' . $pathClean,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_POSTFIELDS     => $body ?: null,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Accept: application/json',
                'X-API-Key: ' . $this->apiKey,
                'X-Timestamp: ' . $timestamp,
                'X-Signature: ' . $signature,
                'X-Store-Code: ' . $this->storeCode,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error    = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("Core API error: $error");
        }

        $decoded = json_decode($response, true);
        if ($httpCode >= 400) {
            $msg = $decoded['error'] ?? $decoded['message'] ?? "HTTP $httpCode";
            throw new RuntimeException("Core API error ($httpCode): $msg");
        }

        return $decoded ?? [];
    }
}

// ============================================================
//  JSON YARDIMCI
// ============================================================

function jsonResponse(array $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
