insert into public.categorias (codigo, nombre, tipo, activo)
values ('CHATGPT', 'ChatGPT', 'origen', true)
on conflict (codigo) do update
set nombre = excluded.nombre,
    tipo = excluded.tipo,
    activo = true;
