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

        $stored = Storage::disk('minio')->put($path, file_get_contents($request->file('file')->path()));

        if (!$stored) {
            return response()->json(['error' => 'Upload failed'], 500);
        }

        $publicBase = rtrim(config('filesystems.disks.minio.public_url', 'http://localhost:3700/rahatio'), '/');

        return response()->json([
            'path' => $path,
            'url' => $publicBase . '/' . $path,
        ]);
    }
}
