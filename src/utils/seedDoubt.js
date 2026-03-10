// import { PrismaClient } from '@prisma/client';
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedDoubt() {
  // 1. Find any existing user
  const user = await prisma.user.findFirst();

  if (!user) {
    console.log('No users found! Please create a user first.');
    return;
  }

  // 2. Create the doubt linked to that user
  const newDoubt = await prisma.doubt.create({
    data: {
      user_id: user.id,
      title: "Confused about Newton's Third Law in circular motion",
      description: "Does the centripetal force have a reaction pair? If so, what is it and where does it act? Need help for upcoming mock test.",
      subject: "Physics",
      upvotes: 12,
      is_resolved: false,
    }
  });

  console.log('Doubt created successfully:', newDoubt);
}

seedDoubt()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());