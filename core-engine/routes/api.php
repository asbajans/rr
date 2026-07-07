<?php

use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\PlanController;
use App\Http\Controllers\Api\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
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

    Route::get('/admin/dashboard', [DashboardController::class, 'index']);

    Route::prefix('admin/stores')->group(function () {
        Route::get('/', [AdminStoreController::class, 'index']);
        Route::post('/', [AdminStoreController::class, 'store']);
        Route::get('{store}', [AdminStoreController::class, 'show']);
        Route::put('{store}', [AdminStoreController::class, 'update']);
        Route::delete('{store}', [AdminStoreController::class, 'destroy']);
    });

    Route::prefix('admin/users')->group(function () {
        Route::get('/', [AdminUserController::class, 'index']);
        Route::get('{user}', [AdminUserController::class, 'show']);
        Route::put('{user}', [AdminUserController::class, 'update']);
        Route::delete('{user}', [AdminUserController::class, 'destroy']);
    });

    Route::prefix('admin/plans')->group(function () {
        Route::get('/', [PlanController::class, 'index']);
        Route::post('/', [PlanController::class, 'store']);
        Route::get('{plan}', [PlanController::class, 'show']);
        Route::put('{plan}', [PlanController::class, 'update']);
        Route::delete('{plan}', [PlanController::class, 'destroy']);
    });
});

Route::middleware(\App\Http\Middleware\AuthenticateWithApiKey::class)->group(function () {

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
