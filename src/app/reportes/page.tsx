'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { getConsolidatedReport, ReportSummary } from '../actions/reports';
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

export default function ReportesPage() {
  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedChurch, setSelectedChurch] = useState<string>('');
  
  const [sessions, setSessions] = useState<SessionOption[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Cargar la lista de iglesias al abrir la página
  useEffect(() => {
    async function loadChurches() {
      const { data } = await supabase.from('churches').select('id, name').order('name');
      if (data && data.length > 0) {
        setChurches(data);
        setSelectedChurch(data[0].id);
      }
    }
    loadChurches();
  }, []);

  // 2. Cargar los turnos/cajas cada vez que cambia la iglesia seleccionada
  useEffect(() => {
    if (!selectedChurch) return;
    async function loadSessions() {
      const { data } = await supabase
        .from('cash_sessions')
        .select('id, opened_at, status, total_collected')
        .eq('church_id', selectedChurch)
        .order('opened_at', { ascending: false });

      if (data) {
        setSessions(data);
        setSelectedSession('ALL'); // Por defecto ver el consolidado general de esa iglesia
      }
    }
    loadSessions();
  }, [selectedChurch]);

  // 3. Generar el reporte exacto en el servidor cuando cambien los filtros
  useEffect(() => {
    if (!selectedChurch) return;
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

  const currentChurchName = churches.find(c => c.id === selectedChurch)?.name || 'Iglesia';

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 print:bg-white print:text-black print:p-0">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* PANEL DE FILTROS (Se oculta al imprimir) */}
        <header className="bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4 print:hidden">
          <div>
            <h1 className="text-xl font-bold text-white">Módulo de Reportes y Auditoría</h1>
            <p className="text-sm text-gray-400">Consolidado exacto de caja y producción de camisetas</p>
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Iglesia</label>
              <select
                value={selectedChurch}
                onChange={(e) => setSelectedChurch(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                {churches.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">Corte / Sesión</label>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="ALL">📦 Todas las Sesiones (Histórico)</option>
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
              🖨️ Imprimir / PDF
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
          /* ÁREA DEL REPORTE IMPRIMIBLE */
          <main className="bg-gray-800 p-8 rounded-2xl border border-gray-700 print:bg-white print:border-none print:shadow-none space-y-8">
            
            {/* Encabezado del documento impreso */}
            <div className="border-b border-gray-700 print:border-gray-300 pb-6 flex justify-between items-end">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 print:text-blue-700">Orden de Producción y Corte</span>
                <h2 className="text-2xl font-black text-white print:text-black">{currentChurchName}</h2>
                <p className="text-xs text-gray-400 print:text-gray-600 mt-1">
                  Fecha de Emisión: {new Date().toLocaleString('es-MX', { dateStyle: 'full', timeStyle: 'short' })}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-400 print:text-gray-600 block">Filtro Aplicado:</span>
                <span className="text-sm font-bold print:text-black">
                  {selectedSession === 'ALL' ? 'Acumulado Histórico General' : 'Turno de Caja Específico'}
                </span>
              </div>
            </div>

            {/* TARJETAS KPI FINANCIERAS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
              <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                <span className="text-xs text-gray-400 print:text-gray-600 block">Total Recaudado (Efectivo)</span>
                <span className="text-xl font-bold text-emerald-400 print:text-emerald-700">
                  ${reportData.totalMoneyCollected.toLocaleString('es-MX')} MXN
                </span>
              </div>

              <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                <span className="text-xs text-gray-400 print:text-gray-600 block">Total Esperado (Catálogo)</span>
                <span className="text-xl font-bold text-white print:text-black">
                  ${reportData.totalExpectedRevenue.toLocaleString('es-MX')} MXN
                </span>
              </div>

              <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                <span className="text-xs text-gray-400 print:text-gray-600 block">Camisetas Encargadas</span>
                <span className="text-xl font-bold text-blue-400 print:text-blue-700">
                  {reportData.totalShirtsCount} piezas
                </span>
              </div>

              <div className="bg-gray-900 print:bg-gray-100 p-4 rounded-xl border border-gray-700 print:border-gray-300">
                <span className="text-xs text-gray-400 print:text-gray-600 block">Familias Atendidas</span>
                <span className="text-xl font-bold text-purple-400 print:text-purple-700">
                  {reportData.totalOrders} familias
                </span>
              </div>
            </div>

            {/* TABLERO DE PRODUCCIÓN POR TALLA (Para el Fabricante) */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white print:text-black">Desglose Técnico para Producción</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                
                {/* TABLA 1: NIÑOS */}
                <div>
                  <h4 className="text-sm font-bold bg-blue-900/50 print:bg-blue-100 text-blue-300 print:text-blue-900 px-4 py-2 rounded-t-lg border border-gray-700 print:border-gray-300">
                    👦 Categoría Niños ($150 MXN)
                  </h4>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {KIDS_SIZES.map(size => {
                        const row = reportData.sizeBreakdown[size];
                        return (
                          <tr key={size} className="border-b border-gray-700/50 print:border-gray-200">
                            <td className="py-2.5 px-4 font-medium text-gray-300 print:text-black">Talla {size}</td>
                            <td className="py-2.5 px-4 text-right font-bold text-white print:text-black">
                              {row.quantity} <span className="text-xs font-normal text-gray-400 print:text-gray-600">pzs</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* TABLA 2: ADULTOS */}
                <div>
                  <h4 className="text-sm font-bold bg-purple-900/50 print:bg-purple-100 text-purple-300 print:text-purple-900 px-4 py-2 rounded-t-lg border border-gray-700 print:border-gray-300">
                    👨 Categoría Adultos ($150 - $250 MXN)
                  </h4>
                  <table className="w-full text-sm border-collapse">
                    <tbody>
                      {ADULT_SIZES.map(size => {
                        const row = reportData.sizeBreakdown[size];
                        return (
                          <tr key={size} className="border-b border-gray-700/50 print:border-gray-200">
                            <td className="py-2.5 px-4 font-medium text-gray-300 print:text-black">
                              Talla {size} <span className="text-xs text-gray-500">(${SHIRT_PRICES[size]})</span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-white print:text-black">
                              {row.quantity} <span className="text-xs font-normal text-gray-400 print:text-gray-600">pzs</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            {/* Pie de firma para auditoría impresa */}
            <div className="hidden print:flex justify-between items-center pt-16 mt-16 border-t border-gray-300 text-xs text-gray-600">
              <div className="text-center w-64 border-t border-black pt-2">
                Firma del Operador / Cajero
              </div>
              <div className="text-center w-64 border-t border-black pt-2">
                Firma de Auditoría / Tesorería
              </div>
            </div>

          </main>
        )}

      </div>
    </div>
  );
}