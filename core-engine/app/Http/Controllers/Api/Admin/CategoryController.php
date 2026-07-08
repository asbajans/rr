<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Category;
use App\Models\MarketplaceCategoryMapping;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

class CategoryController extends Controller
{
    public function index()
    {
        $categories = Category::with('children')->whereNull('parent_id')->orderBy('sort_order')->get();
        return response()->json(['data' => $categories]);
    }

    public function tree()
    {
        return response()->json(['data' => Category::tree()]);
    }

    public function flat()
    {
        $categories = Category::where('is_active', true)->orderBy('sort_order')->get()->map(function ($cat) {
            $path = [$cat->name];
            $parent = $cat->parent;
            while ($parent) {
                array_unshift($path, $parent->name);
                $parent = $parent->parent;
            }
            $cat->path = implode(' > ', $path);
            return $cat;
        });
        return response()->json(['data' => $categories]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'slug' => 'required|string|max:255|unique:categories,slug',
            'name' => 'required|string|max:255',
            'parent_id' => 'nullable|integer|exists:categories,id',
            'translations' => 'nullable|array',
            'icon' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        $category = Category::create($validated);
        return response()->json($category, 201);
    }

    public function show(Category $category)
    {
        $category->load('children', 'marketplaceMappings');
        return response()->json($category);
    }

    public function update(Request $request, Category $category)
    {
        $validated = $request->validate([
            'slug' => 'sometimes|string|max:255|unique:categories,slug,' . $category->id,
            'name' => 'sometimes|string|max:255',
            'parent_id' => 'nullable|integer|exists:categories,id',
            'translations' => 'nullable|array',
            'icon' => 'nullable|string|max:255',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        if (isset($validated['parent_id']) && $validated['parent_id'] == $category->id) {
            throw ValidationException::withMessages(['parent_id' => 'A category cannot be its own parent']);
        }

        $category->update($validated);
        return response()->json($category);
    }

    public function destroy(Category $category)
    {
        if ($category->children()->exists()) {
            return response()->json(['error' => 'Cannot delete category with subcategories'], 409);
        }
        $category->marketplaceMappings()->delete();
        $category->delete();
        return response()->json(['message' => 'Category deleted']);
    }

    public function mappings(Category $category)
    {
        return response()->json(['data' => $category->marketplaceMappings]);
    }

    public function updateMapping(Request $request, Category $category)
    {
        $validated = $request->validate([
            'marketplace' => 'required|string|in:trendyol,hepsiburada,n11,pazarama,etsy,amazon',
            'marketplace_category_id' => 'required|string|max:255',
            'marketplace_category_name' => 'required|string|max:255',
            'marketplace_parent_id' => 'nullable|string|max:255',
        ]);

        $mapping = MarketplaceCategoryMapping::updateOrCreate(
            [
                'category_id' => $category->id,
                'marketplace' => $validated['marketplace'],
            ],
            $validated
        );

        return response()->json($mapping);
    }

    public function deleteMapping(Category $category, string $marketplace)
    {
        MarketplaceCategoryMapping::where('category_id', $category->id)
            ->where('marketplace', $marketplace)
            ->delete();

        return response()->json(['message' => 'Mapping deleted']);
    }
}
