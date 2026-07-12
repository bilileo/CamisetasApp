'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { openCashSession } from '../actions/sessions';

interface AssignedChurch {
  id: string;
  name: string;
}

export default function AperturaTurnoPage() {
  const router = useRouter();
  const [assignedChurch, setAssignedChurch] = useState<AssignedChurch | null>(null);
  const [initialCash, setInitialCash] = useState<string>('0');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      // 1. Validar sesión del usuario
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserId(session.user.id);

      // 2. Consultar a qué iglesia está asignado este operador en estricto
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('church_id, churches(id, name)')
        .eq('id', session.user.id)
        .single();

      if (profileData && profileData.churches) {
        // @ts-ignore (Manejo de join simple de Supabase)
        const churchObj = Array.isArray(profileData.churches) ? profileData.churches[0] : profileData.churches;
        setAssignedChurch({ id: churchObj.id, name: churchObj.name });
      } else {
        setErrorMsg('Tu cuenta de usuario no tiene una iglesia asignada en el sistema. Consulta con el administrador.');
      }
      
      setLoading(false);
    }

    loadInitialData();
  }, [router]);

  const handleOpenTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !assignedChurch) return;

    setSubmitting(true);
    setErrorMsg(null);

    const cashValue = parseFloat(initialCash) || 0;
    const res = await openCashSession(assignedChurch.id, cashValue, userId);

    if (res.success && res.sessionId) {
      // Guardamos la sesión y su iglesia bloqueada en el navegador
      localStorage.setItem('current_session_id', res.sessionId);
      localStorage.setItem('current_church_id', assignedChurch.id);
      localStorage.setItem('current_church_name', assignedChurch.name);
      
      router.push('/dashboard');
    } else {
      setErrorMsg(res.error || 'Ocurrió un error inesperado al abrir la caja.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
        Verificando congregación asignada...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md rounded-2xl bg-gray-800 p-8 shadow-xl border border-gray-700">
        <h2 className="text-xl font-bold text-white text-center mb-6">
          Apertura de Turno / Caja
        </h2>

        {errorMsg && (
          <div className="mb-6 rounded bg-red-500/10 border border-red-500 p-4 text-sm text-red-400 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleOpenTurn} className="space-y-6">
          {/* SECCIÓN BLOQUEADA: CONGREGACIÓN ASIGNADA */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Cuenta asignada a Iglesia
            </label>
            {assignedChurch ? (
              <div className="w-full rounded-lg bg-gray-900 border border-blue-500/50 px-4 py-3.5 flex items-center justify-between">
                <span className="font-bold text-white text-md flex items-center gap-2">
                  - {assignedChurch.name}
                </span>
                <span className="text-xs bg-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full border border-blue-500/30 font-medium">
                  Bloqueado
                </span>
              </div>
            ) : (
              <div className="w-full rounded-lg bg-gray-900 border border-gray-700 p-4 text-sm text-gray-500 text-center">
                Sin congregación enlazada
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Fondo Inicial de Caja (Efectivo para cambio)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-3 text-gray-400">$</span>
              <input
                type="number"
                min="0"
                step="0.50"
                disabled={!assignedChurch}
                value={initialCash}
                onChange={(e) => setInitialCash(e.target.value)}
                className="w-full rounded-lg bg-gray-700 border border-gray-600 pl-8 pr-4 py-3 text-white focus:border-blue-500 focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Si empiezas de cero sin efectivo en caja, déjalo en 0.
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !assignedChurch}
            className="w-full rounded-lg bg-emerald-600 py-3.5 font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 disabled:opacity-30 disabled:pointer-events-none"
          >
            {submitting ? 'Abriendo turno...' : 'Comenzar a Registrar Pedidos'}
          </button>
        </form>
      </div>
    </div>
  );
}