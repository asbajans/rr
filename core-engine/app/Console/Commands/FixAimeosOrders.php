<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixAimeosOrders extends Command
{
    protected $signature = 'rahatio:fix-orders';
    protected $description = 'Fix Aimeos OrderUpdateInvoiceNo migration by setting default invoiceno';

    public function handle(): int
    {
        try {
            $affected = DB::statement("UPDATE mshop_order SET invoiceno = CONCAT('INV-', id) WHERE invoiceno IS NULL");
            $this->info("Fixed {$affected} orders with null invoiceno");
        } catch (\Throwable $e) {
            $this->warn("Skipped: {$e->getMessage()}");
        }

        return Command::SUCCESS;
    }
}
