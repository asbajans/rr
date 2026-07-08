<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class SlaveDownloadController extends Controller
{
    private function ensureSlaveApiKey(\App\Models\Store $store): \App\Models\ApiKey
    {
        // Delete old key so plain_text is always available
        $store->apiKeys()->where('name', 'slave-auto')->delete();

        $plain = 'slv-' . bin2hex(random_bytes(16));
        $key = $store->apiKeys()->create([
            'name' => 'slave-auto',
            'key'  => hash('sha256', $plain),
        ]);
        $key->plain_text = $plain;

        return $key;
    }

    public function downloadPhp(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $apiKey = $this->ensureSlaveApiKey($store);

        $templatePath = resource_path('templates/slave/php/slave.php');
        if (!is_file($templatePath)) {
            return response()->json(['error' => 'Slave template not found.'], 500);
        }

        $code = file_get_contents($templatePath);

        $hmacSecret = env('RAHAT_INTERNAL_KEY', 'change-me-internal-key');

        $code = $this->injectConfig($code, [
            'api_url'     => env('APP_URL', 'https://api.rahatio.com.tr'),
            'api_key'     => $apiKey->plain_text,
            'hmac_secret' => $hmacSecret,
            'store_code'  => $store->site_code,
            'cache_dir'   => '__CACHE_DIR__',
            'site_name'   => $store->name,
        ]);

        return response($code, 200, [
            'Content-Type' => 'application/x-php',
            'Content-Disposition' => 'attachment; filename="rahatio-slave.php"',
        ]);
    }

    public function downloadVercel(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $apiKey = $this->ensureSlaveApiKey($store);

        $hmacSecret = env('RAHAT_INTERNAL_KEY', 'change-me-internal-key');
        $templateDir = resource_path('templates/slave/vercel');

        if (!is_dir($templateDir)) {
            return response()->json(['error' => 'Vercel template not found.'], 500);
        }

        $files = [
            'api/index.js' => file_get_contents($templateDir . '/api/index.js'),
            'vercel.json'  => file_get_contents($templateDir . '/vercel.json'),
        ];

        foreach ($files as $name => &$content) {
            $content = $this->injectConfig($content, [
                'api_url'     => env('APP_URL', 'https://api.rahatio.com.tr'),
                'api_key'     => $apiKey->plain_text,
                'hmac_secret' => $hmacSecret,
                'store_code'  => $store->site_code,
                'site_name'   => $store->name,
            ]);
        }

        $zip = new \ZipArchive();
        $zipPath = sys_get_temp_dir() . '/' . uniqid('rahatio-slave-vercel-', true) . '.zip';
        if ($zip->open($zipPath, \ZipArchive::CREATE) !== true) {
            return response()->json(['error' => 'Failed to create zip.'], 500);
        }

        foreach ($files as $name => $content) {
            $zip->addFromString($name, $content);
        }
        $zip->close();

        $response = response(file_get_contents($zipPath), 200, [
            'Content-Type' => 'application/zip',
            'Content-Disposition' => 'attachment; filename="rahatio-slave-vercel.zip"',
        ]);

        unlink($zipPath);

        return $response;
    }

    private function injectConfig(string $template, array $config): string
    {
        $isPhp = str_contains($template, '$_RAHATIO_CONFIG');

        $encoded = $isPhp
            ? $this->toPhpArray($config)
            : json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $replacement = $isPhp
            ? "// #CONFIG_START\n\$_RAHATIO_CONFIG = $encoded;\n// #CONFIG_END"
            : "// #CONFIG_START\nconst CONFIG = $encoded;\n// #CONFIG_END";

        return preg_replace('/\/\/ #CONFIG_START.*?\/\/ #CONFIG_END/s', $replacement, $template);
    }

    private function toPhpArray(array $data): string
    {
        $parts = [];
        foreach ($data as $key => $value) {
            $k = var_export($key, true);
            $v = var_export($value, true);
            $parts[] = "    $k => $v,";
        }
        return "[\n" . implode("\n", $parts) . "\n]";
    }
}
