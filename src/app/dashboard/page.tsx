'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { KIDS_SIZES, ADULT_SIZES, SHIRT_PRICES, ShirtSize, OrderItemInput } from '../../lib/constants';
import { createFamilyOrder } from '../actions/orders';
import { closeCashSession } from '../actions/sessions';

export default function DashboardPage() {
  const router = useRouter();
  
  // Estados de sesión e iglesia
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState<string>('');

  // Estados del Formulario de Pedido
  const [familyName, setFamilyName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [currentItems, setCurrentItems] = useState<OrderItemInput[]>([]);

  // Estado auxiliar para la playera que se está seleccionando en el momento
  const [selectedSize, setSelectedSize] = useState<ShirtSize>('M');
  const [selectedQty, setSelectedQty] = useState<number>(1);

  // Estados de UI y Modales
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingShift, setClosingShift] = useState(false);

  useEffect(() => {
    // Recuperar datos del turno activo
    const storedSession = localStorage.getItem('current_session_id');
    const storedChurch = localStorage.getItem('current_church_id');

    if (!storedSession || !storedChurch) {
      router.push('/login');
      return;
    }

    setSessionId(storedSession);
    setChurchId(storedChurch);

    // Obtener nombre del operador autenticado
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setOperatorName(user.email || 'Operador');
    });
  }, [router]);

  // Calcular el total en tiempo real de lo que se está armando en la pantalla
  const orderTotal = currentItems.reduce((sum, item) => sum + (SHIRT_PRICES[item.size] * item.quantity), 0);

  // Agregar una playera a la lista temporal de la familia actual (Sumando de 1 en 1 sin duplicar saltos)
  const addItemToTempList = () => {
    const qtyToAdd = Number(selectedQty);
    if (isNaN(qtyToAdd) || qtyToAdd <= 0) return;

    setCurrentItems((prevItems) => {
      const existingIndex = prevItems.findIndex((item) => item.size === selectedSize);
      
      if (existingIndex > -1) {
        const updatedList = [...prevItems];
        updatedList[existingIndex] = {
          ...updatedList[existingIndex],
          quantity: updatedList[existingIndex].quantity + qtyToAdd
        };
        return updatedList;
      }

      return [...prevItems, { size: selectedSize, quantity: qtyToAdd }];
    });

    // Forzamos que la cajita de cantidad vuelva a 1 para el siguiente clic
    setSelectedQty(1);
  };

  // Quitar una playera de la lista temporal (Restando de 1 en 1 inteligentemente)
  const removeItemFromTempList = (indexToRemove: number) => {
    setCurrentItems((prevItems) => {
      const item = prevItems[indexToRemove];
      
      // Si la fila tiene más de 1 playera, le restamos exactamente 1
      if (item.quantity > 1) {
        const updatedList = [...prevItems];
        updatedList[indexToRemove] = {
          ...updatedList[indexToRemove],
          quantity: updatedList[indexToRemove].quantity - 1
        };
        return updatedList;
      }

      // Si queda exactamente 1, borramos toda la fila
      return prevItems.filter((_, i) => i !== indexToRemove);
    });
  };

  // Enviar pedido completo al servidor (Base de datos)
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !churchId) return;
    if (currentItems.length === 0) {
      setMessage({ type: 'error', text: 'Debes agregar al menos una camiseta al pedido.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);

    const res = await createFamilyOrder({
      sessionId,
      churchId,
      familyName,
      amountPaid: parseFloat(amountPaid) || 0,
      items: currentItems
    });

    if (res.success) {
      setMessage({ type: 'success', text: `¡Pedido de la Familia ${familyName} guardado con éxito!` });
      setFamilyName('');
      setAmountPaid('');
      setCurrentItems([]);
    } else {
      setMessage({ type: 'error', text: res.error || 'Error al guardar el pedido.' });
    }
    setSubmitting(false);
  };

  // Acción definitiva para el corte de caja / fin del día (Sin window.confirm)
  const handleConfirmCloseShift = async () => {
    if (!sessionId) return;
    setClosingShift(true);

    const res = await closeCashSession(sessionId);
    if (res.success) {
      localStorage.clear();
      router.push('/login');
    } else {
      setMessage({ type: 'error', text: `Error al cerrar turno: ${res.error}` });
      setShowCloseModal(false);
      setClosingShift(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 relative">
      {/* HEADER DE CONTROL */}
      <header className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center bg-gray-800 p-4 rounded-xl border border-gray-700 mb-8 gap-4">
        <div>
          <p className="text-xs text-gray-400">Usuario Activo: <span className="text-gray-200 font-medium">{operatorName}</span></p>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Registro Activo de Camisetas
          </h1>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCloseModal(true)}
            className="bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white px-4 py-2 rounded-lg font-medium border border-red-500/30 transition text-sm"
          >
            Realizar Corte de Caja (Cerrar Turno)
          </button>
          <button
            onClick={() => router.push('/familias')}
            className="bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg font-medium border border-blue-500/30 transition text-sm"
          >
            Directorio de Familias / Abonos
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMNA IZQUIERDA: CAPTURA Y AGREGADO (7 columnas) */}
        <div className="lg:col-span-7 bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-6">
          <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2">1. Detalles del Pedido</h2>
          
          {message && (
            <div className={`p-4 rounded-lg text-sm font-medium text-center ${
              message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}>
              {message.text}
            </div>
          )}

          {/* Datos Generales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Apellidos de la Familia</label>
              <input
                type="text"
                placeholder="Ej. Espinoza Diaz"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Dinero Recibido (Abono/Pago)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-7 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Selector de Camisetas por Categoría */}
          <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-4">
            <h3 className="text-sm font-medium text-gray-300">Agregar Prenda</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Selecciona Talla</label>
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value as ShirtSize)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                >
                  <optgroup label="👦 Tallas de Niño ($150)">
                    {KIDS_SIZES.map(s => <option key={s} value={s}>Talla {s} — $150</option>)}
                  </optgroup>
                  <optgroup label="👨 Tallas de Adulto ($150 - $250)">
                    {ADULT_SIZES.map(s => (
                      <option key={s} value={s}>
                        Talla {s} — ${SHIRT_PRICES[s]}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(parseInt(e.target.value) || 1)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={addItemToTempList}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-lg shadow-blue-600/30"
            >
              + Añadir al Pedido de la Familia
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA: RESUMEN DEL PEDIDO ACTUAL (5 columnas) */}
        <div className="lg:col-span-5 bg-gray-800 p-6 rounded-2xl border border-gray-700 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white border-b border-gray-700 pb-2 mb-4">2. Resumen Actual</h2>
            
            {currentItems.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-12">No hay prendas agregadas a este encargo todavía.</p>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {currentItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-900 p-3 rounded-lg border border-gray-700 text-sm">
                    <div>
                      <span className="font-bold text-blue-400">x{item.quantity}</span> — Camiseta Talla <span className="text-white font-semibold">{item.size}</span>
                      <p className="text-xs text-gray-400">${SHIRT_PRICES[item.size]} c/u</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold text-white">${SHIRT_PRICES[item.size] * item.quantity}</span>
                      <button 
                        type="button"
                        onClick={() => removeItemFromTempList(idx)}
                        className="text-gray-500 hover:text-red-400 transition font-bold px-2 py-1 bg-gray-800 rounded border border-gray-700"
                        title="Restar 1 prenda o eliminar"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sección de Totales y Guardado */}
          <div className="border-t border-gray-700 pt-4 mt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total a pagar:</span>
              <span className="font-bold text-white text-lg">${orderTotal} MXN</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Monto abonado:</span>
              <span className="font-semibold text-emerald-400">${parseFloat(amountPaid) || 0} MXN</span>
            </div>
            
            <button
              onClick={handleSubmitOrder}
              disabled={submitting || !familyName.trim() || currentItems.length === 0}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-emerald-600/20 disabled:opacity-30 disabled:pointer-events-none"
            >
              {submitting ? 'Guardando Encargo...' : '✓ Guardar e Imprimir Conteo'}
            </button>
          </div>

        </div>
      </main>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL ELEGANTE PARA EL CORTE DE CAJA (Reemplaza a window.confirm) */}
      {/* -------------------------------------------------------------------------- */}
      {showCloseModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-gray-800 border border-amber-500/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-amber-500/20">
              🔒
            </div>
            <h3 className="text-lg font-bold text-white">¿Cerrar Turno del Día?</h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              Estás a punto de finalizar la sesión de caja en esta congregación. Ya no podrás registrar más pedidos o abonos bajo este turno y se generará el reporte final.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={closingShift}
                onClick={() => setShowCloseModal(false)}
                className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg text-xs font-semibold transition"
              >
                Regresar
              </button>
              <button
                type="button"
                disabled={closingShift}
                onClick={handleConfirmCloseShift}
                className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-amber-600/30 transition disabled:opacity-50"
              >
                {closingShift ? 'Cerrando...' : 'Sí, Cerrar Caja'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}