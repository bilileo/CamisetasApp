'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getConsolidatedReport, ReportSummary } from '../actions/reports';
import { toggleOrderDelivered } from '../actions/orders';
import { KIDS_SIZES, ADULT_SIZES, SHIRT_PRICES, ShirtSize } from '../../lib/constants';

interface Church {
  id: string;
  name: string;
}

interface SessionOption {
  id: string;
  opened_at: string;
  status: string;
  total_collected: number;
}

// Tipo auxiliar para el recibo individual
type FamilyItem = ReportSummary['familiesList'][0];

export default function ReportesPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<string>('ALL');
  
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Estados de Modales e Interfaz
  const [deliveryModalFamily, setDeliveryModalFamily] = useState<{id: string, family_name: string, is_delivered: boolean} | null>(null);
  const [receiptFamily, setReceiptFamily] = useState<FamilyItem | null>(null); // Estado para el ticket de recibo

  // 1. Cargar la lista de iglesias al abrir la página
  useEffect(() => {
    async function loadChurches() {
      const { data } = await supabase.from('churches').select('id, name').order('name');
      if (data && data.length > 0) {
        setChurches(data);
      }
    }
    loadChurches();
  }, []);

  // 2. Cargar los turnos/cajas cada vez que cambia la iglesia
  useEffect(() => {
    async function loadSessions() {
      if (selectedChurch === 'ALL') {
        setSessions([]);
        setSelectedSession('ALL');
        return;
      }

      const { data } = await supabase
        .from('cash_sessions')
        .select('id, opened_at, status, total_collected')
        .eq('church_id', selectedChurch)
        .order('opened_at', { ascending: false });

      if (data) {
        setSessions(data);
        setSelectedSession('ALL');
      }
    }
    loadSessions();
  }, [selectedChurch]);

  // 3. Generar el reporte exacto
  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      setErrorMsg(null);
      const res = await getConsolidatedReport(selectedChurch, selectedSession);
      if (res.success && res.data) {
        setReportData(res.data);
      } else {
        setErrorMsg(res.error || 'Error cargando datos del reporte.');
      }
      setLoading(false);
    }
    fetchReport();
  }, [selectedChurch, selectedSession]);

  // Función para confirmar la entrega desde el modal
  const confirmToggleDelivery = async () => {
    if (!deliveryModalFamily) return;
    const { id, is_delivered } = deliveryModalFamily;

    setDeliveryModalFamily(null); // Ocultar rápido
    setReportData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        familiesList: prev.familiesList.map(f => 
          f.id === id ? { ...f, is_delivered: !is_delivered } : f
        )
      };
    });

    const res = await toggleOrderDelivered(id, is_delivered);
    if (!res.success) alert('Error de conexión al guardar la entrega.');
  };

  const currentChurchName = selectedChurch === 'ALL' 
    ? 'Reporte Global (Todas las Iglesias)' 
    : churches.find(c => c.id === selectedChurch)?.name || 'Iglesia';


  // =========================================================================
  // VISTA ESPECIAL EXCLUSIVA: TICKET DE COMPROBANTE DE PAGO
  // Si receiptFamily tiene datos, React oculta el dashboard y muestra solo el ticket
  // =========================================================================
  if (receiptFamily) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 print:bg-white print:p-0">
        <div className="bg-white text-black p-8 max-w-sm w-full rounded-2xl shadow-2xl print:shadow-none print:max-w-none print:w-full print:p-4">
          
          {/* Cabecera del Ticket */}
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
            <h2 className="text-xl font-black uppercase tracking-widest">Recibo de Liquidación</h2>
            <p className="text-sm font-bold text-gray-700 mt-1">{currentChurchName}</p>
            <p className="text-xs text-gray-500 mt-1">
              Fecha: {new Date().toLocaleDateString('es-MX')} a las {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* Datos del Cliente */}
          <div className="mb-4 text-center">
            <p className="text-xs text-gray-500 uppercase">Familia / Hermano</p>
            <p className="text-xl font-black uppercase my-1">{receiptFamily.family_name}</p>
            <div className="inline-block bg-black text-white px-3 py-1 rounded-full text-xs font-bold tracking-widest mt-1">
              ESTADO: LIQUIDADO 100%
            </div>
          </div>

          {/* Detalle de Prendas */}
          <div className="border-t border-b border-gray-300 py-3 mb-6 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Detalle de Prendas:</p>
            {receiptFamily.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm font-bold">
                <span>{item.quantity}x Talla {item.size}</span>
                <span>✓</span>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="flex justify-between items-center text-lg font-black mb-10">
            <span>Total Abonado:</span>
            <span>${receiptFamily.total_amount.toLocaleString('es-MX')} MXN</span>
          </div>

          {/* Firmas / Nota final */}
          <div className="mt-12 pt-4 border-t-2 border-black text-center text-xs text-gray-800 font-bold w-4/5 mx-auto uppercase">
            Firma de Recibido / Conformidad
          </div>
          <p className="text-center text-xs text-gray-400 mt-4 italic">
            Conserve este comprobante para cualquier aclaración.
          </p>

          {/* Botones de Acción (Se ocultan automáticamente al imprimir) */}
          <div className="mt-8 flex gap-3 print:hidden">
            <button 
              onClick={() => setReceiptFamily(null)}
              className="w-1/3 bg-gray-200 hover:bg-gray-300 text-black font-semibold py-3 rounded-lg text-sm transition"
            >
              Volver
            </button>
            <button 
              onClick={() => window.print()}
              className="w-2/3 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg text-sm transition shadow-lg shadow-blue-600/30"
            >
              Imprimir Ticket
            </button>
          </div>

        </div>
      </div>
    );
  }
  // =========================================================================


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 print:bg-white print:text-black print:p-0">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* PANEL DE FILTROS (Se oculta al imprimir) */}
        <header className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-white">Módulo de Reportes y Entregas</h1>
            <p className="text-sm text-gray-400">Hola Papa, hice este apartado para facilitarte la entrega de reportes.</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Iglesia</label>
              <select
                value={selectedChurch}
                onChange={(e) => setSelectedChurch(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="ALL">Todo (Global)</option>
                {churches.map(c => <option key={c.id} value={c.id}> {c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Corte / Sesión</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                disabled={selectedChurch === 'ALL'}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none disabled:opacity-50"
              >
                <option value="ALL">Todas las Sesiones (Histórico)</option>
                {sessions.map(s => {
                  const dateFormatted = new Date(s.opened_at).toLocaleDateString('es-MX', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  });
                  return (
                    <option key={s.id} value={s.id}>
                      {s.status === 'OPEN' ? '🟢 [ABIERTA] ' : '🔴 [CERRADA] '} {dateFormatted}
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => window.print()}
              className="mt-5 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-lg shadow-blue-600/30 flex items-center gap-2"
            >
              Imprimir Reporte Completo
            </button>
          </div>
        </header>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 p-4 rounded-xl text-red-400 text-center">
            {errorMsg}
          </div>
        )}

        {loading || !reportData ? (
          <div className="text-center py-20 text-gray-400">Calculando consolidado exacto...</div>
        ) : (
          <main className="bg-gray-800 p-8 rounded-2xl border border-gray-700 print:bg-white print:border-none print:shadow-none space-y-12">
            
            {/* SECCIÓN 1: REPORTE FINANCIERO Y PRODUCCIÓN */}
            <div>
              <div className="border-b border-gray-700 print:border-gray-300 pb-6 flex justify-between items-end mb-8">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-blue-700">Orden de Producción y Caja</span>
                  <h2 className="text-2xl font-black text-white print:text-black">{currentChurchName}</h2>
                  <p className="text-xs text-gray-400 print:text-gray-600 mt-1">
                    Fecha de Emisión: {new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 print:text-gray-600 block">Filtro Aplicado:</span>
                  <span className="text-sm font-bold print:text-black">
                    {selectedSession === 'ALL' ? 'Acumulado Histórico' : 'Turno de Caja Específico'}
                  </span>
                </div>
              </div>

              {/* TARJETAS KPI */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 mb-8">
                <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                  <span className="text-xs text-gray-400 print:text-gray-600 block">Total Recaudado (Caja)</span>
                  <span className="text-xl font-bold text-emerald-400 print:text-emerald-700">
                    ${reportData.totalMoneyCollected.toLocaleString('es-MX')} MXN
                  </span>
                </div>
                <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                  <span className="text-xs text-gray-400 print:text-gray-600 block">Total Esperado</span>
                  <span className="text-xl font-bold text-white print:text-black">
                    ${reportData.totalExpectedRevenue.toLocaleString('es-MX')} MXN
                  </span>
                </div>
                <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                  <span className="text-xs text-gray-400 print:text-gray-600 block">Camisetas a Fabricar</span>
                  <span className="text-xl font-bold text-blue-400 print:text-blue-700">
                    {reportData.totalShirtsCount} piezas
                  </span>
                </div>
                <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                  <span className="text-xs text-gray-400 print:text-gray-600 block">Familias Registradas</span>
                  <span className="text-xl font-bold text-purple-400 print:text-purple-700">
                    {reportData.totalOrders} familias
                  </span>
                </div>
              </div>

              {/* TABLERO DE PRODUCCIÓN POR TALLA */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white print:text-black border-b border-gray-700 print:border-gray-300 pb-2">Desglose Técnico para Producción (Proveedor)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                  <div>
                    <h4 className="text-sm font-bold bg-blue-900/50 print:bg-blue-100 text-blue-300 print:text-blue-900 px-4 py-2 rounded-t-lg border border-gray-700 print:border-gray-300">Niños</h4>
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {KIDS_SIZES.map(size => {
                          const row = reportData.sizeBreakdown[size];
                          return (
                            <tr key={size} className="border-b border-gray-700/50 print:border-gray-200">
                              <td className="py-2.5 px-4 font-medium text-gray-300 print:text-black">Talla {size}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-white print:text-black">{row.quantity} <span className="text-xs font-normal text-gray-400 print:text-gray-600">pzs</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold bg-purple-900/50 print:bg-purple-100 text-purple-300 print:text-purple-900 px-4 py-2 rounded-t-lg border border-gray-700 print:border-gray-300">Adultos</h4>
                    <table className="w-full text-sm border-collapse">
                      <tbody>
                        {ADULT_SIZES.map(size => {
                          const row = reportData.sizeBreakdown[size];
                          return (
                            <tr key={size} className="border-b border-gray-700/50 print:border-gray-200">
                              <td className="py-2.5 px-4 font-medium text-gray-300 print:text-black">Talla {size}</td>
                              <td className="py-2.5 px-4 text-right font-bold text-white print:text-black">{row.quantity} <span className="text-xs font-normal text-gray-400 print:text-gray-600">pzs</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: LISTA DE DISTRIBUCIÓN POR FAMILIA */}
            <div className="print:break-before-page pt-8">
              <div className="border-b border-gray-700 print:border-gray-300 pb-4 mb-6">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 print:text-emerald-700">Checklist para Día de Entrega</span>
                <h3 className="text-2xl font-black text-white print:text-black">Lista de Distribución por Familia</h3>
                <p className="text-xs text-gray-400 print:text-gray-600">Marca las casillas al entregar o imprime los recibos de las familias liquidadas.</p>
              </div>

              {reportData.familiesList.length === 0 ? (
                <p className="text-gray-400 text-sm">No hay pedidos registrados.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
                  {reportData.familiesList.map((family, idx) => (
                    <div key={family.id} className="border border-gray-700 print:border-gray-300 rounded-xl p-4 flex flex-col justify-between break-inside-avoid">
                      
                      <div className="flex justify-between items-start mb-3 border-b border-gray-700 print:border-gray-200 pb-2">
                        <h4 className="text-lg font-bold text-white print:text-black">
                          {idx + 1}. Fam. {family.family_name}
                        </h4>
                        
                        {/* ESTADO DE PAGO Y BOTÓN DE RECIBO */}
                        {family.is_fully_paid ? (
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="bg-emerald-500/20 print:bg-transparent text-emerald-400 print:text-black border border-emerald-500/30 print:border-emerald-700 px-2 py-0.5 rounded text-xs font-bold">
                              ✓ PAGADO
                            </span>
                            <button
                              onClick={() => setReceiptFamily(family)}
                              className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 px-2 py-1 rounded text-xs font-bold transition print:hidden"
                            >
                              📄 Recibo
                            </button>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="bg-amber-500/20 print:bg-transparent text-amber-400 print:text-black border border-amber-500/30 print:border-amber-700 px-2 py-1 rounded text-xs font-bold block mb-1">
                              ⚠ SALDO PENDIENTE
                            </span>
                            <span className="text-xs font-bold text-white print:text-black">
                              Cobrar: ${(family.total_amount - family.amount_paid).toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 mb-4">
                        <p className="text-xs font-semibold text-gray-400 print:text-gray-500 mb-2">Entregar las siguientes piezas:</p>
                        {family.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm text-gray-300 print:text-black">
                            <span><span className="font-bold text-blue-400 print:text-black">{item.quantity}x</span> Talla {item.size}</span>
                          </div>
                        ))}
                      </div>

                      {/* Checkbox Digital Interactivo y para Papel */}
                      <div 
                        onClick={() => setDeliveryModalFamily({
                          id: family.id, 
                          family_name: family.family_name, 
                          is_delivered: family.is_delivered
                        })}
                        className="mt-auto pt-4 border-t border-gray-700 print:border-gray-200 flex items-center gap-3 text-sm cursor-pointer select-none group"
                      >
                        <div className={`w-6 h-6 flex items-center justify-center rounded border-2 transition-all print:border-black print:bg-transparent print:text-transparent
                          ${family.is_delivered 
                            ? 'bg-emerald-500 border-emerald-500 text-white' 
                            : 'border-gray-500 group-hover:border-blue-400 text-transparent'}`}
                        >
                          <span className="text-sm font-bold print:hidden">✓</span>
                        </div>
                        <span className={`font-semibold print:text-gray-600 print:font-normal transition-colors
                          ${family.is_delivered ? 'text-emerald-400' : 'text-gray-400 group-hover:text-blue-300'}`}
                        >
                          {family.is_delivered ? '¡Entregado correctamente!' : 'Marcar como entregado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </main>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ENTREGA */}
      {deliveryModalFamily && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn print:hidden">
          <div className="bg-gray-800 border border-gray-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border ${
              deliveryModalFamily.is_delivered 
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            }`}>
              {deliveryModalFamily.is_delivered ? '↩️' : '📦'}
            </div>

            <h3 className="text-lg font-bold text-white">
              {deliveryModalFamily.is_delivered ? '¿Deshacer entrega?' : '¿Confirmar entrega?'}
            </h3>

            <p className="text-xs text-gray-300 leading-relaxed">
              {deliveryModalFamily.is_delivered 
                ? (<span>Estás a punto de marcar el pedido de la familia <strong className="text-white text-sm">{deliveryModalFamily.family_name}</strong> como <strong>NO ENTREGADO</strong>.</span>)
                : (<span>Estás a punto de registrar que la familia <strong className="text-white text-sm">{deliveryModalFamily.family_name}</strong> ha recibido físicamente todas sus prendas.</span>)
              }
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeliveryModalFamily(null)}
                className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg text-xs font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmToggleDelivery}
                className={`w-1/2 py-2.5 rounded-lg text-xs font-bold shadow-lg transition ${
                  deliveryModalFamily.is_delivered 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30' 
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                }`}
              >
                {deliveryModalFamily.is_delivered ? 'Sí, deshacer' : 'Sí, entregar'}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}