import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function run() {
  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('password123', salt);
  await prisma.user.update({
    where: { email: 'admin@bizleap.com' },
    data: { password }
  });
  console.log('Password updated successfully!');
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
