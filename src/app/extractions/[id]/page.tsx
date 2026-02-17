import { notFound, redirect } from "next/navigation";

import { ExtractionStatusClient } from "@/app/extractions/[id]/ExtractionStatusClient";
import { getExtractionForUser } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ExtractionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const extraction = await getExtractionForUser(user.id, id);
  if (!extraction) {
    notFound();
  }

  return <ExtractionStatusClient extractionId={id} initialExtraction={extraction} />;
}
