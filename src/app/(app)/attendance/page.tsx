import Link from "next/link";
import type { Metadata } from "next";

import {
  fetchActiveMembers,
  fetchInputRows,
  fetchMemberById,
} from "@/lib/attendance";
import { describeRow } from "@/lib/attendance-view";
import { resolveWorkDate, weekdayJa } from "@/lib/time";

import { ClockPanel } from "./clock-panel";
import { TrSub } from "@/components/tr";

import { BackToPickerButton, HomeButton } from "./home-button";
import { MemberPicker } from "./member-picker";
import { NowClock } from "./now-clock";
import { RecordList } from "./record-list";

export const metadata: Metadata = { title: "勤怠入力 | 勤怠管理" };

export default async function AttendancePage(props: PageProps<"/attendance">) {
  const sp = await props.searchParams;
  const memberId = typeof sp.member === "string" ? sp.member : undefined;

  const members = await fetchActiveMembers();
  let selected = memberId
    ? (members.find((m) => m.id === memberId) ?? null)
    : null;
  // アクティブ一覧に無い ID（アーカイブ済み等）でも、指定があれば表示は許可する
  if (memberId && !selected) selected = await fetchMemberById(memberId);

  const todayWorkDate = resolveWorkDate(new Date());
  const rows = selected ? await fetchInputRows(selected.id, todayWorkDate) : [];
  const views = rows.map(describeRow);
  const openViews = views.filter((v) => v.isOpen);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold tracking-tight">
            勤怠入力
            <TrSub k="勤怠入力" className="ml-2 text-sm font-normal text-zinc-500" />
          </h1>
          <NowClock />
        </div>
        {selected && (
          <div className="flex flex-wrap gap-2">
            <BackToPickerButton />
            <HomeButton />
          </div>
        )}
      </div>

      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/20">
          アクティブなメンバーがいません。
          <Link href="/members" className="underline underline-offset-2">
            名前の管理
          </Link>
          から追加してください。
        </p>
      ) : (
        <>
          <MemberPicker
            members={members}
            selectedId={selected?.id ?? null}
            selectedName={selected?.name ?? null}
          />

          {selected ? (
            <>
              <ClockPanel
                memberId={selected.id}
                memberName={selected.name}
                todayWorkDate={todayWorkDate}
                openRows={openViews}
              />

              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
                  本日（{todayWorkDate}・{weekdayJa(todayWorkDate)}）の記録と退勤待ち
                  <TrSub k="本日の記録" className="block text-xs font-normal opacity-75" />
                </h2>
                <RecordList rows={views} />
              </section>

              <div className="flex flex-wrap justify-center gap-3">
                <BackToPickerButton />
                <HomeButton />
              </div>
            </>
          ) : (
            <p className="rounded-lg border border-dashed border-black/15 px-4 py-8 text-center text-sm text-zinc-500 dark:border-white/20">
              上で名前を選ぶと、出勤・退勤の記録ができます。
              <br />
              <TrSub k="名前を選ぶ" />
            </p>
          )}
        </>
      )}
    </main>
  );
}
