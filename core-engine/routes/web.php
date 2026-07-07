<?php

use Illuminate\Support\Facades\Route;

// Platform ana domain'i — landing page
Route::get('/', function () {
    return response()->json([
        'name' => 'Rahatio',
        'description' => 'AI Destekli E-Ticaret Platformu',
        'version' => '1.0.0',
    ]);
});

Route::get('/health', function () {
    return response()->json(['status' => 'ok', 'timestamp' => now()->toIso8601String()]);
});

// Müşteri domain'leri — domain.store middleware ile store'a yönlendir
Route::middleware('domain.store')->group(function () {
    Route::any('/{any?}', function () {
        return response()->json(['error' => 'Not Found'], 404);
    })->where('any', '.*');
});
