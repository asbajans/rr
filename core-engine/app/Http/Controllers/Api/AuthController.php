<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
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
            'fcm_token' => 'nullable|string',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'store_id' => $validated['store_id'] ?? null,
            'fcm_token' => $validated['fcm_token'] ?? null,
            'ai_credits' => 10,
        ]);

        $token = $user->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin']),
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

        $token = $user->createToken('mobile-app')->plainTextToken;

        return response()->json([
            'user' => $user->only(['id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin']),
            'token' => $token,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json($request->user()->only([
            'id', 'name', 'email', 'ai_credits', 'store_id', 'is_admin',
        ]));
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Oturum kapatıldı.']);
    }
}
