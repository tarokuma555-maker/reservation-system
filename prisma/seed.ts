/** CLI から実行するときの入口。中身は src/lib/demo-seed.ts にある。 */
import { prisma } from "../src/lib/db";
import { seedDemoData } from "../src/lib/demo-seed";

seedDemoData()
  .then(async (summary) => {
    for (const line of summary) console.log(line);
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
