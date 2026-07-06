<?php

use App\Http\Controllers\Api\WooCommerce\ProductController;
use App\Http\Controllers\Api\WooCommerce\StockController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:api-key')->group(function () {

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
