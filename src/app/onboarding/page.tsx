import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Onboarding from "../../components/Onboarding";

export default async function OnboardingPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // If already onboarded, go to main app
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isOnboarded: true },
  });

  if (user?.isOnboarded) {
    redirect("/");
  }

  return (
    <main>
      <Onboarding />
    </main>
  );
}
