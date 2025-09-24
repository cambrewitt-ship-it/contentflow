#!/usr/bin/env node

/**
 * Simple script to run the base64 to blob URL migration
 * Usage: node run-migration.js [--dry-run] [--limit=10]
 */

const fetch = require('node-fetch');

async function runMigration() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 10;
  
  console.log('🚀 Starting migration...');
  console.log(`   Dry run: ${dryRun}`);
  console.log(`   Limit per table: ${limit}`);
  
  try {
    const response = await fetch('http://localhost:3000/api/migrate-base64-to-blob', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dryRun,
        limit
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Migration completed successfully!');
      console.log(`   Total found: ${data.totalFound}`);
      console.log(`   Total converted: ${data.totalConverted}`);
      
      console.log('\n📊 Table results:');
      data.results.forEach(result => {
        console.log(`   ${result.table}: ${result.converted}/${result.found || 0} converted`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      });
    } else {
      console.error('❌ Migration failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error running migration:', error);
  }
}

runMigration();
