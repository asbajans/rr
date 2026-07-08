<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\ExternalFeed;
use App\Models\FeedSyncLog;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class FeedController extends Controller
{
    private function getUserStore(Request $request): \App\Models\Store
    {
        $store = $request->user()->store;
        if (!$store) {
            throw ValidationException::withMessages(['store' => 'No store assigned']);
        }
        return $store;
    }

    public function index(Request $request)
    {
        $store = $this->getUserStore($request);
        $feeds = ExternalFeed::where('store_id', $store->id)
            ->orderBy('created_at', 'desc')
            ->get();
        return response()->json(['data' => $feeds]);
    }

    public function store(Request $request)
    {
        $store = $this->getUserStore($request);

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'feed_url' => 'required|string|max:2048',
            'file_format' => 'required|in:xml,csv,xlsx,json',
            'auth_type' => 'required|in:none,basic,bearer,api-key',
            'auth_credentials' => 'nullable|array',
            'pricing_mode' => 'required|in:fixed,gold-formula',
            'currency' => 'required|in:TRY,USD',
            'default_gram_weight' => 'nullable|numeric|min:0',
            'default_milyem' => 'nullable|integer|min:0',
            'default_profit_margin' => 'nullable|numeric|min:0|max:100',
            'price_multiplier' => 'nullable|numeric|min:0',
            'default_category' => 'nullable|string|max:255',
            'default_category_id' => 'nullable|integer|exists:categories,id',
            'default_is_b2b_enabled' => 'nullable|boolean',
            'default_quantity' => 'nullable|integer|min:0',
            'default_marketplaces' => 'nullable|array',
            'field_mapping' => 'nullable|array',
            'auto_sync' => 'nullable|boolean',
            'update_interval' => 'required|in:manual,hourly,daily,weekly',
            'is_active' => 'nullable|boolean',
        ]);

        $validated['store_id'] = $store->id;
        $feed = ExternalFeed::create($validated);

        return response()->json($feed, 201);
    }

    public function show(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }
        $feed->load('syncLogs');
        return response()->json($feed);
    }

    public function update(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'feed_url' => 'sometimes|string|max:2048',
            'file_format' => 'sometimes|in:xml,csv,xlsx,json',
            'auth_type' => 'sometimes|in:none,basic,bearer,api-key',
            'auth_credentials' => 'nullable|array',
            'pricing_mode' => 'sometimes|in:fixed,gold-formula',
            'currency' => 'sometimes|in:TRY,USD',
            'default_gram_weight' => 'nullable|numeric|min:0',
            'default_milyem' => 'nullable|integer|min:0',
            'default_profit_margin' => 'nullable|numeric|min:0|max:100',
            'price_multiplier' => 'nullable|numeric|min:0',
            'default_category' => 'nullable|string|max:255',
            'default_category_id' => 'nullable|integer|exists:categories,id',
            'default_is_b2b_enabled' => 'nullable|boolean',
            'default_quantity' => 'nullable|integer|min:0',
            'default_marketplaces' => 'nullable|array',
            'field_mapping' => 'nullable|array',
            'auto_sync' => 'nullable|boolean',
            'update_interval' => 'sometimes|in:manual,hourly,daily,weekly',
            'is_active' => 'nullable|boolean',
        ]);

        $feed->update($validated);
        return response()->json($feed);
    }

    public function destroy(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }
        $feed->syncLogs()->delete();
        $feed->delete();
        return response()->json(['message' => 'Feed deleted']);
    }

    public function test(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }

        $result = [
            'success' => false,
            'message' => '',
            'headers' => null,
            'preview' => null,
            'error' => null,
        ];

        try {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $feed->feed_url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_HEADER => true,
            ]);

            if ($feed->auth_type === 'basic' && isset($feed->auth_credentials['username'])) {
                curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                curl_setopt($ch, CURLOPT_USERPWD, $feed->auth_credentials['username'] . ':' . ($feed->auth_credentials['password'] ?? ''));
            } elseif ($feed->auth_type === 'bearer' && isset($feed->auth_credentials['token'])) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $feed->auth_credentials['token']]);
            } elseif ($feed->auth_type === 'api-key' && isset($feed->auth_credentials['key'])) {
                $headerName = $feed->auth_credentials['header_name'] ?? 'X-API-Key';
                curl_setopt($ch, CURLOPT_HTTPHEADER, [$headerName . ': ' . $feed->auth_credentials['key']]);
            }

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error) {
                $result['error'] = $error;
                $result['message'] = 'Connection failed';
            } elseif ($httpCode >= 400) {
                $result['error'] = "HTTP $httpCode";
                $result['message'] = "Server returned HTTP $httpCode";
            } else {
                $headers = substr($response, 0, $headerSize);
                $body = substr($response, $headerSize);
                $result['success'] = true;
                $result['message'] = "HTTP $httpCode - " . strlen($body) . ' bytes received';
                $result['headers'] = $headers;
                $result['preview'] = mb_substr($body, 0, 2000);
            }
        } catch (\Throwable $e) {
            $result['error'] = $e->getMessage();
            $result['message'] = 'Exception occurred';
        }

        return response()->json($result);
    }

    public function sync(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }

        $log = FeedSyncLog::create([
            'feed_id' => $feed->id,
            'store_id' => $store->id,
            'status' => 'running',
            'started_at' => now(),
        ]);

        try {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL => $feed->feed_url,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 60,
                CURLOPT_FOLLOWLOCATION => true,
            ]);

            if ($feed->auth_type === 'basic' && isset($feed->auth_credentials['username'])) {
                curl_setopt($ch, CURLOPT_HTTPAUTH, CURLAUTH_BASIC);
                curl_setopt($ch, CURLOPT_USERPWD, $feed->auth_credentials['username'] . ':' . ($feed->auth_credentials['password'] ?? ''));
            } elseif ($feed->auth_type === 'bearer' && isset($feed->auth_credentials['token'])) {
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $feed->auth_credentials['token']]);
            } elseif ($feed->auth_type === 'api-key' && isset($feed->auth_credentials['key'])) {
                $headerName = $feed->auth_credentials['header_name'] ?? 'X-API-Key';
                curl_setopt($ch, CURLOPT_HTTPHEADER, [$headerName . ': ' . $feed->auth_credentials['key']]);
            }

            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            curl_close($ch);

            if ($error || $httpCode >= 400) {
                throw new \Exception($error ?: "HTTP $httpCode");
            }

            $parsed = $this->parseFeed($response, $feed->file_format);
            $summary = $this->importProducts($store, $feed, $parsed);

            $feed->update([
                'last_sync_at' => now(),
                'last_sync_result' => $summary,
            ]);

            $log->update([
                'status' => 'success',
                'completed_at' => now(),
                'summary' => $summary,
            ]);

            return response()->json($log);
        } catch (\Throwable $e) {
            $summary = ['error' => $e->getMessage(), 'imported' => 0, 'failed' => 0, 'total' => 0];
            $log->update([
                'status' => 'failed',
                'completed_at' => now(),
                'summary' => $summary,
            ]);
            $feed->update(['last_sync_result' => $summary]);
            return response()->json($log, 500);
        }
    }

    public function syncLogs(Request $request, ExternalFeed $feed)
    {
        $store = $this->getUserStore($request);
        if ($feed->store_id !== $store->id) {
            return response()->json(['error' => 'Feed not found'], 404);
        }
        $logs = FeedSyncLog::where('feed_id', $feed->id)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();
        return response()->json(['data' => $logs]);
    }

    private function parseFeed(string $body, string $format): array
    {
        switch ($format) {
            case 'json':
                $data = json_decode($body, true);
                return is_array($data) ? $data : [];
            case 'xml':
                $xml = simplexml_load_string($body);
                $json = json_encode($xml);
                return json_decode($json, true) ?? [];
            case 'csv':
                $lines = explode("\n", trim($body));
                if (empty($lines)) return [];
                $headers = str_getcsv(array_shift($lines));
                $rows = [];
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (empty($line)) continue;
                    $values = str_getcsv($line);
                    $row = [];
                    foreach ($headers as $i => $h) {
                        $row[$h] = $values[$i] ?? null;
                    }
                    $rows[] = $row;
                }
                return $rows;
            case 'xlsx':
                return ['note' => 'XLSX parsing requires PhpSpreadsheet library - to be implemented'];
            default:
                return [];
        }
    }

    private function importProducts(\App\Models\Store $store, ExternalFeed $feed, array $data): array
    {
        $imported = 0;
        $failed = 0;
        $errors = [];

        $records = [];
        if (isset($data[0]) && is_array($data[0])) {
            $records = $data;
        } elseif (isset($data['products']) && is_array($data['products'])) {
            $records = $data['products'];
        } elseif (isset($data['product']) && is_array($data['product'])) {
            $records = $data['product'];
        } elseif (isset($data['item']) && is_array($data['item'])) {
            $records = $data['item'];
        } elseif (isset($data['rss']['channel']['item']) && is_array($data['rss']['channel']['item'])) {
            $records = $data['rss']['channel']['item'];
        }

        if (empty($records)) {
            $records = [$data];
        }

        $mapping = $feed->field_mapping ?? [];
        $hasMapping = !empty($mapping);

        foreach ($records as $index => $record) {
            try {
                if ($hasMapping) {
                    $title = $this->mapField($record, $mapping, 'title', 'title');
                    $sku = $this->mapField($record, $mapping, 'sku', 'sku');
                    $price = (float) ($this->mapField($record, $mapping, 'price', 'price') ?: 0);
                    $description = $this->mapField($record, $mapping, 'description', 'description');
                    $image = $this->mapField($record, $mapping, 'image', 'image');
                    $quantity = (int) ($this->mapField($record, $mapping, 'quantity', 'quantity') ?: $feed->default_quantity);
                    $category = $this->mapField($record, $mapping, 'category', 'category') ?: $feed->default_category;
                } else {
                    $title = $record['title'] ?? $record['name'] ?? $record['ad'] ?? $record['isim'] ?? ('Product ' . ($index + 1));
                    $sku = $record['sku'] ?? $record['code'] ?? $record['urun_kodu'] ?? $record['product_code'] ?? ('feed-' . $feed->id . '-' . $index);
                    $price = (float) ($record['price'] ?? $record['fiyat'] ?? $record['price_try'] ?? 0);
                    $description = $record['description'] ?? $record['description'] ?? $record['aciklama'] ?? '';
                    $image = $record['image'] ?? $record['image_url'] ?? $record['gorsel'] ?? $record['img'] ?? null;
                    $quantity = (int) ($record['stock'] ?? $record['quantity'] ?? $record['stok'] ?? $record['adet'] ?? $feed->default_quantity);
                    $category = $record['category'] ?? $record['kategori'] ?? $feed->default_category;
                }

                if (empty($sku)) {
                    $sku = 'feed-' . $feed->id . '-' . $index;
                }

                try {
                    $context = app('aimeos.context')->get();
                    $manager = \Aimeos\MShop::create($context, 'product');
                    $item = $manager->create();
                    $item->setCode($sku);
                    $item->setLabel($title);
                    $item->setStatus(1);
                    $manager->save($item);

                    $priceManager = \Aimeos\MShop::create($context, 'price');
                    $priceItem = $priceManager->create();
                    $priceItem->setValue($price * ($feed->price_multiplier ?: 1));
                    $priceItem->setCurrencyId($feed->currency);
                    $priceItem->setType('default');
                    $priceManager->save($priceItem);

                    $listManager = \Aimeos\MShop::create($context, 'product/lists');
                    $list = $listManager->create();
                    $list->setParentId($item->getId());
                    $list->setRefId($priceItem->getId());
                    $list->setDomain('price');
                    $list->setType('default');
                    $listManager->save($list);

                    if ($quantity > 0) {
                        $propManager = \Aimeos\MShop::create($context, 'product/property');
                        $prop = $propManager->create();
                        $prop->setParentId($item->getId());
                        $prop->setValue((string) $quantity);
                        $prop->setType('stock');
                        $prop->setLanguageId(null);
                        $propManager->save($prop);
                    }

                    if (!empty($image)) {
                        $mediaManager = \Aimeos\MShop::create($context, 'media');
                        $media = $mediaManager->create();
                        $media->setUrl($image);
                        $media->setPreview($image);
                        $media->setMimeType('image/jpeg');
                        $media->setType('default');
                        $media->setLabel($title);
                        $mediaManager->save($media);

                        $ml = $listManager->create();
                        $ml->setParentId($item->getId());
                        $ml->setRefId($media->getId());
                        $ml->setDomain('media');
                        $ml->setType('default');
                        $listManager->save($ml);
                    }

                    if (!empty($description)) {
                        $textManager = \Aimeos\MShop::create($context, 'text');
                        $text = $textManager->create();
                        $text->setContent($description);
                        $text->setType('default');
                        $text->setLanguageId('tr');
                        $textManager->save($text);

                        $tl = $listManager->create();
                        $tl->setParentId($item->getId());
                        $tl->setRefId($text->getId());
                        $tl->setDomain('text');
                        $tl->setType('default');
                        $listManager->save($tl);
                    }

                    $imported++;
                } catch (\Throwable $e) {
                    $failed++;
                    $errors[] = "Row $index ($sku): " . $e->getMessage();
                }
            } catch (\Throwable $e) {
                $failed++;
                $errors[] = "Row $index: " . $e->getMessage();
            }
        }

        return [
            'total' => count($records),
            'imported' => $imported,
            'failed' => $failed,
            'errors' => array_slice($errors, 0, 20),
        ];
    }

    private function mapField(array $record, array $mapping, string $field, string $default): ?string
    {
        if (isset($mapping[$field]) && isset($record[$mapping[$field]])) {
            $val = $record[$mapping[$field]];
            return is_string($val) ? $val : (is_scalar($val) ? (string) $val : null);
        }
        if (isset($record[$field])) {
            $val = $record[$field];
            return is_string($val) ? $val : (is_scalar($val) ? (string) $val : null);
        }
        return $record[$default] ?? $record[$field] ?? null;
    }
}
