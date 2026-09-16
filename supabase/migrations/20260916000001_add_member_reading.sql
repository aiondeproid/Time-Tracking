-- members に読み仮名（ひらがな）を追加
-- 勤怠入力の名前検索で、漢字を打たなくてもひらがな/カタカナ/ローマ字から
-- 候補を絞り込めるようにするための補助カラム。
-- 未設定（空文字）でも従来どおり名前そのものでの検索は機能する。

alter table public.members
  add column if not exists reading text not null default '';
