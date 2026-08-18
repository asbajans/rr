const { normalizeMarketplaceStatus } = require('./packages/core/src/modules/integration/orderImport.js');

// Test N11 statuses that might come from API
const n11Statuses = ['Created', 'WaitingForApproval', 'Approved', 'Picking', 'Invoiced', 'UnPacked', 'UnSupplied', 'Shipped', 'Kargolandi', 'Kargolandi', 'Completed', 'Delivered', 'Cancelled', 'Returned', 'siparis alindi', 'kargoya verildi', 'Teslim edildi'];
console.log('=== N11 STATUS NORMALIZATION ===');
for (const s of n11Statuses) {
  const result = normalizeMarketplaceStatus('n11', s);
  console.log(`normalizeMarketplaceStatus('n11', ${JSON.stringify(s)}) => ${JSON.stringify(result)}`);
}

// Test Pazarama statuses
const pazaramaStatuses = [3, 12, 5, 11, 9, 14, 15, '3', '12', '5', '11', '9'];
console.log('\n=== PAZARAMA STATUS NORMALIZATION ===');
for (const s of pazaramaStatuses) {
  const result = normalizeMarketplaceStatus('pazarama', s);
  console.log(`normalizeMarketplaceStatus('pazarama', ${JSON.stringify(s)}) => ${JSON.stringify(result)}`);
}