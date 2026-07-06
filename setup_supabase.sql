-- Copia y pega esto en el SQL Editor de Supabase (menú izquierdo) y dale a RUN

-- 1. Crear la tabla de aventuras
create table public.adventures (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  descripcion text,
  urls text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Desactivar RLS temporalmente para simplificar la app (ya que no usamos login)
alter table public.adventures disable row level security;

-- 3. Crear el bucket de storage si no lo creaste
insert into storage.buckets (id, name, public) 
values ('album_photos', 'album_photos', true)
on conflict (id) do nothing;

-- 4. Desactivar políticas restrictivas del storage (permite subir y borrar a cualquiera)
create policy "Public Access"
on storage.objects for all
using ( bucket_id = 'album_photos' );
