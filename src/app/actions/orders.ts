'use server';

import { supabase } from '../../lib/supabase';
import { SHIRT_PRICES, OrderItemInput, ShirtSize } from '../../lib/constants';

interface CreateOrderPayload {
  sessionId: string;
  churchId: string;
  familyName: string;
  amountPaid: number;
  items: OrderItemInput[];
}

export async function createFamilyOrder(payload: CreateOrderPayload) {
  const { sessionId, churchId, familyName, amountPaid, items } = payload;

  if (!familyName.trim() || items.length === 0) {
    return { success: false, error: 'Datos del pedido incompletos o vacíos.' };
  }

  // 1. Calcular el total real en el servidor usando nuestra matriz estricta
  let totalAmount = 0;
  const itemsWithPrices = items.map(item => {
    const unitPrice = SHIRT_PRICES[item.size];
    const subtotal = unitPrice * item.quantity;
    totalAmount += subtotal;

    return {
      size: item.size,
      quantity: item.quantity,
      unit_price: unitPrice
    };
  });

  // 2. Insertar la cabecera del pedido (Tabla: orders)
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([{
      session_id: sessionId,
      church_id: churchId,
      family_name: familyName.trim(),
      total_amount: totalAmount,
      amount_paid: amountPaid
    }])
    .select()
    .single();

  if (orderError || !orderData) {
    return { success: false, error: `Error al crear el pedido: ${orderError?.message || 'Unknown error'}` };
  }

  // 3. Preparar los artículos vinculándolos al ID del pedido recién creado
  const orderItemsToInsert = itemsWithPrices.map(item => ({
    order_id: orderData.id,
    size: item.size,
    quantity: item.quantity,
    unit_price: item.unit_price
  }));

  // 4. Insertar los artículos en lote (Tabla: order_items)
  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsToInsert);

  if (itemsError) {
    // Si falla el detalle, idealmente querrías borrar la cabecera para no dejar datos huérfanos
    await supabase.from('orders').delete().eq('id', orderData.id);
    return { success: false, error: `Error al guardar los detalles: ${itemsError.message}` };
  }

  return { success: true, orderId: orderData.id };
}

// 1. Consultar directorio de familias de la iglesia actual
export async function getFamiliesDirectory(churchId: string) {
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      family_name,
      total_amount,
      amount_paid,
      is_fully_paid,
      status,
      created_at,
      order_items (id, size, quantity, unit_price) 
    `) // <--- ¡AQUÍ AGREGAMOS "id," ANTES DE SIZE!
    .eq('church_id', churchId)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// 2. Registrar un abono a un pedido anterior en el turno ACTUAL
export async function addPaymentToOrder(orderId: string, currentSessionId: string, amountToAdd: number) {
  if (amountToAdd <= 0) return { success: false, error: 'El monto debe ser mayor a 0.' };

  // A) Insertar el registro en el historial de pagos del turno actual
  const { error: paymentError } = await supabase
    .from('order_payments')
    .insert([{
      order_id: orderId,
      session_id: currentSessionId,
      amount: amountToAdd
    }]);

  if (paymentError) return { success: false, error: `Error registrando abono: ${paymentError.message}` };

  // B) Obtener el total pagado hasta ahora en el pedido
  const { data: orderData } = await supabase
    .from('orders')
    .select('amount_paid')
    .eq('id', orderId)
    .single();

  const newTotalPaid = Number(orderData?.amount_paid || 0) + amountToAdd;

  // C) Actualizar el pedido general
  const { error: updateError } = await supabase
    .from('orders')
    .update({ amount_paid: newTotalPaid })
    .eq('id', orderId);

  if (updateError) return { success: false, error: `Error actualizando saldo: ${updateError.message}` };

  return { success: true };
}

// 3. Cancelar un encargo de camisetas
export async function cancelFamilyOrder(orderId: string) {
  // 1. Borrar los registros del historial de pagos de este pedido para limpiar la caja
  await supabase
    .from('order_payments')
    .delete()
    .eq('order_id', orderId);

  // 2. Marcar como cancelado y poner el dinero abonado en 0
  const { error } = await supabase
    .from('orders')
    .update({ 
      status: 'CANCELLED',
      amount_paid: 0 
    })
    .eq('id', orderId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Función interna para recalcular el costo total de un pedido según sus ítems actuales
async function recalculateOrderTotal(orderId: string) {
  const { data: items } = await supabase
    .from('order_items')
    .select('subtotal')
    .eq('order_id', orderId);

  const newTotal = (items || []).reduce((sum, item) => sum + Number(item.subtotal), 0);

  await supabase
    .from('orders')
    .update({ total_amount: newTotal })
    .eq('id', orderId);
}

// 4. Agregar una nueva playera a un pedido que ya existía
export async function addItemToExistingOrder(orderId: string, size: ShirtSize, quantity: number) {
  if (quantity <= 0) return { success: false, error: 'La cantidad debe ser mayor a 0.' };

  const unitPrice = SHIRT_PRICES[size];

  // Verificamos si la familia ya tenía esa misma talla para sumársela
  const { data: existingItem } = await supabase
    .from('order_items')
    .select('id, quantity')
    .eq('order_id', orderId)
    .eq('size', size)
    .maybeSingle();

  if (existingItem) {
    await supabase
      .from('order_items')
      .update({ quantity: existingItem.quantity + quantity })
      .eq('id', existingItem.id);
  } else {
    await supabase
      .from('order_items')
      .insert([{ order_id: orderId, size, quantity, unit_price: unitPrice }]);
  }

  await recalculateOrderTotal(orderId);
  return { success: true };
}

// 5. Eliminar (o restar) una playera de un pedido existente
export async function removeItemFromExistingOrder(itemId: string, orderId: string) {
  if (!itemId) return { success: false, error: 'ID de camiseta no encontrado.' };

  // 1. Buscamos cuántas playeras tiene esta fila actualmente
  const { data: currentItem } = await supabase
    .from('order_items')
    .select('quantity')
    .eq('id', itemId)
    .single();

  if (!currentItem) return { success: false, error: 'Prenda no encontrada.' };

  if (currentItem.quantity > 1) {
    // Si hay más de 1, le restamos una pieza
    await supabase
      .from('order_items')
      .update({ quantity: currentItem.quantity - 1 })
      .eq('id', itemId);
  } else {
    // Si queda exactamente 1, borramos la fila completa
    await supabase
      .from('order_items')
      .delete()
      .eq('id', itemId);
  }

  // Recalculamos automáticamente el dinero total de la familia en base de datos
  await recalculateOrderTotal(orderId);
  return { success: true };
}

export async function toggleOrderDelivered(orderId: string, currentStatus: boolean) {
  const { error } = await supabase
    .from('orders')
    .update({ is_delivered: !currentStatus })
    .eq('id', orderId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}