<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MediaController extends Controller
{
    public function upload(Request $request)
    {
        $request->validate([
            'file' => 'required|image|mimes:jpg,jpeg,png,webp|max:10240',
        ]);

        $user = $request->user();
        $storeId = $user->store_id ?? 'system';
        $ext = $request->file('file')->extension();
        $filename = Str::uuid() . '.' . $ext;
        $path = "stores/{$storeId}/products/{$filename}";

        try {
            $stored = Storage::disk('minio')->put($path, file_get_contents($request->file('file')->path()));

            if (!$stored) {
                return response()->json(['error' => 'Upload failed'], 500);
            }
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Storage error: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'path' => $path,
            'url' => '/api/media/' . $path,
        ]);
    }

    public function serve(string $path)
    {
        $disk = Storage::disk('minio');

        try {
            if (!$disk->exists($path)) {
                return response()->json(['error' => 'File not found'], 404);
            }

            $content = $disk->get($path);
            $mime = $disk->mimeType($path);

            return response($content, 200)->header('Content-Type', $mime);
        } catch (\Throwable $e) {
            return response()->json(['error' => 'Media error: ' . $e->getMessage()], 500);
        }
    }
}
