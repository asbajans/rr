<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanAllProducts extends Command
{
    protected $signature = 'rahatio:clean-products {--force : Skip confirmation}';
    protected $description = 'Delete ALL products and related data from Aimeos (mshop_* tables). Use with caution!';

    public function handle(): int
    {
        if (!$this->option('force')) {
            if (!$this->confirm('This will DELETE ALL products, prices, stocks, media, texts, properties, marketplace data, categories from ALL stores. Continue?')) {
                $this->info('Cancelled.');
                return Command::SUCCESS;
            }
        }

        $this->info('Starting complete product cleanup...');

        $tables = [
            // Product relations (must delete first due to FK constraints)
            'mshop_product_list',
            'mshop_product_property',
            'mshop_product_attribute',
            // Core product data
            'mshop_price',
            'mshop_stock',
            'mshop_media',
            'mshop_text',
            'mshop_product',
            // Catalog (categories)
            'mshop_catalog_list',
            'mshop_catalog',
            // Attribute/Property/Type definitions
            'mshop_attribute',
            'mshop_property',
            'mshop_type',
            // Marketplace & custom tables
            'marketplace_integrations',
            'marketplace_imports',
            'marketplace_categories',
            'product_b2b_settings',
            'b2b_requests',
            'b2b_listed_products',
        ];

        // Disable FK checks temporarily
        DB::statement('SET FOREIGN_KEY_CHECKS = 0');

        $deletedCounts = [];

        foreach ($tables as $table) {
            try {
                // Check if table exists
                $exists = DB::select("SHOW TABLES LIKE ?", [$table]);
                if (empty($exists)) {
                    $this->warn("Table '$table' does not exist, skipping.");
                    continue;
                }

                $count = DB::table($table)->count();
                if ($count > 0) {
                    DB::table($table)->truncate();
                    $deletedCounts[$table] = $count;
                    $this->info("Truncated '$table' ($count rows)");
                } else {
                    $this->line("Table '$table' already empty");
                }
            } catch (\Throwable $e) {
                $this->error("Failed to truncate '$table': " . $e->getMessage());
            }
        }

        // Re-enable FK checks
        DB::statement('SET FOREIGN_KEY_CHECKS = 1');

        // Summary
        $this->newLine();
        $this->info('=== CLEANUP SUMMARY ===');
        foreach ($deletedCounts as $table => $count) {
            $this->line("  $table: $count rows deleted");
        }
        $total = array_sum($deletedCounts);
        $this->info("Total rows deleted: $total");

        return Command::SUCCESS;
    }
}