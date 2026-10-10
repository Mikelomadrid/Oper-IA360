-- Regla técnica validada por OrkaLED para líneas de fuerza de cocina.

update public.sistemas_rendimiento
set descripcion = 'Ejecución de línea eléctrica nueva de fuerza desde el cuadro, con canalización, protección, conexionado, identificación y pruebas. Para vitrocerámica sola se utilizarán conductores de 4 mm²; cuando vitrocerámica y horno compartan la misma línea, se utilizarán conductores de 6 mm². Si el horno va separado, dispondrá de su propia línea independiente con la sección adecuada. Las líneas de lavadora, lavavajillas y usos varios húmedos se ejecutarán con la sección y protección correspondientes.',
    origen = 'manual_validado',
    estado = 'validado',
    version = greatest(coalesce(version, 1), 1) + 1,
    updated_at = now()
where lower(btrim(codigo)) = '1.7.15';

