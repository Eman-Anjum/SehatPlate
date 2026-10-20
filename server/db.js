import pkg from 'pg';
const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL is not set. Add it in the Secrets panel.');
  process.exit(1);
}

const urlScheme = process.env.DATABASE_URL.split(':')[0];
if (urlScheme !== 'postgresql' && urlScheme !== 'postgres') {
  console.error(`Unsupported database scheme: ${urlScheme}. Expected postgres:// or postgresql://.`);
  process.exit(1);
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
