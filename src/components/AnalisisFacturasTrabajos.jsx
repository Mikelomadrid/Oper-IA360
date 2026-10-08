import React, { useMemo, useState } from 'react';
import { BarChart3, FileSearch, Loader2, Search, Sparkles } from 'lucide-react';
import { getFacturasEmitidas } from '@/services/contasimpleService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const CATEGORIES = [
  ['todas', 'Todos los oficios'],
  ['pladur_techos', 'Pladur y techos'],
  ['pintura', 'Pintura'],
  ['albanileria', 'Albañilería'],
  ['electricidad', 'Electricidad'],
  ['fontaneria', 'Fontanería'],
  ['climatizacion', 'Climatización'],
  ['cerrajeria', 'Cerrajería'],
  ['limpieza_desescombro', 'Limpieza y desescombro'],
  ['otros', 'Pendiente de clasificar'],
];

const CATEGORY_RULES = [
  ['pladur_techos', /pladur|yeso laminado|placa.{0,8}yeso|falso techo|techo continuo|trasdosad|perfiler[ií]a|cart[oó]n yeso/i],
  ['pintura', /pintur|pintado|esmalte|imprimaci[oó]n|barniz|lijado|emplaste|gotel[eé]/i],
  ['electricidad', /el[eé]ctric|luminaria|enchufe|interruptor|cuadro|cablead|mecanismo|downlight|led|punto de luz/i],
  ['fontaneria', /fontaner|tuber[ií]a|desag[uü]e|sanitario|grifer[ií]a|lavabo|inodoro|termo|llave de paso/i],
  ['climatizacion', /climatiz|aire acondicionado|conducto|ventilaci[oó]n|aerotermia|caldera|radiador/i],
  ['cerrajeria', /cerrajer|puerta met[aá]lica|reja|barandilla|estructura met[aá]lica|soldadur/i],
  ['limpieza_desescombro', /limpieza|escombro|retirada|contenedor|gesti[oó]n de residuo|demolici[oó]n/i],
  ['albanileria', /albañiler|tabique|solado|alicatado|mortero|cemento|yeso|enfoscado|enlucido|azulejo|baldosa|mamposter/i],
];

const cleanText = (value) => String(value || '')
  .replace(/\s+/g, ' ')
  .replace(/^[\s.,;:\-–—]+|[\s.,;:\-–—]+$/g, '')
  .trim();

const normalizeKey = (value) => cleanText(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const categoryFor = (concept) => CATEGORY_RULES.find(([, pattern]) => pattern.test(concept))?.[0] || 'otros';

const money = (value) => new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
}).format(Number(value || 0));

const getRows = (payload) => {
  const candidates = [payload?.data, payload?.items, payload?.results, payload?.invoices, payload?.rows, payload];
  return candidates.find(Array.isArray) || [];
};

const invoiceYear = (invoice) => {
  const raw = invoice?.invoiceDate || invoice?.date || invoice?.issueDate || invoice?.createdAt;
  const year = raw ? new Date(raw).getFullYear() : null;
  return Number.isFinite(year) ? year : null;
};

const lineConcept = (line) => cleanText(line?.concept || line?.description || line?.name || line?.productName);
const lineQuantity = (line) => Number(line?.quantity ?? line?.units ?? 0) || 0;
const lineAmount = (line) => Number(line?.totalTaxableAmount ?? line?.taxableAmount ?? line?.amount ?? 0) || 0;

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

const readInvoicesWithRetry = async () => {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await getFacturasEmitidas('2025-01-01');
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 900);
    }
  }
  throw lastError;
};

export default function AnalisisFacturasTrabajos() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todas');

  const analyze = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await readInvoicesWithRetry();
      const invoices = getRows(response?.data).filter((invoice) => [2025, 2026].includes(invoiceYear(invoice)));
      const grouped = new Map();
      let rawLineCount = 0;
      let invoicesWithoutLines = 0;

      invoices.forEach((invoice) => {
        const lines = getRows(invoice?.lines || invoice?.items || invoice?.details);
        if (!lines.length) invoicesWithoutLines += 1;
        lines.forEach((line) => {
          const concept = lineConcept(line);
          if (!concept) return;
          rawLineCount += 1;
          const key = normalizeKey(concept);
          const current = grouped.get(key) || {
            key,
            concept,
            category: categoryFor(concept),
            occurrences: 0,
            invoiceIds: new Set(),
            quantity: 0,
            amount: 0,
            units: new Set(),
          };
          current.occurrences += 1;
          current.invoiceIds.add(String(invoice?.id || invoice?.number || `${invoiceYear(invoice)}-${current.occurrences}`));
          current.quantity += lineQuantity(line);
          current.amount += lineAmount(line);
          const unit = cleanText(line?.unit || line?.unitName || line?.measureUnit);
          if (unit) current.units.add(unit);
          grouped.set(key, current);
        });
      });

      const concepts = [...grouped.values()]
        .map((row) => ({ ...row, invoiceCount: row.invoiceIds.size, units: [...row.units] }))
        .sort((a, b) => b.invoiceCount - a.invoiceCount || b.occurrences - a.occurrences || a.concept.localeCompare(b.concept, 'es'));

      setResult({
        invoices,
        concepts,
        rawLineCount,
        invoicesWithoutLines,
        meta: response?.meta || {},
      });
    } catch (analysisError) {
      setError(analysisError?.message || 'No se pudieron leer las facturas de ContaSimple.');
    } finally {
      setLoading(false);
    }
  };

  const visibleConcepts = useMemo(() => {
    const term = normalizeKey(search);
    return (result?.concepts || []).filter((row) => {
      const categoryMatch = category === 'todas' || row.category === category;
      return categoryMatch && (!term || row.key.includes(term));
    });
  }, [result, search, category]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    (result?.concepts || []).forEach((row) => { counts[row.category] = (counts[row.category] || 0) + 1; });
    return counts;
  }, [result]);

  const openAnalysis = () => {
    setOpen(true);
    if (!result && !loading) analyze();
  };

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={openAnalysis}>
        <FileSearch className="h-4 w-4" /> Analizar facturas 2025–2026
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[88vh] max-w-[1200px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-start justify-between gap-5 pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2 text-xl"><BarChart3 className="h-5 w-5 text-blue-700" /> Trabajos facturados en 2025 y 2026</DialogTitle>
                <DialogDescription className="mt-2">Análisis de solo lectura. Los conceptos se agrupan sin crear todavía partidas en la biblioteca.</DialogDescription>
              </div>
              <Button variant="outline" size="sm" onClick={analyze} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Volver a analizar
              </Button>
            </div>
          </DialogHeader>

          {loading && !result ? (
            <div className="grid flex-1 place-items-center"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-700" /><p className="mt-3 text-sm text-slate-600">Leyendo y agrupando facturas…</p></div></div>
          ) : error ? (
            <div className="grid flex-1 place-items-center p-8 text-center"><div><p className="font-medium text-red-700">{error}</p><Button className="mt-4" onClick={analyze}>Reintentar</Button></div></div>
          ) : result ? (
            <>
              <div className="grid border-b border-slate-200 bg-slate-50 sm:grid-cols-4">
                <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r"><div className="font-mono text-2xl font-semibold">{result.invoices.length}</div><div className="text-xs text-slate-500">facturas analizadas</div></div>
                <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r"><div className="font-mono text-2xl font-semibold">{result.rawLineCount}</div><div className="text-xs text-slate-500">líneas de trabajos</div></div>
                <div className="border-b border-slate-200 px-5 py-4 sm:border-b-0 sm:border-r"><div className="font-mono text-2xl font-semibold">{result.concepts.length}</div><div className="text-xs text-slate-500">conceptos distintos</div></div>
                <div className="px-5 py-4"><div className={`font-mono text-2xl font-semibold ${result.meta?.complete === false ? 'text-amber-700' : 'text-emerald-700'}`}>{result.meta?.complete === false ? 'Parcial' : 'Completo'}</div><div className="text-xs text-slate-500">estado de la lectura</div></div>
              </div>

              {result.invoicesWithoutLines > 0 && (
                <div className="border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
                  {result.invoicesWithoutLines} facturas no incluyen líneas en el listado de la API. Necesitarán una segunda consulta de detalle.
                </div>
              )}

              <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 md:flex-row">
                <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar trabajo facturado" className="pl-9" /></div>
                <Select value={category} onValueChange={setCategory}><SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(([value, label]) => <SelectItem key={value} value={value}>{label}{value !== 'todas' ? ` (${categoryCounts[value] || 0})` : ''}</SelectItem>)}</SelectContent></Select>
              </div>

              <div className="flex-1 overflow-auto">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white"><TableRow><TableHead className="w-[48%]">Concepto facturado</TableHead><TableHead>Oficio sugerido</TableHead><TableHead className="text-right">Facturas</TableHead><TableHead className="text-right">Apariciones</TableHead><TableHead className="text-right">Base acumulada</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleConcepts.slice(0, 500).map((row) => <TableRow key={row.key}>
                      <TableCell><div className="font-medium text-slate-900">{row.concept}</div>{row.units.length > 0 && <div className="mt-1 text-xs text-slate-500">Unidades detectadas: {row.units.join(', ')}</div>}</TableCell>
                      <TableCell><Badge variant="outline">{CATEGORIES.find(([key]) => key === row.category)?.[1] || row.category}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{row.invoiceCount}</TableCell>
                      <TableCell className="text-right font-mono">{row.occurrences}</TableCell>
                      <TableCell className="text-right font-mono">{money(row.amount)}</TableCell>
                    </TableRow>)}
                    {visibleConcepts.length === 0 && <TableRow><TableCell colSpan={5} className="h-28 text-center text-slate-500">No hay conceptos con este filtro.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t border-slate-200 px-6 py-3 text-xs text-slate-500">
                Mostrando {Math.min(visibleConcepts.length, 500)} de {visibleConcepts.length} conceptos. La clasificación es una propuesta y deberá revisarse antes de crear la biblioteca definitiva.
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
