const { seq } = require('../config/db');

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0] || 'list';
  // optional params: tableName, columnName, namedIndex
  const tableName = args[1] || 'companies';
  const columnName = args[2] || 'email';
  const namedIndex = args[3] || `${tableName}_${columnName}_unique`;

  try {
    await seq.authenticate();

    if (cmd === 'list') {
      const [rows] = await seq.query(`SHOW INDEX FROM \`${tableName}\``);
      if (!rows || rows.length === 0) {
        console.log(`No indexes found on ${tableName} table`);
        return;
      }
      console.table(rows.map(r => ({
        Key_name: r.Key_name,
        Column_name: r.Column_name,
        Non_unique: r.Non_unique,
        Seq_in_index: r.Seq_in_index,
        Index_type: r.Index_type,
      })));

    } else if (cmd === 'drop') {
      const indexName = args[1];
      if (!indexName) {
        console.error('Usage: node scripts/manageIndexes.js drop <index_name>');
        process.exit(1);
      }
      console.log(`Dropping index ${indexName} from ${tableName}...`);
      await seq.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${indexName}\``);
      console.log('Dropped', indexName);

    } else if (cmd === 'cleanup') {
      console.log(`Checking for duplicate values in ${columnName} first...`);
      const [dups] = await seq.query(`SELECT \`${columnName}\`, COUNT(*) AS c FROM \`${tableName}\` GROUP BY \`${columnName}\` HAVING c>1`);
      if (dups && dups.length) {
        console.error(`Found duplicate ${columnName} values; cannot create unique index until duplicates are resolved. Sample duplicates:`);
        console.table(dups.slice(0, 20));
        process.exit(1);
      }

      const [rows] = await seq.query(`SHOW INDEX FROM \`${tableName}\``);
      const existingIndexNames = Array.from(new Set(rows.map(r => r.Key_name)));
      // Identify redundant indexes related to the column (like email, email_2, etc.)
      const redundantIndexes = existingIndexNames.filter(k => k !== 'PRIMARY' && k !== namedIndex && k.startsWith(columnName));
      if (!redundantIndexes.length) {
        console.log('No redundant column indexes to drop');
      } else {
        console.log('Dropping redundant column indexes first:', redundantIndexes.join(', '));
        for (const idx of redundantIndexes) {
          try {
            await seq.query(`ALTER TABLE \`${tableName}\` DROP INDEX \`${idx}\``);
            console.log('Dropped', idx);
          } catch (e) {
            console.error('Failed to drop', idx, e.message || e);
          }
        }
      }

      // Refresh index list and create the named unique index if missing
      const [rowsAfter] = await seq.query(`SHOW INDEX FROM \`${tableName}\``);
      const hasNamedAfter = rowsAfter.some(r => r.Key_name === namedIndex);
      if (!hasNamedAfter) {
        console.log(`Creating named unique index ${namedIndex}...`);
        await seq.query(`ALTER TABLE \`${tableName}\` ADD UNIQUE INDEX \`${namedIndex}\` (\`${columnName}\`)`);
        console.log('Created', namedIndex);
      } else {
        console.log('Named index', namedIndex, 'already exists');
      }

    } else {
      console.error('Unknown command. Use `list`, `drop` or `cleanup`.');
    }
  } catch (err) {
    console.error('Error managing indexes:', err.message || err);
    process.exit(1);
  } finally {
    try { await seq.close(); } catch (e) {}
  }
}

main();
