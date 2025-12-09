import bcrypt from 'bcryptjs';

// Test password hashing to verify the hashes work correctly
async function testPasswordHashes() {
  console.log('='.repeat(50));
  console.log('Testing Password Hashes');
  console.log('='.repeat(50));

  // Test admin password
  const adminPassword = 'admin@123';
  const adminHash = '$2a$10$slYQmyNdGzin7aUMHSVH2OPST9/PgBkqquzi.Ss7KIUgO2t0jKMm2';

  console.log('\n1. Testing ADMIN credentials:');
  console.log(`   Password: ${adminPassword}`);
  console.log(`   Hash: ${adminHash}`);
  
  try {
    const adminMatch = await bcrypt.compare(adminPassword, adminHash);
    console.log(`   Match: ${adminMatch ? '✅ PASS' : '❌ FAIL'}`);
  } catch (err) {
    console.log(`   Error: ${err}`);
  }

  // Test user password
  const userPassword = 'user@123';
  const userHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36DRcT3e';

  console.log('\n2. Testing USER credentials:');
  console.log(`   Password: ${userPassword}`);
  console.log(`   Hash: ${userHash}`);
  
  try {
    const userMatch = await bcrypt.compare(userPassword, userHash);
    console.log(`   Match: ${userMatch ? '✅ PASS' : '❌ FAIL'}`);
  } catch (err) {
    console.log(`   Error: ${err}`);
  }

  // Generate fresh hashes if needed
  console.log('\n3. Generating FRESH password hashes:');
  
  const adminFresh = await bcrypt.hash('admin@123', 10);
  const userFresh = await bcrypt.hash('user@123', 10);

  console.log(`\n   Admin Hash (fresh):`);
  console.log(`   ${adminFresh}`);
  
  console.log(`\n   User Hash (fresh):`);
  console.log(`   ${userFresh}`);

  console.log('\n' + '='.repeat(50));
  console.log('Use the FRESH hashes above in your database if needed!');
  console.log('='.repeat(50));
}

testPasswordHashes().catch(console.error);
