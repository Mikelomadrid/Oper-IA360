// src/components/FichaContacto.jsx
// ----------------------------------------------------------------------------
// Conjunto canónico de campos de cliente/contacto, compartido por las tres
// fichas: alta de cliente, alta de lead y alta de obra.
//
// Es un componente CONTROLADO y presentacional (no toca Supabase):
//   - value:    objeto con los campos canónicos
//   - onChange: recibe el objeto completo actualizado -> onChange({ ...value, campo: nuevo })
//   - errors:   objeto opcional { campo: "mensaje" } para pintar errores
//   - modo:     "cliente" | "lead" | "obra"  -> define qué campos son obligatorios
//   - disabled: bloquea todos los inputs (p. ej. ficha de solo lectura)
//
// Regla de obligatoriedad (la que decidimos):
//   - lead:    solo `contacto` y `telefono` (parte alta del embudo)
//   - cliente: `nombre`, `cif`
//   - obra:    `nombre`, `cif`  (cliente obligatorio -> ficha fiscal completa)
//
// Validación: importa `validateFichaContacto(value, modo)` para gatear el submit
// desde el formulario padre.
// ----------------------------------------------------------------------------

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Campos canónicos. Mapean 1:1 a `clientes`; lead/obra los traducen a sus columnas al guardar.
export const CAMPOS_FICHA_CONTACTO = [
  'nombre',        // razón social / nombre fiscal
  'contacto',      // persona de contacto
  'telefono',
  'email',
  'cif',
  'direccion',
  'codigo_postal',
  'municipio',
  'provincia',
];

// Valor inicial vacío reutilizable.
export const FICHA_CONTACTO_VACIA = CAMPOS_FICHA_CONTACTO.reduce(
  (acc, k) => ({ ...acc, [k]: '' }),
  {}
);

// Qué campos son obligatorios según el contexto.
const OBLIGATORIOS = {
  lead: ['contacto', 'telefono'],
  cliente: ['nombre', 'cif'],
  obra: ['nombre', 'cif'],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Validador exportable: devuelve { ok, errors }.
export function validateFichaContacto(value = {}, modo = 'cliente') {
  const errors = {};
  const obligatorios = OBLIGATORIOS[modo] ?? OBLIGATORIOS.cliente;

  obligatorios.forEach((campo) => {
    if (!String(value[campo] ?? '').trim()) {
      errors[campo] = 'Campo obligatorio';
    }
  });

  if (value.email && !EMAIL_RE.test(value.email)) {
    errors.email = 'Email no válido';
  }
  if (value.codigo_postal && !/^\d{4,5}$/.test(String(value.codigo_postal).trim())) {
    errors.codigo_postal = 'Código postal no válido';
  }

  return { ok: Object.keys(errors).length === 0, errors };
}

// --- subcomponente de campo ---
function Campo({ id, label, value, onChange, error, required, disabled, type = 'text', placeholder }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
        aria-invalid={!!error}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function FichaContacto({
  value = FICHA_CONTACTO_VACIA,
  onChange,
  errors = {},
  modo = 'cliente',
  disabled = false,
}) {
  const obligatorios = OBLIGATORIOS[modo] ?? OBLIGATORIOS.cliente;
  const esObligatorio = (campo) => obligatorios.includes(campo);

  const set = (campo) => (nuevo) => onChange?.({ ...value, [campo]: nuevo });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Campo
          id="fc-nombre"
          label="Nombre / Razón social"
          value={value.nombre}
          onChange={set('nombre')}
          error={errors.nombre}
          required={esObligatorio('nombre')}
          disabled={disabled}
          placeholder="Ej. Comunidad de Propietarios Urquiza 33"
        />
      </div>

      <Campo
        id="fc-contacto"
        label="Persona de contacto"
        value={value.contacto}
        onChange={set('contacto')}
        error={errors.contacto}
        required={esObligatorio('contacto')}
        disabled={disabled}
        placeholder="Ej. Fernando Carrascosa"
      />

      <Campo
        id="fc-cif"
        label="CIF / NIF"
        value={value.cif}
        onChange={set('cif')}
        error={errors.cif}
        required={esObligatorio('cif')}
        disabled={disabled}
        placeholder="Ej. B12345678"
      />

      <Campo
        id="fc-telefono"
        label="Teléfono"
        type="tel"
        value={value.telefono}
        onChange={set('telefono')}
        error={errors.telefono}
        required={esObligatorio('telefono')}
        disabled={disabled}
        placeholder="Ej. 600123456"
      />

      <Campo
        id="fc-email"
        label="Email"
        type="email"
        value={value.email}
        onChange={set('email')}
        error={errors.email}
        required={esObligatorio('email')}
        disabled={disabled}
        placeholder="Ej. contacto@cliente.com"
      />

      <div className="sm:col-span-2">
        <Campo
          id="fc-direccion"
          label="Dirección"
          value={value.direccion}
          onChange={set('direccion')}
          error={errors.direccion}
          required={esObligatorio('direccion')}
          disabled={disabled}
          placeholder="Calle, número, piso..."
        />
      </div>

      <Campo
        id="fc-codigo_postal"
        label="Código postal"
        value={value.codigo_postal}
        onChange={set('codigo_postal')}
        error={errors.codigo_postal}
        required={esObligatorio('codigo_postal')}
        disabled={disabled}
        placeholder="Ej. 28050"
      />

      <Campo
        id="fc-municipio"
        label="Municipio"
        value={value.municipio}
        onChange={set('municipio')}
        error={errors.municipio}
        required={esObligatorio('municipio')}
        disabled={disabled}
        placeholder="Ej. Madrid"
      />

      <div className="sm:col-span-2">
        <Campo
          id="fc-provincia"
          label="Provincia"
          value={value.provincia}
          onChange={set('provincia')}
          error={errors.provincia}
          required={esObligatorio('provincia')}
          disabled={disabled}
          placeholder="Ej. Madrid"
        />
      </div>
    </div>
  );
}
