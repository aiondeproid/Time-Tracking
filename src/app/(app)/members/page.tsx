import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getSessionUser } from "@/lib/auth";
import { fetchAllMembers } from "@/lib/attendance";

import { MemberAdmin } from "./member-admin";

export const metadata: Metadata = { title: "名前の管理 | 勤怠管理" };

export default async function MembersPage() {
  // 外周はサイト共通合言葉ゲート（proxy）。ここではログイン必須（多層防御）。
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/members");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight">名前の管理</h1>
      <MemberAdmin members={await fetchAllMembers()} userEmail={user.email} />
    </main>
  );
}
