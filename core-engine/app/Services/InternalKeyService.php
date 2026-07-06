<?php

namespace App\Services;

use Illuminate\Support\Str;

class InternalKeyService
{
    private string $secret;

    public function __construct()
    {
        $this->secret = env('RAHAT_INTERNAL_KEY', 'rahat-internal-default-change-me');
    }

    public function generateEncryptedKey(): string
    {
        $timestamp = now()->timestamp;
        $nonce = Str::random(16);
        $payload = "{$timestamp}:{$nonce}";
        $hash = hash_hmac('sha256', $payload, $this->secret);

        return base64_encode("{$payload}:{$hash}");
    }

    public function validateEncryptedKey(string $encoded): bool
    {
        $decoded = base64_decode($encoded, true);
        if (!$decoded || substr_count($decoded, ':') < 2) {
            return false;
        }

        $parts = explode(':', $decoded);
        $timestamp = (int) $parts[0];
        $nonce = $parts[1];
        $hash = $parts[2];

        $expected = hash_hmac('sha256', "{$timestamp}:{$nonce}", $this->secret);

        if (!hash_equals($expected, $hash)) {
            return false;
        }

        if (abs(now()->timestamp - $timestamp) > 30) {
            return false;
        }

        return true;
    }
}
