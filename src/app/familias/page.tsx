'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getFamiliesDirectory, addPaymentToOrder, cancelFamilyOrder, addItemToExistingOrder, removeItemFromExistingOrder } from '../actions/orders';
import { KIDS_SIZES, ADULT_SIZES, SHIRT_PRICES, ShirtSize } from '../../lib/constants';

interface OrderItem {
  id: string;
  size: ShirtSize;
  quantity: number;
  unit_price: number;
}

interface FamilyOrder {
  id: string;
  family_name: string;
  total_amount: number;
  amount_paid: number;
  is_fully_paid: boolean;
  status: 'ACTIVE' | 'CANCELLED';
  created_at: string;
  order_items: OrderItem[];
}

export default function FamiliasDirectoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<FamilyOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<FamilyOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [churchId, setChurchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ESTADOS PARA MODALES ELEGANTES (Sustituyendo alertas del navegador)
  const [activeAbonoOrder, setActiveAbonoOrder] = useState<FamilyOrder | null>(null);
  const [abonoAmount, setAbonoAmount] = useState('');
  
  const [activeEditOrder, setActiveEditOrder] = useState<FamilyOrder | null>(null);
  const [newShirtSize, setNewShirtSize] = useState<ShirtSize>('M');
  const [newShirtQty, setNewShirtQty] = useState<number>(1);

  const [orderToCancel, setOrderToCancel] = useState<FamilyOrder | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const sId = localStorage.getItem('current_session_id');
    const cId = localStorage.getItem('current_church_id');

    if (!sId || !cId) {
      router.push('/login');
      return;
    }

    setSessionId(sId);
    setChurchId(cId);
    loadDirectory(cId);
  }, [router]);

  async function loadDirectory(cId: string) {
    setLoading(true);
    const res = await getFamiliesDirectory(cId);
    if (res.success && res.data) {
      setOrders(res.data as FamilyOrder[]);
      setFilteredOrders(res.data as FamilyOrder[]);
      
      // Si tenemos un modal de edición abierto, actualizamos su información en vivo
      if (activeEditOrder) {
        const updatedOrder = (res.data as FamilyOrder[]).find(o => o.id === activeEditOrder.id);
        if (updatedOrder) setActiveEditOrder(updatedOrder);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    const results = orders.filter(o => 
      o.family_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredOrders(results);
  }, [searchTerm, orders]);

  // Ejecutar Abono
  const handleRegisterAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAbonoOrder || !sessionId || !churchId) return;

    const amount = parseFloat(abonoAmount);
    if (isNaN(amount) || amount <= 0) return;

    setProcessing(true);
    const res = await addPaymentToOrder(activeAbonoOrder.id, sessionId, amount);
    if (res.success) {
      setActiveAbonoOrder(null);
      setAbonoAmount('');
      loadDirectory(churchId);
    }
    setProcessing(false);
  };

  // Ejecutar Agregar Camiseta a Pedido Existente
  const handleAddShirtToExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEditOrder || !churchId) return;

    setProcessing(true);
    const res = await addItemToExistingOrder(activeEditOrder.id, newShirtSize, newShirtQty);
    if (res.success) {
      setNewShirtQty(1);
      loadDirectory(churchId);
    }
    setProcessing(false);
  };

  // Ejecutar Eliminar Camiseta de Pedido Existente
  const handleRemoveShirtFromExisting = async (itemId: string) => {
    if (!activeEditOrder || !churchId) return;
    setProcessing(true);
    await removeItemFromExistingOrder(itemId, activeEditOrder.id);
    loadDirectory(churchId);
    setProcessing(false);
  };

  // Ejecutar Cancelación Definitiva
  const handleConfirmCancel = async () => {
    if (!orderToCancel || !churchId) return;
    setProcessing(true);
    await cancelFamilyOrder(orderToCancel.id);
    setOrderToCancel(null);
    loadDirectory(churchId);
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-800 p-6 rounded-2xl border border-gray-700">
          <div>
            <h1 className="text-xl font-bold text-white">Catálogo General de Familias</h1>
            <p className="text-xs text-gray-400">Control total: abonos, modificación de prendas y cancelaciones</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            ⬅ Volver a Cobro Rápido
          </button>
        </header>

        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          <input
            type="text"
            placeholder="🔍 Buscar familia por apellidos (Ej. Espinoza Diaz)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Cargando catálogo de familias...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-20 text-gray-500 bg-gray-800 rounded-2xl border border-gray-700">
            No se encontraron familias registradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredOrders.map((order) => {
              const saldoPendiente = order.total_amount - order.amount_paid;
              const isCancelled = order.status === 'CANCELLED';

              return (
                <div 
                  key={order.id} 
                  className={`p-6 rounded-2xl border transition flex flex-col justify-between ${
                    isCancelled 
                      ? 'bg-gray-900/40 border-red-900/30 opacity-60' 
                      : order.is_fully_paid 
                        ? 'bg-gray-800 border-emerald-500/30' 
                        : 'bg-gray-800 border-amber-500/40'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          {order.family_name}
                        </h3>
                        <span className="text-xs text-gray-400">
                          Registrado: {new Date(order.created_at).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      
                      {isCancelled ? (
                        <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
                          🚫 CANCELADO
                        </span>
                      ) : order.is_fully_paid ? (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
                          ✓ LIQUIDADO
                        </span>
                      ) : (
                        <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full text-xs font-bold">
                          ⏳ SALDO PENDIENTE
                        </span>
                      )}
                    </div>

                    <div className="bg-gray-900/60 p-3 rounded-xl border border-gray-700/50 my-4 space-y-1 text-xs">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-gray-400 font-semibold">Prendas encargadas:</span>
                        {!isCancelled && (
                          <button
                            onClick={() => setActiveEditOrder(order)}
                            className="text-blue-400 hover:underline font-bold text-xs"
                          >
                            ✏️ Editar Prendas
                          </button>
                        )}
                      </div>
                      {order.order_items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-gray-300">
                          <span>{item.quantity}x Camisa Talla <strong className="text-white">{item.size}</strong></span>
                          <span>${item.quantity * item.unit_price}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-gray-700/60 pt-4 mt-2">
                    <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4 bg-gray-900 p-2 rounded-lg">
                      <div>
                        <span className="text-gray-400 block">Total</span>
                        <span className="font-bold text-white">${order.total_amount}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Abonado</span>
                        <span className="font-bold text-emerald-400">${order.amount_paid}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Por Pagar</span>
                        <span className={`font-bold ${saldoPendiente > 0 ? 'text-amber-400' : 'text-gray-400'}`}>
                          ${saldoPendiente > 0 ? saldoPendiente : 0}
                        </span>
                      </div>
                    </div>

                    {!isCancelled && (
                      <div className="flex gap-2">
                        {!order.is_fully_paid && (
                          <button
                            onClick={() => setActiveAbonoOrder(order)}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-xs transition shadow"
                          >
                            ➕ Registrar Abono
                          </button>
                        )}
                        <button
                          onClick={() => setOrderToCancel(order)}
                          className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white px-3 py-2 rounded-lg text-xs font-medium border border-red-500/20 transition"
                        >
                          Cancelar Pedido
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 1: EDITAR / AGREGAR / ELIMINAR CAMISETAS DE UN PEDIDO */}
      {/* -------------------------------------------------------------------------- */}
      {activeEditOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-gray-700 pb-3">
              <h3 className="text-lg font-bold text-white">Modificar Camisetas: {activeEditOrder.family_name}</h3>
              <button onClick={() => setActiveEditOrder(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {/* Lista actual con botón para eliminar fila individual */}
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              <p className="text-xs text-gray-400 font-medium">Prendas actuales en este encargo:</p>
              {activeEditOrder.order_items.map((item) => (
                <div key={item.id} className="flex justify-between items-center bg-gray-900 p-2.5 rounded-lg border border-gray-700 text-xs">
                  <div>
                    <span className="font-bold text-blue-400">{item.quantity}x</span> Talla <strong className="text-white">{item.size}</strong> (${item.unit_price} c/u)
                  </div>
                  <button
                    disabled={processing}
                    onClick={() => handleRemoveShirtFromExisting(item.id)}
                    className="bg-red-500/20 text-red-400 hover:bg-red-600 hover:text-white px-2 py-1 rounded text-xs transition"
                    title="Quitar esta talla"
                  >
                    🗑️ Quitar
                  </button>
                </div>
              ))}
            </div>

            {/* Formulario para agregar nueva talla al pedido */}
            <form onSubmit={handleAddShirtToExisting} className="bg-gray-900 p-4 rounded-xl border border-gray-700 space-y-3">
              <p className="text-xs text-emerald-400 font-medium">+ Agregar otra talla a esta familia:</p>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <select
                    value={newShirtSize}
                    onChange={(e) => setNewShirtSize(e.target.value as ShirtSize)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-white"
                  >
                    <optgroup label="👦 Niños ($150)">
                      {KIDS_SIZES.map(s => <option key={s} value={s}>Talla {s} — $150</option>)}
                    </optgroup>
                    <optgroup label="👨 Adultos">
                      {ADULT_SIZES.map(s => <option key={s} value={s}>Talla {s} — ${SHIRT_PRICES[s]}</option>)}
                    </optgroup>
                  </select>
                </div>
                <div>
                  <input
                    type="number"
                    min="1"
                    value={newShirtQty}
                    onChange={(e) => setNewShirtQty(parseInt(e.target.value) || 1)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-xs text-white text-center"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 rounded-lg text-xs transition shadow"
              >
                {processing ? 'Actualizando...' : '+ Añadir y Recalcular Saldo'}
              </button>
            </form>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setActiveEditOrder(null)}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-xs font-semibold"
              >
                Cerrar Ventana
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 2: REGISTRAR ABONO (Elegante) */}
      {/* -------------------------------------------------------------------------- */}
      {activeAbonoOrder && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white text-center">
              Abonar a Familia {activeAbonoOrder.family_name}
            </h3>
            
            <div className="bg-gray-900 p-3 rounded-lg text-xs space-y-1 text-center">
              <p className="text-gray-400">Deuda actual pendiente:</p>
              <p className="text-xl font-bold text-amber-400">
                ${activeAbonoOrder.total_amount - activeAbonoOrder.amount_paid} MXN
              </p>
            </div>

            <form onSubmit={handleRegisterAbono} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Monto que entrega en efectivo hoy ($):
                </label>
                <input
                  type="number"
                  step="0.50"
                  max={activeAbonoOrder.total_amount - activeAbonoOrder.amount_paid}
                  required
                  autoFocus
                  value={abonoAmount}
                  onChange={(e) => setAbonoAmount(e.target.value)}
                  placeholder="Ej. 100"
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white text-center font-bold text-lg focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAbonoOrder(null)}
                  className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-emerald-600/30"
                >
                  {processing ? 'Guardando...' : '✓ Aplicar Abono'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------------- */}
      {/* MODAL 3: CONFIRMACIÓN DE CANCELACIÓN Y DEVOLUCIÓN DE EFECTIVO */}
      {/* -------------------------------------------------------------------------- */}
      {orderToCancel && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-800 border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            
            <div className="w-12 h-12 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            
            <h3 className="text-lg font-bold text-white">¿Cancelar Pedido?</h3>
            
            <p className="text-xs text-gray-300">
              Estás a punto de cancelar el encargo de la familia <strong className="text-white text-sm">{orderToCancel.family_name}</strong>. Las prendas se eliminarán inmediatamente de la orden de producción.
            </p>

            {/* ALERTA INTELIGENTE DE DEVOLUCIÓN DE DINERO */}
            {orderToCancel.amount_paid > 0 ? (
              <div className="bg-amber-500/10 border-2 border-amber-500/80 rounded-xl p-4 my-2 text-left space-y-1">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                  <span>💵 DEVOLUCIÓN DE EFECTIVO REQUERIDA</span>
                </div>
                <p className="text-xs text-gray-300">
                  Esta familia tenía un abono registrado. Al cancelar, debes entregarles en mano la cantidad de:
                </p>
                <div className="text-2xl font-black text-amber-400 text-center py-1 bg-gray-900/80 rounded-lg mt-2 border border-amber-500/30">
                  ${orderToCancel.amount_paid} MXN
                </div>
              </div>
            ) : (
              <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3 text-xs text-gray-400">
                ✓ Esta familia no había dado ningún abono en efectivo ($0 MXN). No se requiere devolución.
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setOrderToCancel(null)}
                className="w-1/2 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg text-xs font-semibold transition"
              >
                Regresar
              </button>
              <button
                type="button"
                disabled={processing}
                onClick={handleConfirmCancel}
                className="w-1/2 bg-red-600 hover:bg-red-500 text-white py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-red-600/30 transition disabled:opacity-50"
              >
                {processing ? 'Cancelando...' : 'Sí, Cancelar Pedido'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}