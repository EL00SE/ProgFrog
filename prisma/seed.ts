import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
    },
  });

  await prisma.post.deleteMany({ where: { authorId: user.id } });
  await prisma.post.createMany({
    data: [
      {
        title: "Hello world",
        content: "First seeded post.",
        published: true,
        authorId: user.id,
      },
      {
        title: "Draft idea",
        content: "Not published yet.",
        published: false,
        authorId: user.id,
      },
    ],
  });

  console.log(`Seeded user ${user.email} with 2 posts.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
