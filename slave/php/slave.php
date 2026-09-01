<?php
/**
 * Rahatio Slave Node — PHP Storefront + API
 *
 * Tek dosya, sıfır bağımlılık. Paylaşımlı hosting (cPanel, FTP)
 * veya `php -S` ile çalışır. Hem mağaza vitrinini (HTML) hem de
 * senkronizasyon API'sini aynı dosyada sunar.
 *
 * Kullanım:
 *   1. Panelden indir (config otomatik doldurulur) → index.php olarak yükle
 *   2. Hosting köküne .htaccess ekle (aşağıdaki içerik):
 *      ---
 *      RewriteEngine On
 *      RewriteCond %{REQUEST_FILENAME} !-f
 *      RewriteCond %{REQUEST_FILENAME} !-d
 *      RewriteRule ^(.*)$ index.php [QSA,L]
 *      ---
 *      (Bazı hostlarda zaten var; yoksa oluştur.)
 *   3. Tarayıcıdan https://domain.com → vitrin, /health → API health
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
// PHP 7.4 compat — str_* polyfills (PHP 8+)
if (!function_exists('str_starts_with')) { function str_starts_with($haystack, $needle) { return $needle === '' || strpos($haystack, $needle) === 0; } }
if (!function_exists('str_contains')) { function str_contains($haystack, $needle) { return $needle === '' || strpos($haystack, $needle) !== false; } }
if (!function_exists('str_ends_with')) { function str_ends_with($haystack, $needle) { return $needle !== '' && $needle !== null ? substr($haystack, -strlen($needle)) === $needle : true; } }

// --- Router ---
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$uri    = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$uri    = rtrim($uri, '/') ?: '/';
// index.php direkt çağrılırsa kök say
if ($uri === '/index.php' || str_starts_with($uri, '/index.php/')) {
    $uri = substr($uri, 10) ?: '/';
    $uri = rtrim($uri, '/') ?: '/';
    if ($uri === '') $uri = '/';
}
// Vercel support: rewrite /api/* → api/index.php?route=...
$vercelRoute = $_GET['_route'] ?? null;
if ($vercelRoute) {
    $uri = '/' . ltrim($vercelRoute, '/');
}
// CORS (API için)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key, X-Signature, X-Timestamp, X-Store-Code');
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Route matching ---
try {
    if ($uri === '/health') {
        health($cfg);
    } elseif ($uri === '/slave-config') {
        configInfo($cfg);
    } elseif ($uri === '/api/slave/sync' && $method === 'POST') {
        syncFromCore($cfg);
    } elseif ($uri === '/api/slave/products' && $method === 'GET') {
        listProducts($cfg);
    } elseif (preg_match('#^/api/slave/products/(\d+)$#', $uri, $m) && $method === 'GET') {
        getProduct($cfg, $m[1]);
    } elseif ($uri === '/api/slave/orders' && $method === 'POST') {
        receiveOrder($cfg);
    } elseif ($uri === '/' && $method === 'GET') {
        if (isset($_GET['format']) && $_GET['format'] === 'json') {
            listProducts($cfg);
        } else {
            renderStorefront($cfg);
        }
    } elseif ($uri === '/sitemap.xml' && $method === 'GET') {
        renderSitemap($cfg);
    } elseif ($uri === '/robots.txt' && $method === 'GET') {
        renderRobots($cfg);
    } elseif (preg_match('#^/product/(\d+)(?:/.*)?$#', $uri, $m) && $method === 'GET') {
        renderProductDetail($cfg, $m[1]);
    } elseif (isset($_GET['product']) && $method === 'GET') {
        renderProductDetail($cfg, (string)$_GET['product']);
    } elseif ($uri === '/products' && $method === 'GET') {
        renderStorefront($cfg);
    } elseif (preg_match('#^/pages/([^/]+)$#', $uri, $m) && $method === 'GET') {
        renderPage($cfg, $m[1]);
    } elseif ($uri === '/pages' && $method === 'GET') {
        renderPagesList($cfg);
    } elseif (preg_match('#^/blog/([^/]+)$#', $uri, $m) && $method === 'GET') {
        renderBlogPost($cfg, $m[1]);
    } elseif ($uri === '/blog' && $method === 'GET') {
        renderBlogList($cfg);
    } elseif (in_array($uri, ['/cart','/checkout','/account','/sepet','/hesabim']) && $method === 'GET') {
        renderStorefront($cfg, $uri);
    } else {
        // 404 — tarayıcıya HTML, API'ye JSON
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        if (str_contains($accept, 'text/html') || !str_starts_with($uri, '/api/')) {
            renderNotFoundHtml($cfg, $uri);
        } else {
            notFound();
        }
    }
} catch (Throwable $e) {
    $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
    if (str_contains($accept, 'text/html') && !str_starts_with($uri, '/api/')) {
        renderErrorHtml($cfg, $e->getMessage());
    } else {
        jsonResponse(['error' => $e->getMessage()], 500);
    }
}

// ============================================================
//  STOREFRONT HELPERS
// ============================================================

function ensureProductsCache(array $cfg): array {
    $cacheFile = $cfg['cache_dir'] . '/products.json';
    $needsSync = true;
    $data = null;
    if (is_file($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $data = $raw ? json_decode($raw, true) : null;
        if (isset($data['products']) && is_array($data['products'])) {
            $age = time() - (int)@filemtime($cacheFile);
            // Cache 5 dk taze ise direkt kullan, yoksa arka planda yenilemeyi dene
            if ($age < 300) $needsSync = false;
        }
    }
    if ($needsSync) {
        try {
            $client = new CoreClient($cfg);
            $resp = $client->get('/api/slave/products');
            $products = $resp['data'] ?? $resp ?? [];
            if (!is_array($products)) $products = [];
            $data = ['synced_at' => date('c'), 'products' => $products];
            @file_put_contents($cacheFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
        } catch (Throwable $e) {
            // Sync başarısızsa cache varsa onu kullan, yoksa boş (hata log'lanmaz)
            error_log('Rahatio API sync failed: ' . $e->getMessage());
            if (!$data) $data = ['synced_at' => null, 'products' => []];
        }
    }
    return $data ?? ['synced_at' => null, 'products' => []];
}

function findProductById(array $products, string $id): ?array {
    foreach ($products as $p) {
        $pid = $p['product.id'] ?? $p['id'] ?? null;
        if ((string)$pid === (string)$id) return $p;
    }
    return null;
}

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }
function formatPrice($p): string {
    if ($p === null || $p === '' || $p === 0) return '—';
    $n = (float)$p;
    return number_format($n, 2, ',', '.') . ' ₺';
}
function currentBaseUrl(array $cfg): string {
    $proto = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? ($cfg['store_code'] . '.example.com');
    return $proto . '://' . $host;
}
function fetchPublicJson(array $cfg, string $path): ?array {
    $url = rtrim($cfg['api_url'], '/') . $path;
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10, CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_HTTPHEADER=>['Accept: application/json']]);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code>=400 || !$resp) return null;
    $j=json_decode($resp,true);
    return is_array($j)?$j:null;
}
function ensureStoreCache(array $cfg): array {
    $cacheFile = $cfg['cache_dir'] . '/store.json';
    if (is_file($cacheFile) && (time()-filemtime($cacheFile) < 600)) {
        $j=json_decode(@file_get_contents($cacheFile),true);
        if ($j) return $j;
    }
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']));
    if ($data && isset($data['store'])) {
        @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $data;
    }
    return is_file($cacheFile) ? (json_decode(@file_get_contents($cacheFile),true) ?? []) : [];
}

function ensureMenusCache(array $cfg): array {
    $cacheFile = $cfg['cache_dir'] . '/menus.json';
    if (is_file($cacheFile) && (time()-filemtime($cacheFile) < 1800)) {
        $j=json_decode(@file_get_contents($cacheFile),true);
        if (is_array($j) && isset($j['menus'])) return $j;
    }
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/menus');
    if (is_array($data) && isset($data['menus'])) {
        @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $data;
    }
    return is_file($cacheFile) ? (json_decode(@file_get_contents($cacheFile),true) ?? ['menus'=>[]]) : ['menus'=>[]];
}

function ensurePagesCache(array $cfg): array {
    $cacheFile = $cfg['cache_dir'] . '/pages.json';
    if (is_file($cacheFile) && (time()-filemtime($cacheFile) < 1800)) {
        $j=json_decode(@file_get_contents($cacheFile),true);
        if (is_array($j) && isset($j['pages'])) return $j;
    }
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/pages');
    if (is_array($data) && isset($data['pages'])) {
        @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $data;
    }
    return is_file($cacheFile) ? (json_decode(@file_get_contents($cacheFile),true) ?? ['pages'=>[]]) : ['pages'=>[]];
}

function renderSitemap(array $cfg): void {
    $base = currentBaseUrl($cfg);
    $data = ensureProductsCache($cfg);
    $storeData = ensureStoreCache($cfg);
    $products = $data['products'] ?? [];
    header('Content-Type: application/xml; charset=utf-8');
    echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
    echo '  <url><loc>' . h($base . '/') . '</loc><changefreq>daily</changefreq><priority>1.0</priority></url>' . "\n";
    foreach ($products as $p) {
        if (($p['product.status'] ?? $p['status'] ?? 1) != 1) continue;
        $id = $p['product.id'] ?? $p['id'] ?? '';
        if (!$id) continue;
        $slug = $p['slug'] ?? null;
        $loc = $slug ? $base . '/product/' . urlencode($id) . '/' . urlencode($slug) : $base . '/product/' . urlencode($id);
        echo '  <url><loc>' . h($loc) . '</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>' . "\n";
    }
    // sayfalar
    if ($storeData && isset($storeData['store'])) {
        $pages = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/pages');
        if ($pages && isset($pages['pages']) && is_array($pages['pages'])) {
            foreach ($pages['pages'] as $pg) {
                $slug = $pg['slug'] ?? null;
                if (!$slug) continue;
                echo '  <url><loc>' . h($base . '/pages/' . urlencode($slug)) . '</loc><changefreq>weekly</changefreq><priority>0.6</priority></url>' . "\n";
            }
        }
    }
    echo '</urlset>';
    exit;
}
function renderRobots(array $cfg): void {
    $base = currentBaseUrl($cfg);
    header('Content-Type: text/plain; charset=utf-8');
    echo "User-agent: *\nAllow: /\n";
    echo "Sitemap: " . $base . "/sitemap.xml\n";
    exit;
}
function renderPagesList(array $cfg): void {
    $storeData = ensureStoreCache($cfg);
    $pages = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/pages');
    $list = $pages['pages'] ?? [];
    $siteName = $cfg['site_name'] ?? 'Mağaza';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sayfalar — ' . h($siteName) . '</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><header class="border-b bg-white"><div class="mx-auto max-w-6xl px-4 py-3"><a href="/" class="text-sm font-semibold">← ' . h($siteName) . '</a></div></header><main class="mx-auto max-w-6xl px-4 py-8"><h1 class="text-2xl font-bold">Sayfalar</h1><div class="mt-6 grid gap-3">';
    if (!$list) echo '<p class="text-sm text-zinc-500">Sayfa yok.</p>';
    else foreach ($list as $pg) {
        $title = is_array($pg['title']) ? ($pg['title']['tr'] ?? reset($pg['title'])) : ($pg['title'] ?? $pg['slug']);
        echo '<a href="/pages/' . h($pg['slug']) . '" class="rounded-lg border bg-white p-4 hover:shadow">' . h($title) . '</a>';
    }
    echo '</div></main></body></html>';
    exit;
}
function renderPage(array $cfg, string $slug): void {
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/pages/' . urlencode($slug));
    if (!$data || !isset($data['page'])) { renderNotFoundHtml($cfg, '/pages/' . $slug); return; }
    $pg = $data['page'];
    $title = is_array($pg['title']) ? ($pg['title']['tr'] ?? reset($pg['title'])) : ($pg['title'] ?? $slug);
    $contentBlocks = $pg['content'] ?? null;
    $htmlContent = '';
    if (is_array($contentBlocks)) {
        foreach ($contentBlocks as $b) {
            $htmlContent .= '<div class="mb-4">' . ($b['content']['html'] ?? $b['content']['text'] ?? '') . '</div>';
        }
    } elseif (is_string($pg['content'])) $htmlContent = $pg['content'];
    $siteName = $cfg['site_name'] ?? 'Mağaza';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . h($title) . ' — ' . h($siteName) . '</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><header class="border-b bg-white"><div class="mx-auto max-w-6xl px-4 py-3"><a href="/" class="text-sm">← ' . h($siteName) . '</a></div></header><main class="mx-auto max-w-3xl px-4 py-8"><h1 class="text-2xl font-bold">' . h($title) . '</h1><article class="prose mt-6 max-w-none text-sm leading-relaxed">' . $htmlContent . '</article></main></body></html>';
    exit;
}
function renderBlogList(array $cfg): void {
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/blogs?limit=20');
    $posts = $data['posts'] ?? [];
    $siteName = $cfg['site_name'] ?? 'Mağaza';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blog — ' . h($siteName) . '</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><header class="border-b bg-white"><div class="mx-auto max-w-6xl px-4 py-3"><a href="/" class="text-sm">← ' . h($siteName) . '</a></div></header><main class="mx-auto max-w-6xl px-4 py-8"><h1 class="text-2xl font-bold">Blog</h1><div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">';
    if (!$posts) echo '<p class="text-sm text-zinc-500">Blog yazısı yok.</p>';
    else foreach ($posts as $post) {
        $title = $post['title'] ?? 'Yazı';
        $slug = $post['slug'] ?? '';
        $excerpt = $post['excerpt'] ?? '';
        echo '<a href="/blog/' . h($slug) . '" class="rounded-xl border bg-white p-4 hover:shadow"><h3 class="font-semibold">' . h($title) . '</h3><p class="mt-2 line-clamp-2 text-xs text-zinc-500">' . h($excerpt) . '</p></a>';
    }
    echo '</div></main></body></html>';
    exit;
}
function renderBlogPost(array $cfg, string $slug): void {
    $data = fetchPublicJson($cfg, '/api/store/' . urlencode($cfg['store_code']) . '/blogs/' . urlencode($slug));
    if (!$data || !isset($data['post'])) { renderNotFoundHtml($cfg, '/blog/' . $slug); return; }
    $post = $data['post'];
    $title = $post['title'] ?? $slug;
    $content = $post['content'] ?? '';
    $siteName = $cfg['site_name'] ?? 'Mağaza';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' . h($title) . ' — ' . h($siteName) . '</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><header class="border-b bg-white"><div class="mx-auto max-w-6xl px-4 py-3"><a href="/blog" class="text-sm">← Blog</a></div></header><main class="mx-auto max-w-3xl px-4 py-8"><h1 class="text-2xl font-bold">' . h($title) . '</h1><article class="prose mt-6 max-w-none">' . $content . '</article></main></body></html>';
    exit;
}

function renderStorefront(array $cfg, string $currentUri = '/'): void {
    $data = ensureProductsCache($cfg);
    $storeData = ensureStoreCache($cfg);
    $store = $storeData['store'] ?? null;
    $products = $data['products'] ?? [];
    $syncedAt = $data['synced_at'] ?? null;
    $active = array_values(array_filter($products, fn($p) => ($p['product.status'] ?? $p['status'] ?? 1) == 1));
    
    // Arama filtresi
    $searchQuery = $_GET['search'] ?? '';
    if ($searchQuery) {
        $searchLower = mb_strtolower(trim($searchQuery), 'UTF-8');
        $active = array_filter($active, function($p) use ($searchLower) {
            $label = mb_strtolower(($p['product.label'] ?? $p['title'] ?? ''), 'UTF-8');
            $code = mb_strtolower(($p['product.code'] ?? $p['sku'] ?? ''), 'UTF-8');
            $desc = mb_strtolower(($p['description'] ?? ''), 'UTF-8');
            return str_contains($label, $searchLower) || str_contains($code, $searchLower) || str_contains($desc, $searchLower);
        });
        $active = array_values($active);
    }
    
    $total = count($active);
    $siteName = $cfg['site_name'] ?: ($store['name'] ?? 'Mağazam');
    $storeCode = $cfg['store_code'] ?? '';
    $base = currentBaseUrl($cfg);
    $canonical = $base . '/';
    $desc = $store['description'] ?? ($store['homepage']['subtitle'] ?? 'Kaliteli ürünler, hızlı teslimat.');
    $desc = is_string($desc) ? mb_substr($desc,0,160) : 'Kaliteli ürünler';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . h($siteName) . ' — Mağaza</title>'
        . '<meta name="description" content="' . h($desc) . '">'
        . '<link rel="canonical" href="' . h($canonical) . '">'
        . '<meta property="og:title" content="' . h($siteName) . '">'
        . '<meta property="og:description" content="' . h($desc) . '">'
        . '<meta property="og:url" content="' . h($canonical) . '">'
        . '<meta property="og:type" content="website">'
        . '<meta name="robots" content="index, follow">'
        . '<link rel="sitemap" type="application/xml" href="/sitemap.xml">'
        . '<script src="https://cdn.tailwindcss.com"></script>'
        . '<style>body{font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial}</style>'
        . '<script type="application/ld+json">' . json_encode(['@context'=>'https://schema.org','@type'=>'Store','name'=>$siteName,'url'=>$canonical], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . '</script>'
        . '</head><body class="bg-zinc-50 text-zinc-900">';

    // Tema CSS
    $theme = $store['theme'] ?? [];
    $themeCss = '';
    if (is_array($theme)) {
        $primary = $theme['primary_color'] ?? '#4f46e5';
        $accent = $theme['accent_color'] ?? '#f59e0b';
        $dark = $theme['background_dark'] ?? '#18181b';
        $light = $theme['background_light'] ?? '#f4f4f5';
        $themeCss = ":root { --primary: $primary; --accent: $accent; --dark: $dark; --light: $light; }";
    }
    echo '<style>' . $themeCss . ' .btn-primary { background-color: var(--primary); } .text-primary { color: var(--primary); }</style>';

    // Header — Logo + Search + Menü
    $menus = ensureMenusCache($cfg)['menus'] ?? [];
    $searchQuery = $_GET['search'] ?? '';
    $headerMenus = array_filter($menus, fn($m) => ($m['location'] ?? '') === 'header');

    echo '<header class="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur"><div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">'
        . '<div class="flex items-center gap-3"><a href="/" class="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">' . h(mb_substr($siteName,0,1,'UTF-8')) . '</a><div><a href="/" class="text-sm font-semibold hover:text-indigo-600">' . h($siteName) . '</a><div class="hidden text-xs text-zinc-500 sm:block">'
        . implode(' · ', array_map(fn($m) => '<a href="' . h($m['url'] ?? '#') . '" class="hover:underline">' . h($m['label'] ?? '') . '</a>', $headerMenus))
        . '</div></div></div>'
        . '<div class="flex items-center gap-2">'
        . '<form method="GET" action="/products" class="hidden flex-1 sm:block"><input type="text" name="search" placeholder="Ara..." value="' . h($searchQuery) . '" class="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs" autocomplete="off"><button type="submit" class="ml-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">Ara</button></form>'
        . '<a href="/cart" class="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50">Sepet (<span id="cart-count">0</span>)</a><a href="/account" class="hidden text-xs text-zinc-500 hover:text-zinc-700 sm:inline">Hesabım</a></div>'
        . '</div></header>';

    // Cart / Checkout / Account sayfaları — JS ile localStorage sepet + core API üzerinden sipariş
    if (in_array($currentUri, ['/cart','/checkout','/sepet'])) {
        header('Content-Type: text/html; charset=utf-8');
        $apiBase = rtrim($cfg['api_url'], '/');
        echo '<section class="mx-auto max-w-3xl px-4 py-8"><h1 class="text-2xl font-bold">Sepet</h1><div id="cart-items" class="mt-6 space-y-3"></div><div id="cart-empty" class="hidden rounded-xl border border-dashed p-8 text-center text-sm text-zinc-500">Sepet boş. <a href="/" class="text-indigo-600 hover:underline">Alışverişe başla</a></div><div id="cart-total" class="mt-6 hidden rounded-xl border bg-white p-4"><div class="flex justify-between text-sm"><span>Toplam</span><b id="cart-total-price">—</b></div><button onclick="clearCart()" class="mt-3 text-xs text-red-600 hover:underline">Sepeti temizle</button></div>'
            . '<form id="checkout-form" class="mt-8 hidden rounded-xl border bg-white p-6"><h2 class="font-semibold">Teslimat Bilgileri</h2><div class="mt-4 grid gap-3 sm:grid-cols-2"><input id="c-name" placeholder="Ad Soyad" class="rounded-lg border px-3 py-2 text-sm" required><input id="c-phone" placeholder="Telefon" class="rounded-lg border px-3 py-2 text-sm" required><input id="c-email" placeholder="E-posta (opsiyonel)" class="rounded-lg border px-3 py-2 text-sm sm:col-span-2"><input id="c-address" placeholder="Adres" class="rounded-lg border px-3 py-2 text-sm sm:col-span-2" required><input id="c-city" placeholder="Şehir" class="rounded-lg border px-3 py-2 text-sm" required><input id="c-district" placeholder="İlçe" class="rounded-lg border px-3 py-2 text-sm"></div><button type="submit" class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Siparişi Ver</button><p id="checkout-msg" class="mt-3 hidden text-sm"></p></form></section>';
        echo '<script>var API_BASE=' . json_encode($apiBase) . ';var STORE_CODE=' . json_encode($storeCode) . ';function loadCart(){try{return JSON.parse(localStorage.getItem("rahatio_cart")||"[]")}catch(e){return[]}}function saveCart(c){localStorage.setItem("rahatio_cart",JSON.stringify(c));var cnt=c.reduce((s,i)=>s+(i.qty||1),0);var el=document.getElementById("cart-count");if(el)el.textContent=cnt}function renderCart(){var c=loadCart();var cont=document.getElementById("cart-items");var empty=document.getElementById("cart-empty");var totalBox=document.getElementById("cart-total");var form=document.getElementById("checkout-form");if(!c.length){cont.innerHTML="";empty.classList.remove("hidden");totalBox.classList.add("hidden");form.classList.add("hidden");return}empty.classList.add("hidden");totalBox.classList.remove("hidden");form.classList.remove("hidden");var total=0;cont.innerHTML=c.map(function(i,idx){var p=parseFloat(i.price)||0;total+=p*(i.qty||1);return \'<div class="flex items-center justify-between rounded-lg border bg-white p-3"><div><div class="text-sm font-medium">\'+i.label+\'</div><div class="text-xs text-zinc-500">\'+(p? p.toLocaleString("tr-TR",{minimumFractionDigits:2})+" ₺":"—")+\' × \'+(i.qty||1)+\'</div></div><button onclick="removeItem(\'+idx+\')" class="text-xs text-red-600">Kaldır</button></div>\'}).join("");document.getElementById("cart-total-price").textContent=total.toLocaleString("tr-TR",{minimumFractionDigits:2})+" ₺"}function removeItem(idx){var c=loadCart();c.splice(idx,1);saveCart(c);renderCart()}function clearCart(){localStorage.removeItem("rahatio_cart");saveCart([]);renderCart()}document.getElementById("checkout-form").addEventListener("submit",async function(e){e.preventDefault();var c=loadCart();if(!c.length){alert("Sepet boş");return}var msg=document.getElementById("checkout-msg");msg.className="mt-3 text-sm text-zinc-500";msg.textContent="Gönderiliyor...";msg.classList.remove("hidden");var payload={items:c.map(function(i){return{product_id:String(i.id), quantity:i.qty||1}}), customer:{name:document.getElementById("c-name").value, phone:document.getElementById("c-phone").value, email:document.getElementById("c-email").value}, shipping_address:{full_name:document.getElementById("c-name").value, phone:document.getElementById("c-phone").value, email:document.getElementById("c-email").value, city:document.getElementById("c-city").value, district:document.getElementById("c-district").value, address:document.getElementById("c-address").value, zip_code:""}, payment_method:"cash_on_delivery", note:"slave checkout"};try{var r=await fetch(API_BASE+"/api/store/"+encodeURIComponent(STORE_CODE)+"/checkout",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});var j=await r.json();if(!r.ok) throw new Error(j.error||j.message||"Hata");msg.className="mt-3 text-sm text-emerald-600";msg.textContent="Sipariş alındı: "+(j.orderNumber||j.orderId)+" — Teşekkürler!";localStorage.removeItem("rahatio_cart");saveCart([]);renderCart();}catch(err){msg.className="mt-3 text-sm text-red-600";msg.textContent="Hata: "+err.message}});renderCart();saveCart(loadCart());</script>';
        echo '<footer class="mx-auto max-w-3xl px-4 pb-8 text-center text-xs text-zinc-400"><a href="/" class="underline">Ana sayfa</a> · <a href="/sitemap.xml" class="underline">Sitemap</a></footer></body></html>';
        exit;
    }
    if (in_array($currentUri, ['/account','/hesabim'])) {
        $apiBase = rtrim($cfg['api_url'], '/');
        echo '<section class="mx-auto max-w-xl px-4 py-12"><h1 class="text-2xl font-bold">Hesabım</h1><p class="mt-2 text-sm text-zinc-600">Giriş yap veya kayıt ol. Bilgiler güvenli şekilde Rahatio API üzerinden işlenir.</p>'
            . '<div class="mt-6 grid gap-6 rounded-xl border bg-white p-6"><div><h3 class="font-semibold">Giriş Yap</h3><form id="login-form" class="mt-3 space-y-3"><input id="l-email" type="email" placeholder="E-posta" class="w-full rounded-lg border px-3 py-2 text-sm" required><input id="l-pass" type="password" placeholder="Şifre" class="w-full rounded-lg border px-3 py-2 text-sm" required><button class="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Giriş</button><p id="login-msg" class="hidden text-xs"></p></form></div><div class="border-t pt-6"><h3 class="font-semibold">Kayıt Ol</h3><form id="register-form" class="mt-3 space-y-3"><input id="r-name" placeholder="Ad Soyad" class="w-full rounded-lg border px-3 py-2 text-sm" required><input id="r-email" type="email" placeholder="E-posta" class="w-full rounded-lg border px-3 py-2 text-sm" required><input id="r-pass" type="password" placeholder="Şifre (en az 8 karakter)" class="w-full rounded-lg border px-3 py-2 text-sm" required><button class="w-full rounded-lg border px-4 py-2 text-sm font-medium">Kayıt Ol</button><p id="register-msg" class="hidden text-xs"></p></form></div></div></section>';
        echo '<script>var API_BASE=' . json_encode(rtrim($cfg['api_url'],'/')) . ';var STORE_CODE=' . json_encode($storeCode) . ';document.getElementById("login-form").addEventListener("submit",async e=>{e.preventDefault();var m=document.getElementById("login-msg");m.className="text-xs text-zinc-500";m.textContent="Gönderiliyor...";m.classList.remove("hidden");try{var r=await fetch(API_BASE+"/api/store/"+encodeURIComponent(STORE_CODE)+"/customer/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:document.getElementById("l-email").value,password:document.getElementById("l-pass").value})});var j=await r.json();if(!r.ok) throw new Error(j.error||"Giriş başarısız");m.className="text-xs text-emerald-600";m.textContent="Giriş başarılı";localStorage.setItem("rahatio_customer",JSON.stringify(j))}catch(err){m.className="text-xs text-red-600";m.textContent=err.message}});document.getElementById("register-form").addEventListener("submit",async e=>{e.preventDefault();var m=document.getElementById("register-msg");m.className="text-xs text-zinc-500";m.textContent="Gönderiliyor...";m.classList.remove("hidden");try{var r=await fetch(API_BASE+"/api/store/"+encodeURIComponent(STORE_CODE)+"/customer/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:document.getElementById("r-name").value,email:document.getElementById("r-email").value,password:document.getElementById("r-pass").value})});var j=await r.json();if(!r.ok) throw new Error(j.error||"Kayıt başarısız");m.className="text-xs text-emerald-600";m.textContent="Kayıt başarılı — giriş yapabilirsiniz"}catch(err){m.className="text-xs text-red-600";m.textContent=err.message}});</script>';
        echo '<footer class="mx-auto max-w-xl px-4 pb-8 text-center text-xs text-zinc-400"><a href="/" class="underline">Ana sayfa</a></footer></body></html>';
        exit;
    }

    // Hero
    echo '<section class="mx-auto max-w-6xl px-4 pt-8"><div class="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">'
        . '<h1 class="text-2xl font-bold tracking-tight">' . h($siteName) . '</h1>'
        . '<p class="mt-2 max-w-2xl text-sm text-zinc-600">Ürünler doğrudan Rahatio API üzerinden senkronize edilir. Siparişler anında merkeze iletilir.</p>'
        . '<div class="mt-4 flex flex-wrap items-center gap-3 text-xs">'
        . '<span class="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">' . $total . ' ürün</span>'
        . ($syncedAt ? '<span class="text-zinc-500">Son senk: ' . h(date('d.m.Y H:i', strtotime($syncedAt))) . '</span>' : '<span class="text-amber-600">Henüz senk edilmedi</span>')
        . '</div></div></section>';

    if ($total === 0) {
        echo '<section class="mx-auto max-w-6xl px-4 py-12"><div class="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center"><p class="text-sm font-medium text-zinc-700">Henüz ürün yok</p><p class="mx-auto mt-2 max-w-md text-xs text-zinc-500">Yönetim panelinden ürün ekleyin ve mağazanızı yayınlayın. Ürünler otomatik olarak burada görünecektir.</p></div></section>';
    } else {
        echo '<section class="mx-auto max-w-6xl px-4 py-8"><div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">';
        foreach ($active as $p) {
            $id = $p['product.id'] ?? $p['id'] ?? '';
            $label = $p['product.label'] ?? $p['label'] ?? $p['title'] ?? 'Ürün';
            $code = $p['product.code'] ?? $p['code'] ?? $p['sku'] ?? '';
            $price = $p['price'] ?? $p['priceTRY'] ?? null;
            $stock = $p['stock'] ?? $p['quantity'] ?? null;
            $img = $p['image'] ?? (is_array($p['images'] ?? null) ? ($p['images'][0] ?? null) : null);
            $desc = $p['description'] ?? '';
            if (is_string($desc) && mb_strlen($desc) > 120) $desc = mb_substr($desc, 0, 120) . '…';
            echo '<a href="/product/' . h((string)$id) . '" class="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition hover:shadow-md">'
                . '<div class="aspect-[4/3] overflow-hidden bg-zinc-100">'
                . ($img ? '<img src="' . h($img) . '" alt="' . h($label) . '" class="h-full w-full object-cover transition group-hover:scale-[1.02]" loading="lazy">' : '<div class="flex h-full w-full items-center justify-center text-xs text-zinc-400">Görsel yok</div>')
                . '</div>'
                . '<div class="flex flex-1 flex-col p-4">'
                . '<div class="line-clamp-2 text-sm font-semibold leading-snug">' . h($label) . '</div>'
                . ($code ? '<div class="mt-1 text-xs text-zinc-500">' . h($code) . '</div>' : '')
                . ($desc ? '<div class="mt-2 line-clamp-2 text-xs text-zinc-500">' . h($desc) . '</div>' : '')
                . '<div class="mt-3 flex items-center justify-between">'
                . '<div class="text-sm font-bold text-zinc-900">' . h(formatPrice($price)) . '</div>'
                . '<span class="rounded-full px-2 py-0.5 text-xs font-medium ' . (($stock !== null && (int)$stock <= 0) ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700') . '">' . ($stock !== null ? h((string)$stock) . ' stok' : 'Stok bilgisi') . '</span>'
                . '</div>'
                . '<div class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 group-hover:text-indigo-700">Detay <span aria-hidden>→</span></div>'
                . '</div></a>';
        }
        echo '</div></section>';
    }

    // Footer
    $base = currentBaseUrl($cfg);
    echo '<footer class="mx-auto max-w-6xl px-4 pb-8"><div class="rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-500">'
        . '<div class="flex flex-wrap gap-3"><a href="/" class="hover:underline">Ana Sayfa</a> · <a href="/sitemap.xml" class="hover:underline">Sitemap</a> · <a href="/pages" class="hover:underline">Sayfalar</a> · <a href="/blog" class="hover:underline">Blog</a></div>'
        . '<div class="mt-2">Bu site <b>Rahatio</b> ile yayında</div>'
        . '</div></footer>';
    echo '<script>try{var c=JSON.parse(localStorage.getItem("rahatio_cart")||"[]");document.getElementById("cart-count").textContent=c.reduce((s,i)=>s+(i.qty||1),0)}catch(e){}</script>';
    if ($currentUri !== '/' ) {
        echo '<script>console.log("slave storefront", ' . json_encode($currentUri) . ')</script>';
    }
    echo '</body></html>';
    exit;
}

function renderProductDetail(array $cfg, string $id): void {
    $data = ensureProductsCache($cfg);
    $products = $data['products'] ?? [];
    $p = findProductById($products, $id);
    if (!$p) {
        // Core fallback dene
        try {
            $client = new CoreClient($cfg);
            $p = $client->get('/api/slave/products/' . urlencode($id));
            // mapSlaveProduct single döndürür, doğrudan
            if (isset($p['product.id']) || isset($p['id'])) { /* ok */ } else if (isset($p['data'])) $p = $p['data'];
        } catch (Throwable $e) { $p = null; }
    }
    if (!$p) {
        renderNotFoundHtml($cfg, '/product/' . $id);
        return;
    }
    $label = $p['product.label'] ?? $p['label'] ?? $p['title'] ?? 'Ürün';
    $code = $p['product.code'] ?? $p['code'] ?? $p['sku'] ?? '';
    $price = $p['price'] ?? $p['priceTRY'] ?? null;
    $stock = $p['stock'] ?? $p['quantity'] ?? null;
    $img = $p['image'] ?? (is_array($p['images'] ?? null) ? ($p['images'][0] ?? null) : null);
    $images = $p['images'] ?? ($img ? [$img] : []);
    $desc = $p['description'] ?? '';
    $siteName = $cfg['site_name'] ?? 'Mağazam';
    $base = currentBaseUrl($cfg);
    $canonical = $base . '/product/' . urlencode($id);
    $metaDesc = $desc ? mb_substr(trim(strip_tags($desc)),0,160) : h($label) . ' — ' . h($siteName);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . h($label) . ' — ' . h($siteName) . '</title>'
        . '<meta name="description" content="' . h($metaDesc) . '">'
        . '<link rel="canonical" href="' . h($canonical) . '">'
        . '<meta property="og:title" content="' . h($label) . '">'
        . '<meta property="og:description" content="' . h($metaDesc) . '">'
        . '<meta property="og:url" content="' . h($canonical) . '">'
        . '<meta property="og:type" content="product">'
        . ($img ? '<meta property="og:image" content="' . h($img) . '">' : '')
        . '<meta name="robots" content="index, follow">'
        . '<script src="https://cdn.tailwindcss.com"></script>'
        . '<script type="application/ld+json">' . json_encode(['@context'=>'https://schema.org','@type'=>'Product','name'=>$label,'description'=>$metaDesc,'sku'=>$code,'image'=>$img?:null,'offers'=>['@type'=>'Offer','price'=>$price,'priceCurrency'=>'TRY','availability'=>($stock!==null && (int)$stock>0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock')]], JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES) . '</script>'
        . '</head><body class="bg-zinc-50 text-zinc-900">';
    echo '<header class="border-b border-zinc-200 bg-white"><div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><a href="/" class="text-sm font-semibold text-zinc-900">← ' . h($siteName) . '</a><div class="flex items-center gap-2"><a href="/cart" class="text-xs text-zinc-500 hover:text-zinc-700">Sepet</a><a href="/" class="text-xs text-zinc-500 hover:text-zinc-700">Ana sayfa</a></div></div></header>';
    echo '<main class="mx-auto max-w-6xl px-4 py-8"><div class="grid gap-8 lg:grid-cols-2">';
    // Images
    echo '<div class="space-y-3">';
    if ($img) {
        echo '<div class="overflow-hidden rounded-xl border border-zinc-200 bg-white"><img src="' . h($img) . '" alt="' . h($label) . '" class="aspect-[4/3] w-full object-cover"></div>';
        if (count($images) > 1) {
            echo '<div class="grid grid-cols-4 gap-2">';
            foreach (array_slice($images, 0, 8) as $im) {
                echo '<img src="' . h($im) . '" class="aspect-square rounded-lg border border-zinc-200 object-cover">';
            }
            echo '</div>';
        }
    } else {
        echo '<div class="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-white text-sm text-zinc-400">Görsel yok</div>';
    }
    echo '</div>';
    // Info
    echo '<div class="rounded-xl border border-zinc-200 bg-white p-6">'
        . '<h1 class="text-xl font-bold leading-tight">' . h($label) . '</h1>'
        . ($code ? '<div class="mt-1 text-xs text-zinc-500">Kod: ' . h($code) . ' · ID: ' . h((string)($p['product.id'] ?? $p['id'] ?? '')) . '</div>' : '')
        . '<div class="mt-4 flex items-baseline gap-3"><div class="text-2xl font-bold">' . h(formatPrice($price)) . '</div><span class="rounded-full px-2.5 py-1 text-xs font-medium ' . (($stock !== null && (int)$stock <= 0) ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700') . '">' . ($stock !== null ? h((string)$stock) . ' adet stok' : 'Stok bilgisi yok') . '</span></div>'
        . ($desc ? '<div class="prose prose-sm mt-6 max-w-none text-sm leading-relaxed text-zinc-700">' . nl2br(h($desc)) . '</div>' : '<p class="mt-6 text-sm text-zinc-500">Açıklama yok.</p>')
        . '<div class="mt-6 flex flex-wrap gap-2">'
        . '<button data-id="' . h((string)($p['product.id'] ?? $p['id'] ?? $id)) . '" data-label="' . h($label) . '" data-price="' . h((string)$price) . '" onclick="addToCart(this.dataset.id, this.dataset.label, this.dataset.price)" class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700">Sepete Ekle</button>'
        . '<a href="/" class="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50">← Mağazaya dön</a>'
        . '</div>'
        . '<p id="cart-msg" class="mt-3 hidden text-sm text-emerald-600">✓ Sepete eklendi — <a href="/cart" class="underline">Sepete git</a></p>'
        . '</div>';
    echo '</div></main>';
    echo '<footer class="mx-auto max-w-6xl px-4 pb-8 text-center text-xs text-zinc-400"><a href="/sitemap.xml" class="underline">Sitemap</a></footer>';
    echo '<script>
function addToCart(id,label,price){try{var c=JSON.parse(localStorage.getItem("rahatio_cart")||"[]");var f=c.find(x=>String(x.id)===String(id));if(f)f.qty=(f.qty||1)+1;else c.push({id:id,label:label,price:price,qty:1});localStorage.setItem("rahatio_cart",JSON.stringify(c));var el=document.getElementById("cart-msg");if(el)el.classList.remove("hidden");var cnt=c.reduce((s,i)=>s+(i.qty||1),0);var cc=document.getElementById("cart-count");if(cc)cc.textContent=cnt;}catch(e){alert("Sepet hatası: "+e.message)}}
</script>';
    echo '</body></html>';
    exit;
}

function renderNotFoundHtml(array $cfg, string $path): void {
    http_response_code(404);
    header('Content-Type: text/html; charset=utf-8');
    $siteName = $cfg['site_name'] ?? 'Mağaza';
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>404 — ' . h($siteName) . '</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><div class="mx-auto max-w-xl px-4 py-16 text-center"><h1 class="text-3xl font-bold">404</h1><p class="mt-2 text-sm text-zinc-600">Aradığınız sayfa bulunamadı.</p><a href="/" class="mt-6 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white">Ana sayfaya dön</a></div></body></html>';
    exit;
}
function renderErrorHtml(array $cfg, string $msg): void {
    http_response_code(500);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hata</title><script src="https://cdn.tailwindcss.com"></script></head><body class="bg-zinc-50"><div class="mx-auto max-w-xl px-4 py-16"><h1 class="text-xl font-bold text-red-700">Hata</h1><pre class="mt-3 whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">' . h($msg) . '</pre><a href="/" class="mt-4 inline-block text-sm text-indigo-600 hover:underline">Ana sayfa</a></div></body></html>';
    exit;
}

// ============================================================
//  HANDLER'LAR (API)
// ============================================================

function health(array $cfg): void {
    // Admin-only: Basit sağlık kontrolü (Debug bilgisi gizli)
    $cacheFile = $cfg['cache_dir'] . '/products.json';
    $cached = is_file($cacheFile) ? filemtime($cacheFile) : 0;
    $age = $cached ? (time() - $cached) : null;
    jsonResponse([
        'status'    => 'ok',
        'version'   => '1.2.0',
        'platform'  => 'php',
        'store'     => $cfg['store_code'],
        'site'      => $cfg['site_name'],
        'php'       => PHP_VERSION,
        'cached'    => $cached ? true : false,
        'cache_age' => $age,
        'time'      => date('c'),
    ]);
}

function configInfo(array $cfg): void {
    // Admin-only: Konfigürasyonu göster (API keyleri hariç)
    jsonResponse([
        'store_code'  => $cfg['store_code'],
        'site_name'   => $cfg['site_name'],
        'php_version' => PHP_VERSION,
        'cache_dir'   => 'configured',
    ]);
}

function syncFromCore(array $cfg): void {
    $client = new CoreClient($cfg);
    $products = $client->get('/api/slave/products');
    $cacheFile = $cfg['cache_dir'] . '/products.json';
    $data = [
        'synced_at' => date('c'),
        'products'  => $products['data'] ?? $products ?? [],
    ];
    file_put_contents($cacheFile, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    jsonResponse(['status' => 'synced', 'count' => count($data['products']), 'time' => $data['synced_at']]);
}

function listProducts(array $cfg): void {
    $data = ensureProductsCache($cfg);
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
    $data = ensureProductsCache($cfg);
    foreach ($data['products'] as $p) {
        $pid = $p['product.id'] ?? $p['id'] ?? null;
        if ((string)$pid === $id) {
            jsonResponse($p);
            return;
        }
    }
    $client = new CoreClient($cfg);
    try {
        $product = $client->get("/api/slave/products/$id");
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
    $ordersFile = $cfg['cache_dir'] . '/orders.json';
    $orders = is_file($ordersFile) ? json_decode(file_get_contents($ordersFile), true) : [];
    $orders[] = array_merge($input, ['received_at' => date('c'), 'synced' => false]);
    file_put_contents($ordersFile, json_encode($orders, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
    $client = new CoreClient($cfg);
    try {
        $client->post('/api/slave/orders', $input);
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
            CURLOPT_TIMEOUT        => 45,
            CURLOPT_CONNECTTIMEOUT => 15,
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
