begin;

alter table public.cotizaciones
  add column if not exists cliente_id uuid;

alter table public.items
  add column if not exists producto_id uuid,
  add column if not exists "createdAt" timestamptz not null default now(),
  add column if not exists "updatedAt" timestamptz not null default now();

alter table public.clientes
  add column if not exists version integer not null default 1,
  add column if not exists "deletedAt" timestamptz;

alter table public.cotizaciones
  add column if not exists version integer not null default 1,
  add column if not exists "deletedAt" timestamptz;

alter table public.items
  add column if not exists version integer not null default 1,
  add column if not exists "deletedAt" timestamptz;

alter table public.productos
  add column if not exists version integer not null default 1,
  add column if not exists "deletedAt" timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cotizaciones_cliente_id_fkey'
      and conrelid = 'public.cotizaciones'::regclass
  ) then
    alter table public.cotizaciones
      add constraint cotizaciones_cliente_id_fkey
      foreign key (cliente_id)
      references public.clientes (id)
      on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'items_producto_id_fkey'
      and conrelid = 'public.items'::regclass
  ) then
    alter table public.items
      add constraint items_producto_id_fkey
      foreign key (producto_id)
      references public.productos (id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_cotizaciones_cliente_id
  on public.cotizaciones (cliente_id);

create index if not exists idx_items_producto_id
  on public.items (producto_id);

create index if not exists idx_clientes_updated_at
  on public.clientes ("updatedAt");

create index if not exists idx_cotizaciones_updated_at
  on public.cotizaciones ("updatedAt");

create index if not exists idx_items_updated_at
  on public.items ("updatedAt");

create index if not exists idx_productos_updated_at
  on public.productos ("updatedAt");

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
    select 1
    from pg_trigger
    where tgname = 'items_updated_at'
      and tgrelid = 'public.items'::regclass
      and not tgisinternal
  ) then
    create trigger items_updated_at
      before update on public.items
      for each row
      execute function public.actualizar_updated_at();
  end if;
end
$$;

grant usage on schema public to authenticated;

grant select, insert, update, delete on table
  public.clientes,
  public.cotizaciones,
  public.items,
  public.productos
to authenticated;

grant usage, select on sequence public.cotizaciones_numero_seq to authenticated;

alter table public.clientes enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.items enable row level security;
alter table public.productos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'clientes'
      and policyname = 'authenticated_shared_access'
  ) then
    create policy authenticated_shared_access
      on public.clientes
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'cotizaciones'
      and policyname = 'authenticated_shared_access'
  ) then
    create policy authenticated_shared_access
      on public.cotizaciones
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'items'
      and policyname = 'authenticated_shared_access'
  ) then
    create policy authenticated_shared_access
      on public.items
      for all
      to authenticated
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'productos'
      and policyname = 'authenticated_shared_access'
  ) then
    create policy authenticated_shared_access
      on public.productos
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end
$$;

commit;
