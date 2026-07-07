<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class InitMinIO extends Command
{
    protected $signature = 'rahatio:init-minio';
    protected $description = 'Create MinIO bucket and set public policy';

    public function handle(): int
    {
        $disk = Storage::disk('minio');

        $bucket = config('filesystems.disks.minio.bucket');
        if (!$disk->exists('')) {
            $disk->makeDirectory('');
            $this->info("Bucket '{$bucket}' created.");
        } else {
            $this->info("Bucket '{$bucket}' already exists.");
        }

        $this->info('MinIO ready.');
        return Command::SUCCESS;
    }
}
