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
            $user->consumeAiCredits(1);
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
}
