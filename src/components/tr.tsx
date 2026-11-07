/**
 * 勤怠入力画面の日本語に、英語・ポルトガル語（ブラジル）の訳を小さく添える。
 * 訳はここの辞書にまとめ、同じ言葉はどこでも同じ訳になるようにする。
 */
const DICT = {
  勤怠入力: { en: "Time clock", pt: "Ponto" },
  出勤: { en: "Clock in", pt: "Entrada" },
  退勤: { en: "Clock out", pt: "Saída" },
  出勤の記録: { en: "Clock in", pt: "Registrar entrada" },
  退勤の記録: { en: "Clock out", pt: "Registrar saída" },
  出勤日: { en: "Date", pt: "Data" },
  出勤時刻: { en: "Time", pt: "Hora" },
  退勤日: { en: "Date", pt: "Data" },
  退勤時刻: { en: "Time", pt: "Hora" },
  退勤する記録: { en: "Which record", pt: "Qual registro" },
  "備考（任意）": { en: "Note (optional)", pt: "Observação (opcional)" },
  保存: { en: "Save", pt: "Salvar" },
  退勤を保存: { en: "Save", pt: "Salvar" },
  "保存中…": { en: "Saving…", pt: "Salvando…" },
  キャンセル: { en: "Cancel", pt: "Cancelar" },
  名前選択に戻る: { en: "Back to names", pt: "Voltar aos nomes" },
  ホームに戻る: { en: "Home", pt: "Início" },
  名前を検索: { en: "Search name", pt: "Buscar nome" },
  選択中: { en: "Selected", pt: "Selecionado" },
  名前を変更: { en: "Change", pt: "Trocar" },
  選択を解除: { en: "Clear", pt: "Limpar" },
  閉じる: { en: "Close", pt: "Fechar" },
  退勤待ち: { en: "Not clocked out", pt: "Sem saída" },
  実働: { en: "Worked", pt: "Trabalhado" },
  勤務日: { en: "Work date", pt: "Dia de trabalho" },
  本日の記録: { en: "Today's records", pt: "Registros de hoje" },
  記録なし: { en: "No records yet", pt: "Nenhum registro ainda" },
  名前を選ぶ: { en: "Choose your name", pt: "Escolha seu nome" },
} as const;

export type TrKey = keyof typeof DICT;

/** 訳だけ（「Clock in / Entrada」）を小さく出す。日本語は呼び出し側で書く場合に使う。 */
export function TrSub({ k, className }: { k: TrKey; className?: string }) {
  const t = DICT[k];
  return (
    <span className={className ?? "text-[0.8em] font-normal opacity-75"}>
      <span lang="en">{t.en}</span>
      <span aria-hidden="true"> / </span>
      <span lang="pt-BR">{t.pt}</span>
    </span>
  );
}

/**
 * 日本語＋訳。
 * - stack: 日本語の下に訳（ボタン・入力欄のラベル向け）
 * - inline: 日本語の右に訳（見出し・短い文向け）
 */
export function Tr({
  k,
  layout = "stack",
  ja,
}: {
  k: TrKey;
  layout?: "stack" | "inline";
  /** 表示する日本語（省略時は辞書のキー）。 */
  ja?: string;
}) {
  if (layout === "inline") {
    return (
      <span>
        {ja ?? k} <TrSub k={k} />
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span>{ja ?? k}</span>
      <TrSub k={k} />
    </span>
  );
}
