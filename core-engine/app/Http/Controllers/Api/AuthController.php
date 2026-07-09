<?php

namespace App\Http\Controllers\Api;

use App\Models\Plan;
use App\Models\Store;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'store_id' => 'nullable|exists:stores,id',
            'store_name' => 'nullable|string|max:255',
            'fcm_token' => 'nullable|string',
        ]);

        $plan = Plan::where('is_active', true)->orderBy('price')->first();
        $storeName = $validated['store_name'] ?? $validated['name'] . "'s Store";
        $siteCode = Str::slug($storeName) . '-' . Str::random(4);

        $store = Store::create([
            'name' => $storeName,
            'site_code' => $siteCode,
            'email' => $validated['email'],
            'plan_id' => $plan?->id,
            'is_active' => true,
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'store_id' => $store->id,
            'fcm_token' => $validated['fcm_token'] ?? null,
            'ai_credits' => $plan?->ai_credits ?? 10,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin']),
            'store' => $store->only(['id', 'name', 'site_code', 'domain', 'email']),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
            'fcm_token' => 'nullable|string',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Girdiğiniz bilgiler hatalı.'],
            ]);
        }

        if (!empty($validated['fcm_token'])) {
            $user->update(['fcm_token' => $validated['fcm_token']]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin']),
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $data = $user->only(['id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin']);
        $data['store'] = $user->store?->only(['id', 'name', 'site_code', 'domain', 'email']);

        return response()->json($data);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Oturum kapatıldı.']);
    }
}
