import * as dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const depts = await prisma.department.findMany();
  console.log('Departments:', JSON.stringify(depts, null, 2));

  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, departmentId: true } });
  console.log('Users:', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
