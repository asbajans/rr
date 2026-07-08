<?php

use App\Http\Controllers\Api\Admin\ApiKeyController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Api\Admin\PlanController;
use App\Http\Controllers\Api\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AiGatewayController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\B2bController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\MediaController;
use App\Http\Controllers\Api\SlaveDownloadController;
use App\Http\Controllers\Api\StoreFrontController;
use App\Http\Controllers\Api\WooCommerce\ProductController;
use App\Http\Controllers\Api\WooCommerce\StockController;
use Illuminate\Support\Facades\Route;

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::post('/orders', [OrderController::class, 'store']);

Route::post('/stripe/webhook', [\App\Http\Controllers\Api\SubscriptionController::class, 'webhook']);

Route::get('/media/{path}', [MediaController::class, 'serve'])->where('path', '.*');

Route::get('/resolve-domain', [StoreFrontController::class, 'resolveDomain']);

Route::prefix('store/{siteCode}')->group(function () {
    Route::get('/', [StoreFrontController::class, 'show']);
    Route::get('products/{id}', [StoreFrontController::class, 'product']);
});

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

    Route::prefix('admin/products')->group(function () {
        Route::get('/', [AdminProductController::class, 'index']);
        Route::post('/', [AdminProductController::class, 'store']);
        Route::get('{id}', [AdminProductController::class, 'show']);
        Route::put('{id}', [AdminProductController::class, 'update']);
        Route::delete('{id}', [AdminProductController::class, 'destroy']);
    });

    Route::prefix('admin/orders')->group(function () {
        Route::get('/', [AdminOrderController::class, 'index']);
        Route::get('{id}', [AdminOrderController::class, 'show']);
    });

    Route::prefix('admin/api-keys')->group(function () {
        Route::get('/', [ApiKeyController::class, 'index']);
        Route::post('/', [ApiKeyController::class, 'store']);
        Route::get('{apiKey}', [ApiKeyController::class, 'show']);
        Route::put('{apiKey}', [ApiKeyController::class, 'update']);
        Route::delete('{apiKey}', [ApiKeyController::class, 'destroy']);
    });

    Route::prefix('admin/categories')->group(function () {
        Route::get('/', [CategoryController::class, 'index']);
        Route::get('/tree', [CategoryController::class, 'tree']);
        Route::get('/flat', [CategoryController::class, 'flat']);
        Route::post('/', [CategoryController::class, 'store']);
        Route::get('{category}', [CategoryController::class, 'show']);
        Route::put('{category}', [CategoryController::class, 'update']);
        Route::delete('{category}', [CategoryController::class, 'destroy']);
        Route::get('{category}/mappings', [CategoryController::class, 'mappings']);
        Route::post('{category}/mappings', [CategoryController::class, 'updateMapping']);
        Route::delete('{category}/mappings/{marketplace}', [CategoryController::class, 'deleteMapping']);
    });

    Route::get('/admin/settings', [SettingController::class, 'index']);
    Route::put('/admin/settings', [SettingController::class, 'update']);

    Route::post('/admin/upload', [MediaController::class, 'upload']);

    Route::prefix('admin/subscription')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\SubscriptionController::class, 'index']);
        Route::post('/checkout', [\App\Http\Controllers\Api\SubscriptionController::class, 'checkout']);
        Route::post('/portal', [\App\Http\Controllers\Api\SubscriptionController::class, 'portal']);
        Route::post('/cancel', [\App\Http\Controllers\Api\SubscriptionController::class, 'cancel']);
    });

    Route::get('/admin/slave/download-php', [SlaveDownloadController::class, 'downloadPhp']);
    Route::get('/admin/slave/download-vercel', [SlaveDownloadController::class, 'downloadVercel']);

    Route::prefix('b2b')->group(function () {
        Route::get('/discover', [B2bController::class, 'discover']);
        Route::get('/settings', [B2bController::class, 'getSettings']);
        Route::get('/settings/{productId}', [B2bController::class, 'getSettings']);
        Route::put('/settings', [B2bController::class, 'updateSettings']);
        Route::get('/requests', [B2bController::class, 'requests']);
        Route::post('/requests', [B2bController::class, 'createRequest']);
        Route::put('/requests/{id}', [B2bController::class, 'updateRequest']);
        Route::post('/requests/{id}/clone', [B2bController::class, 'cloneProduct']);
        Route::get('/listed', [B2bController::class, 'listedProducts']);
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
