'use server';

import { supabase } from '../../lib/supabase';

export async function openCashSession(churchId: string, initialCash: number, userId: string) {
  if (!churchId || !userId) {
    return { success: false, error: 'Faltan identificadores del operador o iglesia.' };
  }

  // Verificar si el operador ya tiene un turno abierto sin cerrar
  const { data: existingSession } = await supabase
    .from('cash_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'OPEN')
    .maybeSingle();

  if (existingSession) {
    // Si ya tenía uno abierto, devolvemos ese ID para que continúe trabajando sin duplicar
    return { success: true, sessionId: existingSession.id };
  }

  // Insertar nueva sesión de caja
  const { data, error } = await supabase
    .from('cash_sessions')
    .insert([{
      user_id: userId,
      church_id: churchId,
      initial_cash: initialCash,
      status: 'OPEN'
    }])
    .select('id')
    .single();

  if (error || !data) {
    return { success: false, error: `No se pudo abrir el turno: ${error?.message}` };
  }

  return { success: true, sessionId: data.id };
}

export async function closeCashSession(sessionId: string) {
  if (!sessionId) return { success: false, error: 'ID de sesión no provisto.' };

  // 1. Calcular la suma total recaudada en esta sesión
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select('amount_paid')
    .eq('session_id', sessionId);

  if (ordersError) {
    return { success: false, error: `Error al calcular total: ${ordersError.message}` };
  }

  const totalCollected = ordersData.reduce((sum, order) => sum + Number(order.amount_paid), 0);

  // 2. Actualizar el estado de la sesión a CLOSED
  const { error: updateError } = await supabase
    .from('cash_sessions')
    .update({
      status: 'CLOSED',
      closed_at: new Date().toISOString(),
      total_collected: totalCollected
    })
    .eq('id', sessionId);

  if (updateError) {
    return { success: false, error: `Error al cerrar el turno: ${updateError.message}` };
  }

  return { success: true, totalCollected };
}