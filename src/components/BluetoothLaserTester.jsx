import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  CheckCircle2,
  Eraser,
  Loader2,
  Radio,
  ShieldAlert,
  Smartphone,
  TerminalSquare,
  Unplug,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// MIRX is used by current BLE-only GLM models such as the GLM 100-25 C.
const BOSCH_GLM_MIRX_SERVICE = '02a6c0d0-0451-4000-b000-fb3210111989';
const BOSCH_GLM_MIRX_CHARACTERISTIC = '02a6c0d1-0451-4000-b000-fb3210111989';
const BOSCH_GLM_SYNC_COMMAND = new Uint8Array([0xc0, 0x55, 0x02, 0x01, 0x00, 0x1a]);
// Kept for compatibility with the previous GLM 100 C generation.
const BOSCH_GLM_LEGACY_SERVICE = '00005301-0000-0041-5253-534f46540000';
const STANDARD_SERVICES = [
  BOSCH_GLM_MIRX_SERVICE,
  BOSCH_GLM_LEGACY_SERVICE,
  '0000180a-0000-1000-8000-00805f9b34fb',
  '0000180f-0000-1000-8000-00805f9b34fb',
];

const wait = (milliseconds) => new Promise((resolve) => {
  window.setTimeout(resolve, milliseconds);
});

function toBytes(value) {
  return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

function decodePacket(value) {
  const bytes = toBytes(value);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
  const ascii = Array.from(bytes, (byte) => (byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.')).join('');
  const candidates = [];

  // Bosch MIRX measurement notifications use the C0 55 10 06 prefix and
  // store the distance in metres as a little-endian float at bytes 7–10.
  if (
    value.byteLength >= 11
    && bytes[0] === 0xc0
    && bytes[1] === 0x55
    && bytes[2] === 0x10
    && bytes[3] === 0x06
  ) {
    const boschDistance = value.getFloat32(7, true);
    if (Number.isFinite(boschDistance) && boschDistance > 0.01 && boschDistance < 1000) {
      candidates.push(Number(boschDistance.toFixed(3)));
    }
  }

  for (let offset = 0; offset + 4 <= value.byteLength; offset += 4) {
    const little = value.getFloat32(offset, true);
    const big = value.getFloat32(offset, false);
    [little, big].forEach((number) => {
      if (Number.isFinite(number) && number > 0.01 && number < 1000) {
        const rounded = Number(number.toFixed(4));
        if (!candidates.includes(rounded)) candidates.push(rounded);
      }
    });
  }

  const textNumber = ascii.match(/\d+(?:[.,]\d+)?/);
  return {
    hex,
    ascii,
    candidates: textNumber
      ? [Number(textNumber[0].replace(',', '.')), ...candidates].filter((item, index, list) => list.indexOf(item) === index)
      : candidates,
  };
}

function shortUuid(uuid = '') {
  if (uuid.startsWith('0000') && uuid.endsWith('-0000-1000-8000-00805f9b34fb')) {
    return uuid.slice(4, 8);
  }
  return uuid;
}

function enabledProperties(properties) {
  return [
    'broadcast',
    'read',
    'writeWithoutResponse',
    'write',
    'notify',
    'indicate',
    'authenticatedSignedWrites',
    'reliableWrite',
    'writableAuxiliaries',
  ].filter((name) => properties?.[name]);
}

export default function BluetoothLaserTester({
  open,
  onOpenChange,
  captureLabel = '',
  onUseMeasurement,
  disconnectOnClose = true,
}) {
  const deviceRef = useRef(null);
  const notificationCharacteristicsRef = useRef([]);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState('idle');
  const [deviceName, setDeviceName] = useState('');
  const [error, setError] = useState('');
  const [services, setServices] = useState([]);
  const [advertisedServices, setAdvertisedServices] = useState([]);
  const [packets, setPackets] = useState([]);
  const [logs, setLogs] = useState([]);

  const bluetoothAvailable = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const compatible = bluetoothAvailable && secureContext;
  const connected = status === 'connected';

  const addLog = useCallback((message, level = 'info') => {
    if (!mountedRef.current) return;
    setLogs((current) => [
      { id: `${Date.now()}-${Math.random()}`, time: new Date(), message, level },
      ...current,
    ].slice(0, 40));
  }, []);

  const registerValue = useCallback((characteristic, value) => {
    const decoded = decodePacket(value);
    const packet = {
      id: `${Date.now()}-${Math.random()}`,
      time: new Date(),
      service: characteristic.service?.uuid || '',
      characteristic: characteristic.uuid,
      ...decoded,
    };
    setPackets((current) => [packet, ...current].slice(0, 50));
    addLog(`Dato recibido desde ${shortUuid(characteristic.uuid)} (${decoded.hex})`, 'success');
  }, [addLog]);

  const handleCharacteristicValue = useCallback((event) => {
    registerValue(event.target, event.target.value);
  }, [registerValue]);

  const disconnect = useCallback(() => {
    notificationCharacteristicsRef.current.forEach((characteristic) => {
      characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicValue);
    });
    notificationCharacteristicsRef.current = [];
    const device = deviceRef.current;
    if (device?.gatt?.connected) device.gatt.disconnect();
    deviceRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
      setDeviceName('');
      setServices([]);
    }
  }, [handleCharacteristicValue]);

  const forgetDevice = async () => {
    const device = deviceRef.current;
    if (!device) return;

    try {
      notificationCharacteristicsRef.current.forEach((characteristic) => {
        characteristic.removeEventListener('characteristicvaluechanged', handleCharacteristicValue);
      });
      notificationCharacteristicsRef.current = [];
      if (device.gatt?.connected) device.gatt.disconnect();

      if (typeof device.forget !== 'function') {
        setError('Este navegador no permite borrar el vínculo desde la aplicación. Cierra esta pestaña y borra el permiso Bluetooth del sitio desde los ajustes del navegador.');
        return;
      }

      await device.forget();
      deviceRef.current = null;
      setDeviceName('');
      setServices([]);
      setAdvertisedServices([]);
      setPackets([]);
      setStatus('idle');
      setError('Vínculo Bluetooth eliminado. Apaga y enciende el GLM y pulsa “Buscar y conectar GLM”.');
      addLog('Permiso y vínculo Bluetooth eliminados del navegador.', 'success');
    } catch (forgetError) {
      setError(`No se pudo borrar el vínculo del navegador: ${forgetError.message}`);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const device = deviceRef.current;
      if (device?.gatt?.connected) device.gatt.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!open && disconnectOnClose) disconnect();
  }, [open, disconnect, disconnectOnClose]);

  const handleDisconnected = useCallback(() => {
    if (!mountedRef.current) return;
    notificationCharacteristicsRef.current = [];
    setStatus('idle');
    setError('El láser se ha desconectado. Enciéndelo y vuelve a conectarlo.');
    addLog('Dispositivo desconectado', 'warning');
  }, [addLog]);

  const captureAdvertisedServices = useCallback(async (device) => {
    if (typeof device.watchAdvertisements !== 'function') {
      addLog('El navegador no permite inspeccionar los anuncios Bluetooth.', 'warning');
      return [];
    }

    const discovered = new Set();
    const abortController = new AbortController();
    const handleAdvertisement = (event) => {
      (event.uuids || []).forEach((uuid) => discovered.add(uuid.toLowerCase()));
      addLog(`Anuncio del GLM recibido${event.rssi ? ` · señal ${event.rssi} dBm` : ''}`, 'success');
    };

    device.addEventListener('advertisementreceived', handleAdvertisement);
    try {
      await device.watchAdvertisements({ signal: abortController.signal });
      await wait(1400);
    } catch (advertisementError) {
      if (advertisementError?.name !== 'AbortError') {
        addLog(`No se pudo leer el perfil anunciado: ${advertisementError.message}`, 'warning');
      }
    } finally {
      abortController.abort();
      device.removeEventListener('advertisementreceived', handleAdvertisement);
    }

    const result = Array.from(discovered);
    if (result.length > 0) {
      setAdvertisedServices((current) => Array.from(new Set([...current, ...result])));
      addLog(`Perfil anunciado: ${result.join(', ')}`, 'success');
    }
    return result;
  }, [addLog]);

  const connect = async () => {
    if (!compatible) return;
    setStatus('connecting');
    setError('');
    setServices([]);
    setPackets([]);
    addLog('Abriendo el selector Bluetooth…');

    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: Array.from(new Set([...STANDARD_SERVICES, ...advertisedServices])),
      });
      deviceRef.current = device;
      setDeviceName(device.name || 'Dispositivo Bluetooth');
      addLog(`Dispositivo seleccionado: ${device.name || 'sin nombre'}`);
      const newlyAdvertisedServices = await captureAdvertisedServices(device);
      const newPermissionNeeded = newlyAdvertisedServices.some((uuid) => (
        !STANDARD_SERVICES.includes(uuid) && !advertisedServices.includes(uuid)
      ));

      if (newPermissionNeeded) {
        setStatus('idle');
        setError('Perfil Bluetooth específico del GLM detectado. Pulsa de nuevo “Buscar y conectar GLM” y selecciónalo otra vez para autorizar ese servicio.');
        addLog('Es necesario un segundo emparejamiento para autorizar el perfil detectado.', 'warning');
        return;
      }

      let server = null;
      let primaryServices = null;
      let lastGattError = null;
      // The GLM needs time to start advertising again after dropping a link.
      // Short, forced disconnect/reconnect loops make the 100-25 C reject the
      // following attempts before service discovery has begun.
      const retryWaits = [0, 2500, 6000];

      for (let attempt = 0; attempt < retryWaits.length; attempt += 1) {
        try {
          if (attempt > 0) {
            addLog(`Esperando a que el GLM vuelva a anunciarse (${attempt + 1}/${retryWaits.length})…`, 'warning');
          }
          if (retryWaits[attempt] > 0) await wait(retryWaits[attempt]);
          server = device.gatt.connected ? device.gatt : await device.gatt.connect();
          if (!device.gatt.connected) throw new Error('El GLM cerró el enlace antes de consultar sus servicios.');
          try {
            const mirxService = await server.getPrimaryService(BOSCH_GLM_MIRX_SERVICE);
            primaryServices = [mirxService];
          } catch (mirxError) {
            if (!device.gatt.connected) throw mirxError;
            primaryServices = await server.getPrimaryServices();
          }
          lastGattError = null;
          break;
        } catch (gattError) {
          lastGattError = gattError;
          addLog(`Intento ${attempt + 1}: ${gattError.message}`, 'warning');
          if (device.gatt.connected) device.gatt.disconnect();
        }
      }

      if (lastGattError || !primaryServices) {
        throw new Error(`El GLM se desconecta durante el emparejamiento (${lastGattError?.message || 'servicios no disponibles'}). Apaga MeasureOn si está abierto y vuelve a intentarlo.`);
      }

      device.addEventListener('gattserverdisconnected', handleDisconnected, { once: true });
      addLog('Enlace Bluetooth estable y servicios accesibles', 'success');
      const discovered = [];

      for (const service of primaryServices) {
        const serviceInfo = { uuid: service.uuid, characteristics: [] };
        try {
          const characteristics = await service.getCharacteristics();
          for (const characteristic of characteristics) {
            const properties = enabledProperties(characteristic.properties);
            serviceInfo.characteristics.push({ uuid: characteristic.uuid, properties });

            if (characteristic.properties.notify || characteristic.properties.indicate) {
              try {
                characteristic.addEventListener('characteristicvaluechanged', handleCharacteristicValue);
                await characteristic.startNotifications();
                notificationCharacteristicsRef.current.push(characteristic);
                addLog(`Escuchando datos en ${shortUuid(characteristic.uuid)}`, 'success');
              } catch (notificationError) {
                addLog(`No se pudo escuchar ${shortUuid(characteristic.uuid)}: ${notificationError.message}`, 'warning');
              }
            }

            if (
              characteristic.uuid.toLowerCase() === BOSCH_GLM_MIRX_CHARACTERISTIC
              && (characteristic.properties.write || characteristic.properties.writeWithoutResponse)
            ) {
              try {
                if (characteristic.properties.write && typeof characteristic.writeValueWithResponse === 'function') {
                  await characteristic.writeValueWithResponse(BOSCH_GLM_SYNC_COMMAND);
                } else if (typeof characteristic.writeValueWithoutResponse === 'function') {
                  await characteristic.writeValueWithoutResponse(BOSCH_GLM_SYNC_COMMAND);
                } else {
                  await characteristic.writeValue(BOSCH_GLM_SYNC_COMMAND);
                }
                addLog('Modo de sincronización Bosch activado', 'success');
              } catch (syncError) {
                addLog(`No se pudo activar la sincronización Bosch: ${syncError.message}`, 'warning');
              }
            }

            if (characteristic.properties.read) {
              try {
                const value = await characteristic.readValue();
                registerValue(characteristic, value);
              } catch (readError) {
                addLog(`No se pudo leer ${shortUuid(characteristic.uuid)}: ${readError.message}`, 'warning');
              }
            }
          }
        } catch (serviceError) {
          serviceInfo.error = serviceError.message;
        }
        discovered.push(serviceInfo);
      }

      setServices(discovered);
      setStatus('connected');
      addLog(`Diagnóstico activo: ${discovered.length} servicio(s) encontrado(s)`, 'success');
    } catch (connectionError) {
      const cancelled = connectionError?.name === 'NotFoundError';
      setStatus('idle');
      setError(cancelled
        ? 'No se seleccionó ningún dispositivo. Vuelve a intentarlo con el Bluetooth del GLM activado.'
        : `No se pudo conectar: ${connectionError.message}`);
      addLog(cancelled ? 'Selección cancelada' : connectionError.message, 'warning');
    }
  };

  const latestPacket = packets[0];
  const visibleValue = useMemo(() => {
    if (!latestPacket) return null;
    return latestPacket.candidates?.[0] ?? null;
  }, [latestPacket]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[94vh] w-[calc(100vw-1rem)] max-w-4xl gap-0 overflow-hidden p-0 sm:h-[90vh]">
        <DialogHeader className="border-b bg-card px-5 py-4 pr-12">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-700">
              <Bluetooth className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Prueba directa Bosch GLM</DialogTitle>
              <DialogDescription>Conexión experimental al ERP, sin MeasureOn y sin guardar datos.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto p-4 sm:p-6">
          {!compatible && (
            <div className="mb-5 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Este navegador no permite la conexión Bluetooth</p>
                <p className="mt-1 text-sm">
                  Abre el ERP con Chrome en tu móvil Android mediante una dirección HTTPS. El Bluetooth web no funciona desde una dirección HTTP de la red local.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
            <div className="space-y-5">
              <Card className="overflow-hidden border-violet-200 shadow-none">
                <CardContent className="p-0">
                  <div className="flex flex-col items-center border-b bg-gradient-to-b from-violet-50 to-white px-5 py-8 text-center">
                    <div className={`relative flex h-28 w-28 items-center justify-center rounded-full border-2 ${connected ? 'border-emerald-400 bg-emerald-50' : 'border-violet-300 bg-white'}`}>
                      {connected && <span className="absolute inset-2 animate-ping rounded-full border border-emerald-300 opacity-40" />}
                      {connected ? <Radio className="h-10 w-10 text-emerald-600" /> : <Bluetooth className="h-10 w-10 text-violet-600" />}
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {connected ? 'Escuchando mediciones' : status === 'connecting' ? 'Conectando' : 'Preparado para conectar'}
                    </p>
                    <div className="mt-2 min-h-12 font-mono text-4xl font-bold tabular-nums text-foreground">
                      {visibleValue !== null ? `${visibleValue} m` : '— — —'}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {latestPacket ? `Último paquete · ${latestPacket.time.toLocaleTimeString('es-ES')}` : 'Dispara una medición en el GLM después de conectarlo'}
                    </p>
                    {captureLabel && (
                      <Badge variant="outline" className="mt-3 border-violet-200 bg-white text-violet-800">
                        Destino: {captureLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 p-4">
                    {!connected ? (
                      <Button onClick={connect} disabled={!compatible || status === 'connecting'} className="min-w-48">
                        {status === 'connecting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BluetoothConnected className="mr-2 h-4 w-4" />}
                        {status === 'connecting' ? 'Conectando…' : 'Buscar y conectar GLM'}
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={disconnect} className="min-w-40">
                        <Unplug className="mr-2 h-4 w-4" /> Desconectar
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => setPackets([])} disabled={packets.length === 0}>
                      <Eraser className="mr-2 h-4 w-4" /> Limpiar lecturas
                    </Button>
                    {visibleValue !== null && typeof onUseMeasurement === 'function' && (
                      <Button
                        type="button"
                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => {
                          onUseMeasurement(visibleValue);
                          onOpenChange(false);
                        }}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Usar {visibleValue} m
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {error && (
                <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
                  <BluetoothOff className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm">{error}</p>
                    {deviceRef.current && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 border-red-300 bg-white text-red-800 hover:bg-red-100 hover:text-red-900"
                        onClick={forgetDevice}
                      >
                        Olvidar vínculo Bluetooth
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Lecturas recibidas</h3>
                  <Badge variant="secondary">{packets.length}</Badge>
                </div>
                <div className="overflow-hidden rounded-lg border bg-card">
                  {packets.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">Todavía no se ha recibido ningún dato del láser.</div>
                  ) : packets.map((packet) => (
                    <div key={packet.id} className="border-b px-4 py-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold">{packet.candidates?.length ? `${packet.candidates[0]} (valor candidato)` : 'Paquete sin descodificar'}</p>
                          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{packet.hex}</p>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">{packet.time.toLocaleTimeString('es-ES')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-violet-600" />
                  <h3 className="font-semibold">Cómo hacer la prueba</h3>
                </div>
                <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
                  <li><span className="mr-2 font-semibold text-foreground">1.</span>Enciende el GLM y activa Bluetooth en sus ajustes.</li>
                  <li><span className="mr-2 font-semibold text-foreground">2.</span>Pulsa “Buscar y conectar GLM” y selecciónalo.</li>
                  <li><span className="mr-2 font-semibold text-foreground">3.</span>Haz una medición normal con el láser.</li>
                  <li><span className="mr-2 font-semibold text-foreground">4.</span>Comprueba si aparece un paquete o una medida.</li>
                </ol>
              </div>

              <div className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold">Conexión</h3>
                  <Badge className={connected ? 'bg-emerald-600' : ''} variant={connected ? 'default' : 'secondary'}>
                    {connected ? 'Conectado' : 'Sin conectar'}
                  </Badge>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Dispositivo</dt><dd className="text-right font-medium">{deviceName || '—'}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Servicios</dt><dd className="font-medium">{services.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Perfiles anunciados</dt><dd className="font-medium">{advertisedServices.length}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Entorno seguro</dt><dd>{secureContext ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : 'No'}</dd></div>
                </dl>
              </div>

              <details className="rounded-lg border bg-card p-4">
                <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold">
                  <TerminalSquare className="h-4 w-4 text-muted-foreground" /> Diagnóstico técnico
                </summary>
                <div className="mt-4 space-y-4">
                  {services.length > 0 && (
                    <div className="space-y-2">
                      {services.map((service) => (
                        <div key={service.uuid} className="rounded border bg-muted/30 p-2 text-xs">
                          <p className="break-all font-mono font-semibold">Servicio {service.uuid}</p>
                          {service.characteristics.map((characteristic) => (
                            <p key={characteristic.uuid} className="mt-1 break-all font-mono text-muted-foreground">
                              ↳ {characteristic.uuid} · {characteristic.properties.join(', ') || 'sin propiedades'}
                            </p>
                          ))}
                          {service.error && <p className="mt-1 text-red-700">{service.error}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="max-h-48 space-y-2 overflow-y-auto font-mono text-xs">
                    {logs.length === 0 ? <p className="text-muted-foreground">Sin actividad.</p> : logs.map((log) => (
                      <p key={log.id} className={log.level === 'success' ? 'text-emerald-700' : log.level === 'warning' ? 'text-amber-700' : 'text-muted-foreground'}>
                        {log.time.toLocaleTimeString('es-ES')} · {log.message}
                      </p>
                    ))}
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
