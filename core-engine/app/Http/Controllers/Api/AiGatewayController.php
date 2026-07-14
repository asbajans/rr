<?php

namespace App\Http\Controllers\Api;

use App\Services\InternalKeyService;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Http;

class AiGatewayController extends Controller
{
    private InternalKeyService $keyService;

    public function __construct(InternalKeyService $keyService)
    {
        $this->keyService = $keyService;
    }

    public function proxy(Request $request)
    {
        $user = $request->user();

        if (!$user->hasAiCredits(1)) {
            return response()->json([
                'error' => 'Yetersiz AI kredisi. Lütfen paket satın alın.',
                'credits' => $user->ai_credits,
            ], 403);
        }

        $files = $request->allFiles();
        $hasFiles = !empty($files);

        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/process-image';
        $internalKey = $this->keyService->generateEncryptedKey();

        $aiResponse = $hasFiles
            ? $this->forwardWithFiles($aiUrl, $request, $internalKey)
            : $this->forwardWithJson($aiUrl, $request, $internalKey);

        if ($aiResponse->successful()) {
            $user->consumeAiCredits(1, 'ai_image_generate', 'Background removal');
            return response()->json($aiResponse->json(), $aiResponse->status());
        }

        return response()->json(
            $aiResponse->json() ?? ['error' => 'AI servisi yanıt vermedi.'],
            $aiResponse->status()
        );
    }

    public function search(Request $request)
    {
        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/search';
        $response = Http::timeout(30)->post($aiUrl, $request->all());
        return response()->json($response->json(), $response->status());
    }

    public function recommend(Request $request)
    {
        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/recommend';
        $response = Http::timeout(30)->post($aiUrl, $request->all());
        return response()->json($response->json(), $response->status());
    }

    public function getStatus(string $sessionId)
    {
        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/status/' . $sessionId;
        $response = Http::timeout(10)->get($aiUrl);
        return response()->json($response->json(), $response->status());
    }

    public function chat(Request $request)
    {
        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/chat';
        $response = Http::timeout(60)->post($aiUrl, $request->all());
        return response()->json($response->json(), $response->status());
    }

    public function analyzeProduct(Request $request)
    {
        $user = $request->user();

        if (!$user->hasAiCredits(1)) {
            return response()->json([
                'error' => 'Yetersiz AI kredisi.',
                'credits' => $user->ai_credits,
            ], 403);
        }

        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/analyze-product';
        $internalKey = app(\App\Services\InternalKeyService::class)->generateEncryptedKey();

        $aiResponse = $request->hasFile('image')
            ? $this->forwardWithFiles($aiUrl, $request, $internalKey)
            : $this->forwardWithJson($aiUrl, $request, $internalKey);

        if ($aiResponse->successful()) {
            $user->consumeAiCredits(1, 'ai_product_create', 'Product analysis');
            return response()->json($aiResponse->json());
        }

        return response()->json(
            $aiResponse->json() ?? ['error' => 'AI servisi yanıt vermedi.'],
            $aiResponse->status()
        );
    }

    private function forwardWithFiles(string $url, Request $request, string $internalKey): \Illuminate\Http\Client\Response
    {
        $http = Http::timeout(300)->withHeaders(['X-Rahat-Internal-Key' => $internalKey]);
        $data = $request->except('images');

        foreach ($request->allFiles() as $key => $file) {
            if (is_array($file)) {
                foreach ($file as $f) {
                    $http->attach($key . '[]', fopen($f->getPathname(), 'r'), $f->getClientOriginalName());
                }
            } else {
                $http->attach($key, fopen($file->getPathname(), 'r'), $file->getClientOriginalName());
            }
        }

        return $http->post($url, $data);
    }

    private function forwardWithJson(string $url, Request $request, string $internalKey): \Illuminate\Http\Client\Response
    {
        return Http::timeout(300)
            ->withHeaders([
                'X-Rahat-Internal-Key' => $internalKey,
                'Content-Type' => 'application/json',
            ])
            ->post($url, $request->all());
    }

    public function generateDescription(Request $request)
    {
        $user = $request->user();

        if (!$user->hasAiCredits(1)) {
            return response()->json([
                'error' => 'Yetersiz AI kredisi. Lütfen paket satın alın.',
                'credits' => $user->ai_credits,
            ], 403);
        }

        $validated = $request->validate([
            'name' => 'required|string',
            'brand' => 'nullable|string',
            'category' => 'nullable|string',
            'price' => 'nullable|numeric',
            'keywords' => 'nullable|string',
        ]);

        $prompt = "Aşağıdaki ürün için kısa ve ikna edici bir e-ticaret ürün açıklaması yaz. "
            . "Türkçe, 2-4 cümle, SEO dostu, ürün özelliklerini vurgula.\n";
        $prompt .= "Ürün Adı: " . $validated['name'] . "\n";
        if (!empty($validated['brand'])) {
            $prompt .= "Marka: " . $validated['brand'] . "\n";
        }
        if (!empty($validated['category'])) {
            $prompt .= "Kategori: " . $validated['category'] . "\n";
        }
        if (!empty($validated['price'])) {
            $prompt .= "Fiyat: " . $validated['price'] . " TL\n";
        }
        if (!empty($validated['keywords'])) {
            $prompt .= "Anahtar kelimeler: " . $validated['keywords'] . "\n";
        }
        $prompt .= "Sadece açıklamayı döndür, başlık veya ek metin ekleme.";

        $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/chat';
        $response = Http::timeout(60)->post($aiUrl, [
            'message' => $prompt,
            'history' => [],
            'storeInfo' => ['name' => $user->store?->name ?? 'Mağaza'],
        ]);

        if ($response->successful()) {
            $user->consumeAiCredits(1, 'ai_description', 'AI description');
            $reply = (string) ($response->json('reply') ?? '');
            return response()->json(['description' => trim($reply)]);
        }

        return response()->json(
            $response->json() ?? ['error' => 'AI servisi yanıt vermedi.'],
            $response->status()
        );
    }

    public function editImage(Request $request)
    {
        $user = $request->user();

        if (!$user->hasAiCredits(1)) {
            return response()->json([
                'error' => 'Yetersiz AI kredisi. Lütfen paket satın alın.',
                'credits' => $user->ai_credits,
            ], 403);
        }

        $urls = $request->input('image_urls', []);
        if (is_string($urls)) {
            $urls = [$urls];
        }
        $single = $request->input('image_url');
        if ($single) {
            $urls[] = $single;
        }
        $tmpFiles = [];

        try {
            if (!empty($urls)) {
                foreach ($urls as $url) {
                    $content = Http::timeout(30)->get($url)->body();
                    $ext = strtolower((string) pathinfo(parse_url((string) $url, PHP_URL_PATH), PATHINFO_EXTENSION));
                    $ext = in_array($ext, ['jpg', 'jpeg', 'png', 'webp']) ? $ext : 'jpg';
                    $tmp = tempnam(sys_get_temp_dir(), 'aiimg') . '.' . $ext;
                    file_put_contents($tmp, $content);
                    $tmpFiles[] = $tmp;
                }
            } elseif ($request->hasFile('images')) {
                $files = $request->file('images');
                $files = is_array($files) ? $files : [$files];
                foreach ($files as $f) {
                    $tmpFiles[] = $f->getPathname();
                }
            } else {
                return response()->json(['error' => 'En az bir görsel gerekli'], 400);
            }

            $internalKey = $this->keyService->generateEncryptedKey();
            $aiUrl = env('AI_SERVICE_URL', 'http://rahatio-ai:3000') . '/ai/process-image';

            $http = Http::timeout(300)->withHeaders(['X-Rahat-Internal-Key' => $internalKey]);
            $data = [
                'category' => $request->input('category', 'diger'),
                'notes' => $request->input('prompt') ?? $request->input('notes'),
                'keywords' => $request->input('prompt'),
            ];

            foreach ($tmpFiles as $path) {
                $name = basename($path);
                $http->attach('images[]', fopen($path, 'r'), $name);
            }

            $aiResponse = $http->post($aiUrl, $data);

            if ($aiResponse->successful()) {
                $user->consumeAiCredits(1, 'ai_image_edit', 'AI image edit');
                return response()->json($aiResponse->json(), $aiResponse->status());
            }

            return response()->json(
                $aiResponse->json() ?? ['error' => 'AI servisi yanıt vermedi.'],
                $aiResponse->status()
            );
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Görsel işlenemedi: ' . $e->getMessage()], 400);
        }
    }

    public function serveOutput(Request $request, string $sessionId, string $file)
    {
        $aiUrl = rtrim(env('AI_SERVICE_URL', 'http://rahatio-ai:3000'), '/')
            . '/output/' . rawurlencode($sessionId) . '/' . rawurlencode($file);

        $response = Http::timeout(30)->get($aiUrl);
        if (!$response->successful()) {
            abort(404);
        }

        $ct = $response->header('Content-Type') ?? 'image/png';
        return response($response->body())->header('Content-Type', $ct);
    }
}
