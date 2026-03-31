import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import AnchorStudio from "../../components/AnchorStudio";

export default async function AnchorStudioPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <main>
      <AnchorStudio />
    </main>
  );
}
