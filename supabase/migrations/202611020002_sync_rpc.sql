begin;

create or replace function public.actualizar_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new."updatedAt" = now();
  new.version = old.version + 1;
  return new;
end;
$function$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'clientes_updated_at'
      and tgrelid = 'public.clientes'::regclass
      and not tgisinternal
  ) then
    create trigger clientes_updated_at
      before update on public.clientes
      for each row execute function public.actualizar_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'cotizaciones_updated_at'
      and tgrelid = 'public.cotizaciones'::regclass
      and not tgisinternal
  ) then
    create trigger cotizaciones_updated_at
      before update on public.cotizaciones
      for each row execute function public.actualizar_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'productos_updated_at'
      and tgrelid = 'public.productos'::regclass
      and not tgisinternal
  ) then
    create trigger productos_updated_at
      before update on public.productos
      for each row execute function public.actualizar_updated_at();
  end if;
end
$$;

create or replace function public.sync_upsert_record(
  p_table text,
  p_record jsonb,
  p_expected_version integer,
  p_assign_folio boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_id uuid;
  v_existing jsonb;
  v_payload jsonb;
  v_columns text;
  v_select_columns text;
  v_updates text;
  v_result jsonb;
  v_max_numero integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_table is null or p_table not in ('clientes', 'cotizaciones', 'items', 'productos') then
    raise exception 'Unsupported sync table: %', p_table using errcode = '22023';
  end if;

  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'A non-negative expected version is required' using errcode = '22023';
  end if;

  if p_record is null or p_record->>'id' is null then
    raise exception 'A UUID id is required for synchronization' using errcode = '22023';
  end if;

  v_id := (p_record->>'id')::uuid;
  v_payload := p_record - 'version' - 'remoteVersion' - 'syncedVersion'
    - 'syncExpectedVersion' - 'folioProvisional';
  v_payload := jsonb_set(v_payload, '{id}', to_jsonb(v_id), true);

  if p_table = 'cotizaciones' then
    lock table public.cotizaciones in share row exclusive mode;
    select greatest(coalesce(max(numero), 351), 351)
      into v_max_numero
      from public.cotizaciones;
    perform setval('public.cotizaciones_numero_seq'::regclass, v_max_numero, true);
  end if;

  execute format(
    'select to_jsonb(row_data) from public.%I as row_data where row_data.id = $1',
    p_table
  ) into v_existing using v_id;

  if v_existing is not null then
    if coalesce((v_existing->>'version')::integer, 1) <> p_expected_version then
      raise exception 'SYNC_CONFLICT: %:% expected version %, found %',
        p_table, v_id, p_expected_version, v_existing->>'version'
        using errcode = 'P0001';
    end if;
    if p_table = 'cotizaciones' and p_assign_folio then
      v_payload := v_payload - 'numero';
    end if;
  else
    if p_expected_version <> 0 then
      raise exception 'SYNC_CONFLICT: %:% no longer exists',
        p_table, v_id using errcode = 'P0001';
    end if;
    if p_table = 'cotizaciones' and p_assign_folio then
      v_payload := jsonb_set(
        v_payload,
        '{numero}',
        to_jsonb(nextval('public.cotizaciones_numero_seq'::regclass)),
        true
      );
    elsif p_table = 'cotizaciones' and v_payload ? 'numero' then
      perform setval(
        'public.cotizaciones_numero_seq'::regclass,
        greatest(v_max_numero, (v_payload->>'numero')::integer),
        true
      );
    end if;
  end if;

  select
    string_agg(format('%I', c.column_name), ', ' order by j.ordinality),
    string_agg(format('row_data.%I', c.column_name), ', ' order by j.ordinality),
    string_agg(
      format('%I = excluded.%I', c.column_name, c.column_name),
      ', ' order by j.ordinality
    ) filter (where c.column_name <> 'id')
  into v_columns, v_select_columns, v_updates
  from jsonb_object_keys(v_payload) with ordinality as j(column_name, ordinality)
  join information_schema.columns c
    on c.table_schema = 'public'
   and c.table_name = p_table
   and c.column_name = j.column_name
  where c.column_name <> 'version';

  if v_columns is null or v_select_columns is null then
    raise exception 'No recognized columns supplied for %', p_table using errcode = '22023';
  end if;

  if v_updates is null then
    v_updates := 'id = excluded.id';
  end if;

  execute format(
    'insert into public.%I as target (%s) ' ||
    'select %s from jsonb_populate_record(null::public.%I, $1) as row_data ' ||
    'on conflict (id) do update set %s ' ||
    'where target.version = $2 returning to_jsonb(target)',
    p_table, v_columns, v_select_columns, p_table, v_updates
  ) into v_result using v_payload, p_expected_version;

  if v_result is null then
    raise exception 'SYNC_CONFLICT: %:% changed during synchronization', p_table, v_id
      using errcode = 'P0001';
  end if;

  return v_result;
end;
$function$;

create or replace function public.sync_save_cotizacion(
  p_record jsonb,
  p_items jsonb,
  p_expected_version integer,
  p_assign_folio boolean
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_quote jsonb;
  v_item jsonb;
  v_synced_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_expected_item_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a JSON array' using errcode = '22023';
  end if;

  v_quote := public.sync_upsert_record(
    'cotizaciones', p_record, p_expected_version, p_assign_folio
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_expected_item_version := coalesce(
      (v_item->>'syncExpectedVersion')::integer, 0
    );
    v_synced_item := public.sync_upsert_record(
      'items',
      v_item - 'syncExpectedVersion',
      v_expected_item_version,
      false
    );
    v_items := v_items || jsonb_build_array(v_synced_item);
  end loop;

  return jsonb_build_object('cotizacion', v_quote, 'items', v_items);
end;
$function$;

revoke all on function public.sync_upsert_record(text, jsonb, integer, boolean) from public;
revoke all on function public.sync_save_cotizacion(jsonb, jsonb, integer, boolean) from public;
grant execute on function public.sync_upsert_record(text, jsonb, integer, boolean) to authenticated;
grant execute on function public.sync_save_cotizacion(jsonb, jsonb, integer, boolean) to authenticated;
grant usage, select, update on sequence public.cotizaciones_numero_seq to authenticated;

commit;
