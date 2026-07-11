<?php

use App\Http\Controllers\Api\Admin\ApiKeyController;
use App\Http\Controllers\Api\Admin\CategoryController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\FeedController;
use App\Http\Controllers\Api\Admin\MarketplaceIntegrationController;
use App\Http\Controllers\Api\Admin\PaymentMethodController;
use App\Http\Controllers\Api\Admin\StoreLocationController;
use App\Http\Controllers\Api\Admin\VariationController;
use App\Http\Controllers\Api\Admin\OrderController as AdminOrderController;
use App\Http\Controllers\Api\Admin\PlanController;
use App\Http\Controllers\Api\Admin\ProductController as AdminProductController;
use App\Http\Controllers\Api\Admin\SettingController;
use App\Http\Controllers\Api\Admin\StoreController as AdminStoreController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\AiGatewayController;
use App\Http\Controllers\Api\CheckoutController;
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
    Route::get('pages/{slug}', [\App\Http\Controllers\Api\PageController::class, 'publicShow']);
    Route::get('blog', [\App\Http\Controllers\Api\PageController::class, 'publicList']);
    Route::get('blog/{slug}', [\App\Http\Controllers\Api\PageController::class, 'publicShow']);
});

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::post('/ai/process-image', [AiGatewayController::class, 'proxy']);
    Route::get('/ai/status/{sessionId}', [AiGatewayController::class, 'getStatus']);
    Route::post('/ai/search', [AiGatewayController::class, 'search']);
    Route::post('/ai/recommend', [AiGatewayController::class, 'recommend']);
    Route::post('/ai/chat', [AiGatewayController::class, 'chat']);
    Route::post('/ai/analyze-product', [AiGatewayController::class, 'analyzeProduct']);

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
        Route::get('{id}', [AdminOrderController::class, 'show'])->where('id', '[0-9]+');
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

    Route::prefix('admin/shipping')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\ShippingController::class, 'index']);
        Route::put('/', [\App\Http\Controllers\Api\ShippingController::class, 'update']);
    });

    Route::prefix('admin/pages')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\PageController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Api\PageController::class, 'store']);
        Route::get('{page}', [\App\Http\Controllers\Api\PageController::class, 'show']);
        Route::put('{page}', [\App\Http\Controllers\Api\PageController::class, 'update']);
        Route::delete('{page}', [\App\Http\Controllers\Api\PageController::class, 'destroy']);
    });

    Route::post('/admin/upload', [MediaController::class, 'upload']);

    Route::prefix('admin/credits')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\CreditController::class, 'index']);
        Route::get('/stats', [\App\Http\Controllers\Api\CreditController::class, 'stats']);
    });

    Route::prefix('admin/orders')->group(function () {
        Route::get('/dropshipping', [AdminOrderController::class, 'dropshippingOrders']);
        Route::get('/dropshipping/{order}', [AdminOrderController::class, 'showDropshipping']);
        Route::put('/dropshipping/{order}/status', [AdminOrderController::class, 'updateStatus']);
        Route::put('/dropshipping/{order}/tracking', [AdminOrderController::class, 'updateTracking']);
        Route::get('/dropshipping/{order}/history', [AdminOrderController::class, 'statusHistory']);
        Route::get('/stats', [AdminOrderController::class, 'stats']);
    });

    Route::prefix('admin/subscription')->group(function () {
        Route::get('/', [\App\Http\Controllers\Api\SubscriptionController::class, 'index']);
        Route::post('/checkout', [\App\Http\Controllers\Api\SubscriptionController::class, 'checkout']);
        Route::post('/portal', [\App\Http\Controllers\Api\SubscriptionController::class, 'portal']);
        Route::post('/cancel', [\App\Http\Controllers\Api\SubscriptionController::class, 'cancel']);
        Route::post('/purchase-credits', [\App\Http\Controllers\Api\SubscriptionController::class, 'purchaseCredits']);
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

    Route::prefix('admin/feeds')->group(function () {
        Route::get('/', [FeedController::class, 'index']);
        Route::post('/', [FeedController::class, 'store']);
        Route::get('{feed}', [FeedController::class, 'show']);
        Route::put('{feed}', [FeedController::class, 'update']);
        Route::delete('{feed}', [FeedController::class, 'destroy']);
        Route::post('{feed}/test', [FeedController::class, 'test']);
        Route::post('{feed}/sync', [FeedController::class, 'sync']);
        Route::get('{feed}/logs', [FeedController::class, 'syncLogs']);
    });

    Route::prefix('admin/variations')->group(function () {
        Route::get('/', [VariationController::class, 'index']);
        Route::post('/', [VariationController::class, 'store']);
        Route::get('{variation}', [VariationController::class, 'show']);
        Route::put('{variation}', [VariationController::class, 'update']);
        Route::delete('{variation}', [VariationController::class, 'destroy']);
    });

    Route::prefix('admin/products/{productId}/variants')->group(function () {
        Route::get('/', [VariationController::class, 'variants']);
        Route::post('/', [VariationController::class, 'storeVariant']);
        Route::put('{variant}', [VariationController::class, 'updateVariant']);
        Route::delete('{variant}', [VariationController::class, 'destroyVariant']);
    });

    Route::prefix('admin/integrations')->group(function () {
        Route::get('/', [MarketplaceIntegrationController::class, 'index']);
        Route::post('{marketplace}/import', [MarketplaceIntegrationController::class, 'importProducts']);
        Route::put('{marketplace}', [MarketplaceIntegrationController::class, 'update']);
    });

    Route::prefix('admin/locations')->group(function () {
        Route::get('/', [StoreLocationController::class, 'index']);
        Route::post('/', [StoreLocationController::class, 'store']);
        Route::put('{location}', [StoreLocationController::class, 'update']);
        Route::delete('{location}', [StoreLocationController::class, 'destroy']);
    });

    Route::prefix('admin/payment-methods')->group(function () {
        Route::get('/', [PaymentMethodController::class, 'index']);
        Route::get('{method}', [PaymentMethodController::class, 'show']);
        Route::put('{method}', [PaymentMethodController::class, 'update']);
    });
});

Route::get('/store/{siteCode}/locations', [StoreLocationController::class, 'publicLocations']);

Route::get('/store/{siteCode}/payment-methods', [PaymentMethodController::class, 'checkoutMethods']);

Route::prefix('store/{siteCode}')->group(function () {
    Route::get('/addresses', [CheckoutController::class, 'addresses']);
    Route::post('/addresses', [CheckoutController::class, 'storeAddress']);
    Route::delete('/addresses/{address}', [CheckoutController::class, 'deleteAddress']);
    Route::post('/checkout', [CheckoutController::class, 'checkout']);
    Route::get('/checkout/payment-methods', [CheckoutController::class, 'paymentMethods']);
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

Route::get('/plans', [PlanController::class, 'publicIndex']);
