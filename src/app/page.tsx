import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import MainScreen from "../components/MainScreen";
import LandingPage from "../components/LandingPage";

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOnboarded: true, displayName: true },
  });

  if (!user || !user.isOnboarded) {
    redirect("/onboarding");
  }

  return (
    <main>
      <MainScreen userName={user.displayName || "Guest"} />
    </main>
  );
}
