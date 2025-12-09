import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import bcrypt from 'bcryptjs';
import * as schema from '@shared/schema';
import { eq } from 'drizzle-orm';

// Load environment
if (!process.env.DATABASE_URL && process.env.NODE_ENV !== 'production') {
  try {
    await import('dotenv/config');
  } catch (e) {
    // Ignore
  }
}

if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

async function displayUsers() {
  console.log('\n========== CURRENT USERS IN DATABASE ==========\n');
  const users = await db.select({
    id: schema.users.id,
    username: schema.users.username,
    role: schema.users.role,
  }).from(schema.users);

  if (users.length === 0) {
    console.log('No users found in database.');
  } else {
    users.forEach((user, index) => {
      console.log(`${index + 1}. Username: ${user.username}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Role: ${user.role}`);
      console.log('');
    });
  }
}

async function resetUserPassword(username: string, newPassword: string) {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  
  const updated = await db
    .update(schema.users)
    .set({ password: hashedPassword })
    .where(eq(schema.users.username, username))
    .returning();

  if (updated.length === 0) {
    console.log(`\n❌ User '${username}' not found in database.`);
    return false;
  }

  console.log(`\n✅ Password for user '${username}' has been reset!`);
  console.log(`New Password: ${newPassword}\n`);
  return true;
}

async function createUser(username: string, password: string, role: 'admin' | 'user' = 'user') {
  // Check if user exists
  const existing = await db.select().from(schema.users).where(eq(schema.users.username, username));
  if (existing.length > 0) {
    console.log(`\n❌ User '${username}' already exists!`);
    return false;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = await db.insert(schema.users).values({
    username,
    password: hashedPassword,
    role,
  }).returning();

  if (newUser.length === 0) {
    console.log(`\n❌ Failed to create user '${username}'.`);
    return false;
  }

  console.log(`\n✅ User '${username}' created successfully!`);
  console.log(`Role: ${role}`);
  console.log(`Password: ${password}`);
  console.log(`ID: ${newUser[0].id}\n`);
  return true;
}

async function main() {
  try {
    console.log('='.repeat(50));
    console.log('AmazeonERP - User Management Utility');
    console.log('='.repeat(50));

    // Display existing users
    await displayUsers();

    // Create default admin and user if they don't exist
    console.log('='.repeat(50));
    console.log('SETTING UP DEFAULT CREDENTIALS');
    console.log('='.repeat(50));

    const adminExists = await db.select().from(schema.users).where(eq(schema.users.role, 'admin'));
    const userExists = await db.select().from(schema.users).where(eq(schema.users.role, 'user'));

    if (adminExists.length === 0) {
      console.log('\nNo admin user found. Creating default admin...');
      await createUser('admin', 'admin123', 'admin');
    } else {
      console.log('\n✓ Admin user already exists.');
      console.log(`  To reset admin password, use: resetUserPassword('admin', 'newpassword')`);
    }

    if (userExists.length === 0) {
      console.log('\nNo regular user found. Creating default user...');
      await createUser('user', 'user123', 'user');
    } else {
      console.log('\n✓ Regular user already exists.');
      console.log(`  To reset user password, use: resetUserPassword('user', 'newpassword')`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log('\n📋 Your current users are listed above.');
    console.log('🔐 Default Credentials Created:');
    console.log('   ADMIN: username=admin, password=admin123');
    console.log('   USER:  username=user,  password=user123');
    console.log('\n⚠️  Remember to change these passwords after first login!\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
