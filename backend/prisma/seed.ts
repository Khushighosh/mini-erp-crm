import { PrismaClient, Role, CustomerType, CustomerStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);

  const roles: Role[] = ['ADMIN', 'SALES', 'WAREHOUSE', 'ACCOUNTS'];
  for (const role of roles) {
    await prisma.user.upsert({
      where: { email: `${role.toLowerCase()}@test.com` },
      update: {},
      create: {
        name: `${role} User`,
        email: `${role.toLowerCase()}@test.com`,
        passwordHash: password,
        role,
      },
    });
  }

  const customer1 = await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    update: {},
    create: {
      id: 'seed-customer-1',
      name: 'Ramesh Traders',
      mobile: '9876543210',
      email: 'ramesh@example.com',
      businessName: 'Ramesh Traders Pvt Ltd',
      type: CustomerType.WHOLESALE,
      status: CustomerStatus.ACTIVE,
      address: 'MG Road, Bengaluru',
    },
  });

  const customer2 = await prisma.customer.upsert({
    where: { id: 'seed-customer-2' },
    update: {},
    create: {
      id: 'seed-customer-2',
      name: 'Priya Retail',
      mobile: '9123456780',
      type: CustomerType.RETAIL,
      status: CustomerStatus.LEAD,
    },
  });

  const product1 = await prisma.product.upsert({
    where: { sku: 'SKU-001' },
    update: {},
    create: {
      name: 'Steel Rod 10mm',
      sku: 'SKU-001',
      category: 'Hardware',
      unitPrice: 450.0,
      currentStock: 100,
      minStockAlert: 10,
      location: 'Warehouse A',
    },
  });

  const product2 = await prisma.product.upsert({
    where: { sku: 'SKU-002' },
    update: {},
    create: {
      name: 'Cement Bag 50kg',
      sku: 'SKU-002',
      category: 'Construction',
      unitPrice: 380.0,
      currentStock: 200,
      minStockAlert: 20,
      location: 'Warehouse B',
    },
  });

  console.log('Seed complete:', { customer1: customer1.id, customer2: customer2.id, product1: product1.id, product2: product2.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });