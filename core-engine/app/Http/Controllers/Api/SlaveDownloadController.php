<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Crypt;

class SlaveDownloadController extends Controller
{
    public function downloadPhp(Request $request)
    {
        $user = $request->user();
        $store = $user->store;

        if (!$store) {
            return response()->json(['error' => 'No store assigned.'], 400);
        }

        $apiKey = $store->apiKeys()->first();
        if (!$apiKey) {
            return response()->json(['error' => 'No API key found. Create one first.'], 400);
        }

        $templatePath = base_path('../slave/php/slave.php');
        if (!is_file($templatePath)) {
            return response()->json(['error' => 'Slave template not found.'], 500);
        }

        $code = file_get_contents($templatePath);

        $hmacSecret = env('RAHAT_INTERNAL_KEY', 'change-me-internal-key');

        $code = $this->injectConfig($code, [
            'api_url'     => env('APP_URL', 'https://api.rahatio.com.tr'),
            'api_key'     => $apiKey->plain_text ?? $apiKey->key,
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

        $apiKey = $store->apiKeys()->first();
        if (!$apiKey) {
            return response()->json(['error' => 'No API key found.'], 400);
        }

        $hmacSecret = env('RAHAT_INTERNAL_KEY', 'change-me-internal-key');
        $templatePath = base_path('../slave/vercel');

        if (!is_dir($templatePath)) {
            return response()->json(['error' => 'Vercel template not found.'], 500);
        }

        $files = [
            'api/index.js' => file_get_contents($templatePath . '/api/index.js'),
            'vercel.json'  => file_get_contents($templatePath . '/vercel.json'),
        ];

        foreach ($files as $name => &$content) {
            $content = $this->injectConfig($content, [
                'api_url'     => env('APP_URL', 'https://api.rahatio.com.tr'),
                'api_key'     => $apiKey->plain_text ?? $apiKey->key,
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
        $json = json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // PHP template
        $template = preg_replace(
            '/\/\/ #CONFIG_START.*?#CONFIG_END/s',
            "// #CONFIG_START\n\$_RAHATIO_CONFIG = $json;\n// #CONFIG_END",
            $template
        );

        // JS template
        $template = preg_replace(
            '/\/\/ #CONFIG_START.*?\/\/ #CONFIG_END/s',
            "// #CONFIG_START\nconst CONFIG = $json;\n// #CONFIG_END",
            $template
        );

        return $template;
    }
}
