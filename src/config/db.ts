// src/config/db.ts

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

// Initialize the standard PostgreSQL connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Wrap the pool in the Prisma adapter
const adapter = new PrismaPg(pool);

// Instantiate Prisma Client using the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;