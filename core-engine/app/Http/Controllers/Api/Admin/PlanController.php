<?php

namespace App\Http\Controllers\Api\Admin;

use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class PlanController extends Controller
{
    public function index()
    {
        return Plan::orderBy('price')->get();
    }

    public function publicIndex()
    {
        return Plan::where('is_active', true)->orderBy('price')->get();
    }

    public function show(Plan $plan)
    {
        return $plan;
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => 'required|string|max:64|unique:plans',
            'description' => 'nullable|string',
            'price' => 'required|numeric|min:0',
            'currency' => 'sometimes|string|size:3',
            'ai_credits' => 'required|integer|min:0',
            'product_limit' => 'required|integer|min:0',
            'store_limit' => 'sometimes|integer|min:1',
            'modules' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $plan = Plan::create($validated);

        if ($request->has('modules')) {
            $plan->update(['modules' => $request->modules]);
        }

        return $plan->fresh();
    }

    public function update(Request $request, Plan $plan)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:64|unique:plans,slug,' . $plan->id,
            'description' => 'nullable|string',
            'price' => 'sometimes|numeric|min:0',
            'currency' => 'sometimes|string|size:3',
            'ai_credits' => 'sometimes|integer|min:0',
            'product_limit' => 'sometimes|integer|min:0',
            'store_limit' => 'sometimes|integer|min:1',
            'modules' => 'nullable|array',
            'is_active' => 'boolean',
        ]);

        $plan->update($validated);

        if ($request->has('modules')) {
            $plan->update(['modules' => $request->modules]);
        }

        return $plan->fresh();
    }

    public function destroy(Plan $plan)
    {
        if ($plan->stores()->exists()) {
            return response()->json(['error' => 'Plan has active stores.'], 409);
        }

        $plan->delete();

        return response()->json(['message' => 'Plan deleted.']);
    }
}
