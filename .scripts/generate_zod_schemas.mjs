//@ts-check
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PrismaFileParser } from './dev/prisma_parser.mjs';

const inputFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'prisma', 'schema.prisma');

console.log("Generating Zod schemas from:", inputFile);

const fileContent = await fs.readFile(inputFile, { flag: 'r', encoding : 'utf-8' });

let parser = new PrismaFileParser(fileContent);

let parsed = parser.parse();
console.log('Parsed:', parsed.models,);