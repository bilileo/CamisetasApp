'use server';

import { supabase } from '../../lib/supabase';
import { SHIRT_SIZES, SHIRT_PRICES, ShirtSize } from '../../lib/constants';

export interface ReportSummary {
  sessionInfo?: {
    opened_at: string;
    closed_at: string | null;
    initial_cash: number;
    status: string;
  };
  totalOrders: number;
  totalExpectedRevenue: number;
  totalMoneyCollected: number;
  totalShirtsCount: number;
  sizeBreakdown: Record<ShirtSize, { quantity: number; subtotal: number }>;
}

export async function getConsolidatedReport(churchId: string, sessionId?: string): Promise<{ success: boolean; data?: ReportSummary; error?: string }> {
  try {
    // 1. Construir consulta principal de pedidos (orders)
    let ordersQuery = supabase
      .from('orders')
      .select('id, total_amount, amount_paid')
      .neq('status', 'CANCELLED');

    if (sessionId && sessionId !== 'ALL') {
      ordersQuery = ordersQuery.eq('session_id', sessionId);
    } else if (churchId) {
      ordersQuery = ordersQuery.eq('church_id', churchId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw new Error(`Error consultando pedidos: ${ordersError.message}`);

    const orderIds = (orders || []).map(o => o.id);

    // 2. Si no hay pedidos en este filtro, devolvemos el reporte en ceros
    if (orderIds.length === 0) {
      const emptyBreakdown = SHIRT_SIZES.reduce((acc, size) => {
        acc[size] = { quantity: 0, subtotal: 0 };
        return acc;
      }, {} as Record<ShirtSize, { quantity: number; subtotal: number }>);

      return {
        success: true,
        data: {
          totalOrders: 0,
          totalExpectedRevenue: 0,
          totalMoneyCollected: 0,
          totalShirtsCount: 0,
          sizeBreakdown: emptyBreakdown
        }
      };
    }

    // 3. Consultar los ítems asociados a esos pedidos
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('size, quantity, subtotal')
      .in('order_id', orderIds);

    if (itemsError) throw new Error(`Error consultando ítems: ${itemsError.message}`);

    // 4. Procesar métricas financieras
    const totalOrders = orders?.length || 0;
    const totalExpectedRevenue = orders?.reduce((sum, o) => sum + Number(o.total_amount), 0) || 0;
    const totalMoneyCollected = orders?.reduce((sum, o) => sum + Number(o.amount_paid), 0) || 0;

    // 5. Agrupar camisetas por talla
    const sizeBreakdown = SHIRT_SIZES.reduce((acc, size) => {
      acc[size] = { quantity: 0, subtotal: 0 };
      return acc;
    }, {} as Record<ShirtSize, { quantity: number; subtotal: number }>);

    let totalShirtsCount = 0;

    (items || []).forEach(item => {
      const size = item.size as ShirtSize;
      const qty = Number(item.quantity);
      if (sizeBreakdown[size]) {
        sizeBreakdown[size].quantity += qty;
        sizeBreakdown[size].subtotal += Number(item.subtotal);
        totalShirtsCount += qty;
      }
    });

    // 6. Si se consultó una sesión en específico, traemos sus metadatos de caja
    let sessionInfo = undefined;
    if (sessionId && sessionId !== 'ALL') {
      const { data: sessionData } = await supabase
        .from('cash_sessions')
        .select('opened_at, closed_at, initial_cash, status')
        .eq('id', sessionId)
        .single();
      if (sessionData) sessionInfo = sessionData;
    }

    return {
      success: true,
      data: {
        sessionInfo,
        totalOrders,
        totalExpectedRevenue,
        totalMoneyCollected,
        totalShirtsCount,
        sizeBreakdown
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error inesperado generando reporte.' };
  }
}