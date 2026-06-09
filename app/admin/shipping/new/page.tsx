import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { StandaloneLabelClient } from "./StandaloneLabelClient";

export default async function NewLabelPage() {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) redirect("/dashboard");
  return <StandaloneLabelClient />;
}
