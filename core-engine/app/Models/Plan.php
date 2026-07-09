<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'ai_credits',
        'product_limit',
        'store_limit',
        'modules',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'decimal:2',
            'is_active' => 'boolean',
            'modules' => 'array',
        ];
    }

    public function stores()
    {
        return $this->hasMany(Store::class);
    }

    public function defaultModules(): array
    {
        return [
            'ai_product_create' => ['enabled' => true, 'credit_cost' => 5],
            'ai_image_generate' => ['enabled' => true, 'credit_cost' => 3],
            'b2b' => ['enabled' => false],
            'marketplace' => ['enabled' => false, 'limit' => 1],
            'xml_feed' => ['enabled' => false],
            'variations' => ['enabled' => false],
            'blog' => ['enabled' => true],
            'custom_domain' => ['enabled' => false],
            'shipping' => ['enabled' => true],
            'static_pages' => ['enabled' => true],
        ];
    }

    public function getModulesAttribute($value): array
    {
        $modules = $value ? json_decode($value, true) : [];
        return array_merge($this->defaultModules(), $modules);
    }
}
