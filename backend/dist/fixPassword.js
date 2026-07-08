"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function run() {
    const salt = await bcryptjs_1.default.genSalt(10);
    const password = await bcryptjs_1.default.hash('password123', salt);
    await prisma.user.update({
        where: { email: 'admin@bizleap.com' },
        data: { password }
    });
    console.log('Password updated successfully!');
}
run()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
