import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Clear operational history without touching accounts, channels, Buffer
 * tokens, posting-time preferences, or Cloudinary credentials.
 *
 * Run with: npm run db:reset-activity
 */
async function main() {
  const [publishes, voices, runs, times] = await prisma.$transaction([
    prisma.voicePublish.deleteMany({}),
    prisma.voice.deleteMany({}),
    prisma.queueRun.deleteMany({}),
    prisma.channelPostingTime.deleteMany({}),
  ]);

  console.log(
    [
      "Activity reset complete.",
      `Removed ${voices.count} voice(s), ${publishes.count} publish result(s),`,
      `${runs.count} queue run(s), and ${times.count} saved posting time(s).`,
      "Accounts, channels, Buffer tokens, and Cloudinary credentials were kept.",
    ].join(" "),
  );
}

main()
  .catch((error) => {
    console.error("Activity reset failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
