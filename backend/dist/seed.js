"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
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
