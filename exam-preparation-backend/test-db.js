const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Testing user creation...");
    const user = await prisma.user.create({
      data: {
        fullName: "Test User 3",
        email: "test3@std.neu.edu.tr",
        passwordHash: "dummyhash",
      }
    });
    console.log("Success:", user);
    
    // Test finding course
    const course = await prisma.course.findFirst();
    console.log("Course found:", !!course);
    
  } catch (e) {
    console.error("Prisma Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
