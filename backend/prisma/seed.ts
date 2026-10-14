import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const samples = [
  { slug: "sample-escape-room", name: "Escape room challenge", description: "A timed indoor puzzle adventure where a small team solves clues and works together to escape a themed room.", category: "Puzzle", tags: ["teamwork", "puzzle", "adventure", "indoor"], priceMin: 500, priceMax: 1200, durationMins: 90, setting: "INDOOR" as const, intensity: "LOW" as const, adventureLevel: 4, socialLevel: 4 },
  { slug: "sample-pottery-workshop", name: "Pottery workshop", description: "A guided hands-on pottery session focused on making something creative together in a relaxed social studio.", category: "Creative", tags: ["creative", "craft", "social", "indoor", "relaxed"], priceMin: 700, priceMax: 1600, durationMins: 120, setting: "INDOOR" as const, intensity: "LOW" as const, adventureLevel: 2, socialLevel: 4 },
  { slug: "sample-go-karting", name: "Go-karting session", description: "A friendly competitive kart racing session for groups that enjoy speed, shared excitement, and a little rivalry.", category: "Adventure", tags: ["adventure", "competition", "speed", "social"], priceMin: 800, priceMax: 2000, durationMins: 90, setting: "OUTDOOR" as const, intensity: "MODERATE" as const, adventureLevel: 5, socialLevel: 3 },
  { slug: "sample-cooking-class", name: "Group cooking class", description: "Learn a new cuisine with a hands-on instructor-led cooking session and share the meal you make as a group.", category: "Food", tags: ["creative", "food", "social", "learning", "indoor"], priceMin: 900, priceMax: 2200, durationMins: 150, setting: "INDOOR" as const, intensity: "LOW" as const, adventureLevel: 2, socialLevel: 5 },
  { slug: "sample-guided-hike", name: "Guided nature hike", description: "A guided trail walk with scenic viewpoints and time outdoors. Check the actual route and conditions before booking.", category: "Outdoors", tags: ["nature", "outdoors", "adventure", "walking"], priceMin: 0, priceMax: 900, durationMins: 240, setting: "OUTDOOR" as const, intensity: "HIGH" as const, adventureLevel: 4, socialLevel: 3 },
  { slug: "sample-board-game-cafe", name: "Board game cafe visit", description: "Spend a relaxed few hours choosing tabletop games, learning the rules, and playing together over snacks.", category: "Games", tags: ["games", "social", "relaxed", "indoor", "strategy"], priceMin: 300, priceMax: 900, durationMins: 180, setting: "INDOOR" as const, intensity: "LOW" as const, adventureLevel: 1, socialLevel: 5 },
  { slug: "sample-cycling-tour", name: "City cycling outing", description: "Explore a route together by bicycle, with breaks along the way. Route, rentals, and safety conditions need local verification.", category: "Outdoors", tags: ["cycling", "outdoors", "adventure", "active"], priceMin: 200, priceMax: 1000, durationMins: 180, setting: "OUTDOOR" as const, intensity: "MODERATE" as const, adventureLevel: 3, socialLevel: 3 },
  { slug: "sample-painting-class", name: "Collaborative painting class", description: "A beginner-friendly guided painting session where friends try a creative activity and make their own artwork.", category: "Creative", tags: ["creative", "art", "social", "indoor", "relaxed"], priceMin: 600, priceMax: 1500, durationMins: 120, setting: "INDOOR" as const, intensity: "LOW" as const, adventureLevel: 2, socialLevel: 4 },
];

async function main() {
  for (const sample of samples) {
    await prisma.experience.upsert({
      where: { slug: sample.slug },
      create: { ...sample, source: "development-sample", isSample: true, lastVerifiedAt: null },
      update: { ...sample, source: "development-sample", isSample: true, lastVerifiedAt: null },
    });
  }
  console.log(`Seeded ${samples.length} clearly labeled sample activity concepts.`);
}

main().finally(() => prisma.$disconnect());
