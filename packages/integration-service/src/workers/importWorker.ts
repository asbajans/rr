import { Worker, Job } from 'bullmq';
import { config } from '../config/env.js';
import axios from 'axios';

interface ImportJobData {
  marketplace: string;
  maxPages: number;
}

export const importWorker = new Worker<ImportJobData>(
  'import',
  async (job: Job<ImportJobData>) => {
    const { marketplace, maxPages } = job.data;
    
    console.log(`Starting import from ${marketplace} (max ${maxPages} pages)`);
    
    const coreClient = axios.create({
      baseURL: config.coreApiUrl,
      headers: { 'x-internal-key': config.coreApiKey },
    });
    
    let imported = 0;
    let failed = 0;
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        await job.updateProgress(Math.round((page / maxPages) * 100));
        
        const response = await coreClient.post('/api/admin/marketplace/import', {
          marketplace,
          page,
        });
        
        const result = response.data;
        imported += result.imported || 0;
        failed += result.failed || 0;
        
        if (result.hasMore === false) break;
        
      } catch (err: any) {
        console.error(`Import page ${page} failed:`, err.message);
        failed++;
      }
    }
    
    return { imported, failed, marketplace };
  },
  { connection: { url: config.redis.url } }
);

importWorker.on('completed', (job) => {
  console.log(`Import completed:`, job.returnvalue);
});

importWorker.on('failed', (job, err) => {
  console.error(`Import failed:`, err);
});