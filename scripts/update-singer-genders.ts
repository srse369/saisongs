/**
 * Script to manually update singer genders with user input
 * Usage: npx tsx scripts/update-singer-genders.ts
 */

// @ts-ignore - oracledb doesn't have types
import oracledb from 'oracledb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as readline from 'readline';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

/**
 * Prompt user for gender input
 */
async function promptForGender(rl: readline.Interface, name: string): Promise<'Male' | 'Female' | 'Boy' | 'Girl' | 'Other' | 'skip'> {
  return new Promise((resolve) => {
    rl.question(`\n👤 ${name}\n   Gender? (M=Male, F=Female, B=Boy, G=Girl, O=Other, S=Skip): `, (answer) => {
      const input = answer.trim().toUpperCase();
      switch (input) {
        case 'M': resolve('Male'); break;
        case 'F': resolve('Female'); break;
        case 'B': resolve('Boy'); break;
        case 'G': resolve('Girl'); break;
        case 'O': resolve('Other'); break;
        case 'S': resolve('skip'); break;
        default:
          console.log('   ❌ Invalid input. Please enter M, F, B, G, O, or S.');
          resolve(promptForGender(rl, name));
      }
    });
  });
}

async function updateSingerGenders() {
  let connection: oracledb.Connection | undefined;

  try {
    console.log('🔗 Connecting to Oracle database...');
    
    const config: oracledb.ConnectionAttributes = {
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECT_STRING,
      walletLocation: process.env.ORACLE_WALLET_DIR,
      walletPassword: process.env.ORACLE_WALLET_PASSWORD || '',
    };

    connection = await oracledb.getConnection(config);
    console.log('✅ Connected to database\n');

    // Fetch all singers without gender
    console.log('📋 Fetching singers without gender...');
    const result = await connection.execute<[Buffer, string, string | null]>(
      `SELECT id, name, gender FROM singers ORDER BY name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_ARRAY }
    );

    if (!result.rows || result.rows.length === 0) {
      console.log('No singers found in database.');
      return;
    }

    console.log(`Found ${result.rows.length} singers total\n`);

    let updateCount = 0;
    let skipCount = 0;

    // Create readline interface for prompts
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log('🔍 Please provide gender for each singer:\n');
    console.log('Options: M=Male, F=Female, B=Boy, G=Girl, O=Other, S=Skip\n');
    console.log('Each selection is saved immediately to the database.\n');
    console.log('─'.repeat(60));

    // Process each singer
    for (const row of result.rows) {
      const [id, name, currentGender] = row;
      
      // Skip if already has gender
      if (currentGender) {
        console.log(`\n👤 ${name}`);
        console.log(`   ⊘ Already has gender: ${currentGender}`);
        skipCount++;
        continue;
      }

      const inferredGender = await promptForGender(rl, name);
      
      if (inferredGender === 'skip') {
        console.log(`   ⊘ Skipped`);
        skipCount++;
      } else {
        // Immediately update and commit
        try {
          await connection.execute(
            `UPDATE singers SET gender = :gender WHERE id = :id`,
            { gender: inferredGender, id },
            { autoCommit: true }
          );
          console.log(`   ✓ Saved: ${inferredGender}`);
          updateCount++;
        } catch (error) {
          console.error(`   ❌ Failed to save: ${error}`);
          skipCount++;
        }
      }
    }

    rl.close();
    console.log('\n' + '─'.repeat(60));

    // Display final summary
    console.log('📊 Final Summary:');
    console.log(`   ✓ Updated: ${updateCount}`);
    console.log(`   ⊘ Skipped: ${skipCount}`);
    console.log(`\n✅ Complete! All changes have been saved to the database.\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      try {
        await connection.close();
        console.log('🔌 Database connection closed');
      } catch (error) {
        console.error('Error closing connection:', error);
      }
    }
  }
}

// Run the script
updateSingerGenders().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
