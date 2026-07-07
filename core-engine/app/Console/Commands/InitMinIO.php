<?php

namespace App\Console\Commands;

use Aws\S3\S3Client;
use Illuminate\Console\Command;

class InitMinIO extends Command
{
    protected $signature = 'rahatio:init-minio';
    protected $description = 'Create MinIO bucket';

    public function handle(): int
    {
        $config = config('filesystems.disks.minio');
        $bucket = $config['bucket'];

        $client = new S3Client([
            'version' => 'latest',
            'region' => $config['region'] ?? 'us-east-1',
            'endpoint' => $config['endpoint'],
            'use_path_style_endpoint' => true,
            'credentials' => [
                'key' => $config['key'],
                'secret' => $config['secret'],
            ],
            'http' => ['timeout' => 5],
        ]);

        try {
            $client->headBucket(['Bucket' => $bucket]);
            $this->info("Bucket '{$bucket}' exists.");
        } catch (\Aws\S3\Exception\S3Exception $e) {
            if ($e->getStatusCode() === 404) {
                $client->createBucket(['Bucket' => $bucket]);
                $this->info("Bucket '{$bucket}' created.");
            } else {
                $this->error("S3 error: " . $e->getMessage());
                return Command::FAILURE;
            }
        } catch (\Throwable $e) {
            $this->error("Error: " . $e->getMessage());
            return Command::FAILURE;
        }

        $this->info('MinIO ready.');
        return Command::SUCCESS;
    }
}
