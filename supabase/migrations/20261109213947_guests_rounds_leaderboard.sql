-- WordFall online: guest players, the rounds they finished, and the leaderboard.
--
-- There are no accounts. Each browser makes itself a long random secret token and sends it with
-- its rounds; the database keeps only the token's SHA-256, so reading this table gives nobody a
-- way to play as someone else. The browser cannot touch the tables: everything goes through the
-- two functions below.

-- Guests: one per secret token, with the name the leaderboard shows.
create table public.players (
  id bigint generated always as identity primary key,
  token_hash bytea not null unique,
  name text not null check (char_length(name) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Finished 2-minute rounds.
create table public.rounds (
  id bigint generated always as identity primary key,
  player_id bigint not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('solo', 'bot')),
  lang text not null check (lang in ('en', 'ru')),
  score integer not null check (score >= 0),
  -- The bot's score, in a round against it.
  bot_score integer check (bot_score is null or bot_score >= 0),
  -- The words found: [{"w": "word", "m": multiplier}, ...].
  words jsonb not null,
  played_at timestamptz not null default now(),
  check ((kind = 'bot') = (bot_score is not null))
);

create index rounds_board on public.rounds (lang, kind, score desc);
create index rounds_by_player on public.rounds (player_id, played_at desc);

-- No policies and no grants: the API roles reach the tables only through the functions.
alter table public.players enable row level security;
alter table public.rounds enable row level security;
revoke all on public.players, public.rounds from anon, authenticated;

/**
 * Saves a finished round for the guest with this secret token (their first round makes them a
 * player) under this name, and returns the round's score.
 *
 * The score is not taken from the browser: it is worked out here from the words, 100 points a
 * letter times the word's multiplier (1, or 2 for each ×2 tile in it), as in src/core/scoring.ts.
 * A round lasts 2 minutes, so a player can save at most one every 110 seconds.
 */
create function public.submit_round(
  p_token text,
  p_name text,
  p_kind text,
  p_lang text,
  p_words jsonb,
  p_bot_score integer default null
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_letters text := case p_lang when 'ru' then '^[а-я]{3,30}$' else '^[a-z]{3,30}$' end;
  v_name text;
  v_player bigint;
  v_count integer;
  v_distinct integer;
  v_bad integer;
  v_score integer;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{32,128}$' then
    raise exception 'bad token' using errcode = '28000';
  end if;
  if p_kind is null or p_kind not in ('solo', 'bot')
     or p_lang is null or p_lang not in ('en', 'ru') then
    raise exception 'unknown kind or language' using errcode = '22023';
  end if;
  if (p_kind = 'bot') <> (p_bot_score is not null)
     or p_bot_score < 0 or p_bot_score % 100 <> 0 then
    raise exception 'bad bot score' using errcode = '22023';
  end if;
  if p_words is null or jsonb_typeof(p_words) <> 'array' or jsonb_array_length(p_words) > 120 then
    raise exception 'bad word list' using errcode = '22023';
  end if;

  select
    count(*),
    count(distinct item ->> 'w'),
    count(*) filter (
      where jsonb_typeof(item -> 'w') is distinct from 'string'
         or (item ->> 'w') !~ v_letters
         or (item ->> 'm') is null
         or (item ->> 'm') !~ '^[0-9]{1,3}$'
         -- 1 with no ×2 tile, else 2 for each ×2 tile, of which a word has at most its length.
         or not (
           (item ->> 'm')::integer = 1
           or ((item ->> 'm')::integer % 2 = 0
               and (item ->> 'm')::integer between 2 and 2 * char_length(item ->> 'w'))
         )
    )
  into v_count, v_distinct, v_bad
  from jsonb_array_elements(p_words) as item;

  -- A word scores once a round.
  if v_bad > 0 or v_distinct <> v_count then
    raise exception 'bad word list' using errcode = '22023';
  end if;

  select coalesce(sum(char_length(item ->> 'w') * 100 * (item ->> 'm')::integer), 0)
  into v_score
  from jsonb_array_elements(p_words) as item;

  -- The name: one line, no control characters, at most 24 characters; "Guest" if nothing is left.
  v_name := left(
    btrim(regexp_replace(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]]', '', 'g'), '\s+', ' ', 'g')),
    24
  );
  v_name := btrim(v_name);
  if v_name = '' then
    v_name := 'Guest';
  end if;

  insert into public.players (token_hash, name)
  values (sha256(convert_to(p_token, 'UTF8')), v_name)
  on conflict (token_hash) do update set name = excluded.name, updated_at = now()
  returning id into v_player;

  -- One save at a time per player, so two at once cannot both pass the check below.
  perform pg_advisory_xact_lock(v_player);
  if exists (
    select 1 from public.rounds
    where player_id = v_player and played_at > now() - interval '110 seconds'
  ) then
    raise exception 'too soon after the last round' using errcode = '54000';
  end if;

  insert into public.rounds (player_id, kind, lang, score, bot_score, words)
  values (v_player, p_kind, p_lang, v_score, p_bot_score, p_words);
  return v_score;
end;
$$;

/**
 * The best score of each player in one language and mode, highest first; is_me marks the guest
 * whose secret token is given. It gives out names and scores only.
 */
create function public.leaderboard(
  p_lang text,
  p_kind text,
  p_token text default null,
  p_limit integer default 20
)
returns table (rank bigint, name text, score integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rank() over (order by best.score desc),
    p.name,
    best.score,
    coalesce(p.token_hash = sha256(convert_to(p_token, 'UTF8')), false)
  from (
    select r.player_id, max(r.score) as score
    from public.rounds r
    where r.lang = p_lang and r.kind = p_kind
    group by r.player_id
  ) best
  join public.players p on p.id = best.player_id
  order by best.score desc, p.name
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke all on function public.submit_round(text, text, text, text, jsonb, integer) from public;
grant execute on function public.submit_round(text, text, text, text, jsonb, integer)
  to anon, authenticated;
revoke all on function public.leaderboard(text, text, text, integer) from public;
grant execute on function public.leaderboard(text, text, text, integer) to anon, authenticated;
