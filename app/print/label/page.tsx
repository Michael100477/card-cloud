import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { PrintLabelClient } from "./PrintLabelClient";

export default async function PrintLabelPage({
  searchParams,
}: {
  searchParams: Promise<{ label_url?: string; tracking?: string }>;
}) {
  // Auth check — only admins can print labels.
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) redirect("/dashboard");
  const sp = await searchParams;
  return <PrintLabelClient labelUrl={sp.label_url ?? ""} tracking={sp.tracking ?? ""} />;
}
