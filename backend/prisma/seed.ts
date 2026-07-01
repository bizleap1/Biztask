import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Database...');

  // 1. Departments
  const devDept = await prisma.department.upsert({
    where: { name: 'Development' },
    update: {},
    create: { name: 'Development' },
  });

  const mediaDept = await prisma.department.upsert({
    where: { name: 'Media' },
    update: {},
    create: { name: 'Media' },
  });

  const salt = await bcrypt.genSalt(10);
  const password = await bcrypt.hash('password123', salt);

  // 2. SuperAdmin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@bizleap.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@bizleap.com',
      password,
      role: 'SuperAdmin',
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 3. Managers
  const devManager = await prisma.user.upsert({
    where: { email: 'devmanager@bizleap.com' },
    update: {},
    create: {
      name: 'Dev Manager',
      email: 'devmanager@bizleap.com',
      password,
      role: 'Manager',
      departmentId: devDept.id,
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 4. Employees
  const devEmp = await prisma.user.upsert({
    where: { email: 'devemp@bizleap.com' },
    update: {},
    create: {
      name: 'Dev Employee',
      email: 'devemp@bizleap.com',
      password,
      role: 'DevEmployee',
      departmentId: devDept.id,
      designation: 'Frontend Dev',
      isActive: true,
      mustChangePassword: false,
    },
  });

  const mediaEmp = await prisma.user.upsert({
    where: { email: 'mediaemp@bizleap.com' },
    update: {},
    create: {
      name: 'Media Employee',
      email: 'mediaemp@bizleap.com',
      password,
      role: 'MediaEmployee',
      departmentId: mediaDept.id,
      designation: 'Video Editor',
      isActive: true,
      mustChangePassword: false,
    },
  });

  // 5. Viewer
  const viewer = await prisma.user.upsert({
    where: { email: 'hr@bizleap.com' },
    update: {},
    create: {
      name: 'HR Viewer',
      email: 'hr@bizleap.com',
      password,
      role: 'Viewer',
      isActive: true,
      mustChangePassword: false,
    },
  });

  console.log('Seeding Complete!');
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
