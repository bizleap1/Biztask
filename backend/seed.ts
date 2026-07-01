import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const dev = await prisma.department.upsert({
    where: { name: 'Development' },
    update: {},
    create: { name: 'Development' },
  });

  const media = await prisma.department.upsert({
    where: { name: 'Media' },
    update: {},
    create: { name: 'Media' },
  });

  console.log('Departments seeded:', dev.name, media.name);
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
