<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Category extends Model
{
    protected $fillable = [
        'parent_id',
        'slug',
        'name',
        'translations',
        'icon',
        'sort_order',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'translations' => 'array',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function parent()
    {
        return $this->belongsTo(Category::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Category::class, 'parent_id')->orderBy('sort_order');
    }

    public function marketplaceMappings()
    {
        return $this->hasMany(MarketplaceCategoryMapping::class);
    }

    public static function tree(): array
    {
        $all = self::where('is_active', true)->orderBy('sort_order')->get()->keyBy('id');
        $roots = $all->where('parent_id', null);

        $build = function ($items) use ($all, &$build) {
            $result = [];
            foreach ($items as $cat) {
                $node = $cat->toArray();
                $children = $all->where('parent_id', $cat->id);
                $node['children'] = $children->isNotEmpty() ? $build($children) : [];
                $result[] = $node;
            }
            return $result;
        };

        return $build($roots);
    }
}
