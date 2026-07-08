"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting Production Database Seeding...');
    // 1. Ensure basic departments exist
    await prisma.department.upsert({
        where: { name: 'Management' },
        update: {},
        create: { name: 'Management' },
    });
    await prisma.department.upsert({
        where: { name: 'Development' },
        update: {},
        create: { name: 'Development' },
    });
    await prisma.department.upsert({
        where: { name: 'Media' },
        update: {},
        create: { name: 'Media' },
    });
    const mgmtDept = await prisma.department.findUnique({ where: { name: 'Management' } });
    // 2. Safely Seed SuperAdmin
    const existingSuperAdmin = await prisma.user.findFirst({
        where: { role: 'SuperAdmin' }
    });
    if (existingSuperAdmin) {
        console.log('SuperAdmin already exists. Skipping seed.');
    }
    else {
        const adminName = process.env.SUPER_ADMIN_NAME;
        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
        const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
        if (!adminName || !adminEmail || !adminPassword) {
            console.error('ERROR: Missing SUPER_ADMIN_* environment variables.');
            process.exit(1);
        }
        const salt = await bcryptjs_1.default.genSalt(10);
        const hashedPassword = await bcryptjs_1.default.hash(adminPassword, salt);
        await prisma.user.create({
            data: {
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                role: 'SuperAdmin',
                departmentId: mgmtDept?.id,
                isActive: true,
                mustChangePassword: false,
            },
        });
        console.log('SuperAdmin created successfully.');
    }
    console.log('Seeding Complete!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
