import { redirect } from "next/navigation";

export default async function ClinicalIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/os/${encodeURIComponent(slug)}/clinical/queue`);
}
