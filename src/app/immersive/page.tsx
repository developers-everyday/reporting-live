import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import ImmersivePlayer from "../../components/ImmersivePlayer";

export default async function ImmersivePage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main>
      <ImmersivePlayer />
    </main>
  );
}
