<?php

use App\Http\Controllers\Api\AiGatewayController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\WooCommerce\ProductController;
use App\Http\Controllers\Api\WooCommerce\StockController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::post('/orders', [OrderController::class, 'store']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::post('/ai/process-image', [AiGatewayController::class, 'proxy']);
});

Route::middleware('auth.api-key')->group(function () {

    Route::prefix('products')->group(function () {
        Route::get('/', [ProductController::class, 'index']);
        Route::get('{id}', [ProductController::class, 'show']);
        Route::post('sync', [ProductController::class, 'sync']);
    });

    Route::prefix('stocks')->group(function () {
        Route::get('{sku}', [StockController::class, 'show']);
        Route::put('/', [StockController::class, 'update']);
    });

});
