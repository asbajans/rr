<?php

namespace App\Http\Controllers\Api;

use App\Models\Page;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PageController extends Controller
{
    public function index(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store found'], 404);
        }
        return Page::where('store_id', $store->id)->orderBy('created_at', 'desc')->get();
    }

    public function show(Page $page)
    {
        $this->authorizeStore($page);
        return $page;
    }

    public function store(Request $request)
    {
        $store = $request->user()->store;
        if (!$store) {
            return response()->json(['error' => 'No store found'], 404);
        }

        $validated = $request->validate([
            'type' => 'sometimes|string|in:page,blog',
            'title' => 'required|string|max:255',
            'slug' => 'sometimes|string|max:255',
            'content' => 'required|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'is_published' => 'boolean',
        ]);

        $validated['store_id'] = $store->id;

        return Page::create($validated);
    }

    public function update(Request $request, Page $page)
    {
        $this->ensureStore($page);

        $validated = $request->validate([
            'type' => 'sometimes|string|in:page,blog',
            'title' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:255',
            'content' => 'sometimes|string',
            'meta_title' => 'nullable|string|max:255',
            'meta_description' => 'nullable|string|max:500',
            'is_published' => 'boolean',
        ]);

        $page->update($validated);

        return $page->fresh();
    }

    public function destroy(Page $page)
    {
        $this->ensureStore($page);
        $page->delete();
        return response()->json(['message' => 'Page deleted.']);
    }

    // Public: store frontend sayfa/blog gösterimi
    public function publicShow(Request $request, string $siteCode, string $slug)
    {
        $page = Page::whereHas('store', fn($q) => $q->where('site_code', $siteCode))
            ->where('slug', $slug)
            ->where('is_published', true)
            ->firstOrFail();

        return $page;
    }

    private function ensureStore(Page $page): void
    {
        $storeId = request()->user()->store?->id;
        if (!$storeId || $page->store_id !== $storeId) {
            abort(403, 'Forbidden');
        }
    }
}