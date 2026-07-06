<?php

use Illuminate\Support\Facades\Route;

Route::middleware('domain.store')->group(function () {
    Route::any('/{any?}', function () {
        return response()->json(['error' => 'Not Found'], 404);
    })->where('any', '.*');
});
