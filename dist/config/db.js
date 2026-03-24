"use strict";
// src/config/db.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const pg_1 = require("pg");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Initialize the standard PostgreSQL connection pool
const pool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
// Wrap the pool in the Prisma adapter
const adapter = new adapter_pg_1.PrismaPg(pool);
// Instantiate Prisma Client using the adapter
const prisma = new client_1.PrismaClient({ adapter });
exports.default = prisma;
