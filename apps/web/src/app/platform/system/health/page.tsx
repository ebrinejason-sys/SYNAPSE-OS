import { redirect } from "next/navigation";

export default function SystemHealthPage() {
  redirect("/platform/health");
}
