"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.user.updateMany({
        where: { role: 'DevEmployee' },
        data: { departmentId: 1 }
    });
    await prisma.user.updateMany({
        where: { role: 'MediaEmployee' },
        data: { departmentId: 2 }
    });
    console.log('Fixed department IDs for employees');
}
main().finally(() => prisma.$disconnect());
