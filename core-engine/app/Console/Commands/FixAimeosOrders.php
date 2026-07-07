<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class FixAimeosOrders extends Command
{
    protected $signature = 'rahatio:fix-orders';
    protected $description = 'Fix Aimeos OrderUpdateInvoiceNo migration - set defaults, alter column, mark complete';

    public function handle(): int
    {
        $tables = DB::select("SHOW TABLES LIKE 'mshop_order'");
        if (empty($tables) && empty(DB::select("SHOW TABLES LIKE '%upscheme%'"))) {
            $this->warn('Aimeos tables not found, skipping');
            return Command::SUCCESS;
        }

        // 1. Fix NULL invoiceno values
        DB::update("UPDATE mshop_order SET invoiceno = CONCAT('INV-', id) WHERE invoiceno IS NULL");
        $this->info('NULL invoiceno values fixed');

        // 2. Alter column to NOT NULL with default
        DB::statement("ALTER TABLE mshop_order MODIFY COLUMN invoiceno VARCHAR(255) NOT NULL DEFAULT ''");
        $this->info('invoiceno column altered to NOT NULL');

        // 3. Mark the Aimeos migration as completed
        $schema = DB::connection()->getDatabaseName();
        $tasks = DB::select("SELECT * FROM information_schema.tables WHERE table_schema = ? AND table_name LIKE '%upscheme%'", [$schema]);
        foreach ($tasks as $table) {
            $upschemeTable = $table->TABLE_NAME;
            $exists = DB::table($upschemeTable)
                ->where('task', 'OrderUpdateInvoiceNo')
                ->exists();
            if (!$exists) {
                DB::table($upschemeTable)->insert([
                    'task' => 'OrderUpdateInvoiceNo',
                    'siteid' => 'default',
                ]);
                $this->info('OrderUpdateInvoiceNo marked as completed');
            }
        }

        return Command::SUCCESS;
    }
}
