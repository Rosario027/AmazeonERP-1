#!/usr/bin/env node

/**
 * ONE-TIME DEPLOYMENT SCRIPT
 * Invalidates all active user sessions during deployment
 * 
 * This script runs ONCE during deployment and can be safely deleted after use
 */

import pg from 'pg';

// Load environment
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  try {
    await import('dotenv/config');
  } catch (e) {
    console.log('⚠️  dotenv not available, using environment variables');
  }
}

if (!process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set.');
  console.error('Please ensure DATABASE_URL is configured in your deployment environment.');
  process.exit(1);
}

async function invalidateAllSessions() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('\n🔐 Invalidating ALL active sessions...');
    
    // Increment token_version for all users
    const result = await client.query(`
      UPDATE users 
      SET token_version = COALESCE(token_version, 0) + 1,
          updated_at = NOW()
      RETURNING id, username, role, token_version;
    `);

    console.log(`\n✅ Invalidated sessions for ${result.rowCount} user(s):`);
    result.rows.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.username} (${user.role}) - token_version: ${user.token_version}`);
    });

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL SESSIONS INVALIDATED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('\n📋 What happened:');
    console.log('   • All active JWT tokens are now INVALID');
    console.log('   • Users must LOGIN AGAIN to access the system');
    console.log('   • This is a ONE-TIME security measure');
    console.log('\n💡 You can safely delete this script after deployment\n');

  } catch (error) {
    console.error('\n❌ Error invalidating sessions:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the script
console.log('='.repeat(60));
console.log('ONE-TIME SESSION INVALIDATION SCRIPT');
console.log('Deployment: ' + new Date().toISOString());
console.log('='.repeat(60));

invalidateAllSessions()
  .then(() => {
    console.log('✅ Script completed successfully\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
