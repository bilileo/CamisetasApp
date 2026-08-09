'use server';

import { supabase } from '../../lib/supabase';
import { SHIRT_SIZES, ShirtSize } from '../../lib/constants';

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
  // NUEVO: Lista detallada para el día de entrega
  familiesList: {
    id: string;
    family_name: string;
    is_fully_paid: boolean;
    amount_paid: number;
    total_amount: number;
    is_delivered: boolean;
    items: { size: ShirtSize; quantity: number }[];
  }[];
}

export async function getConsolidatedReport(churchId: string, sessionId?: string): Promise<{ success: boolean; data?: ReportSummary; error?: string }> {
  try {
    // 1. Construir consulta principal de pedidos incluyendo los detalles de las prendas y nombre de familia
    let ordersQuery = supabase
      .from('orders')
      .select(`
        id, 
        total_amount, 
        amount_paid, 
        family_name, 
        is_fully_paid,
        is_delivered,
        order_items ( size, quantity, subtotal )
      `)
      .neq('status', 'CANCELLED')
      .order('family_name');

    // Si no es "ALL", filtramos por la iglesia seleccionada
    if (churchId !== 'ALL') {
      ordersQuery = ordersQuery.eq('church_id', churchId);
    }

    // Filtro de sesión
    if (sessionId && sessionId !== 'ALL') {
      ordersQuery = ordersQuery.eq('session_id', sessionId);
    }

    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) throw new Error(`Error consultando pedidos: ${ordersError.message}`);

    // 2. Si no hay pedidos, devolvemos el reporte en ceros
    if (!orders || orders.length === 0) {
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
          sizeBreakdown: emptyBreakdown,
          familiesList: []
        }
      };
    }

    // 3. Procesar métricas financieras
    const totalOrders = orders.length;
    const totalExpectedRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const totalMoneyCollected = orders.reduce((sum, o) => sum + Number(o.amount_paid), 0);

    // 4. Agrupar camisetas por talla y armar la lista de familias
    const sizeBreakdown = SHIRT_SIZES.reduce((acc, size) => {
      acc[size] = { quantity: 0, subtotal: 0 };
      return acc;
    }, {} as Record<ShirtSize, { quantity: number; subtotal: number }>);

    let totalShirtsCount = 0;
    const familiesList: ReportSummary['familiesList'] = [];

    orders.forEach(order => {
      const items = order.order_items || [];
      const familyItems: { size: ShirtSize; quantity: number }[] = [];

      items.forEach((item: any) => {
        const size = item.size as ShirtSize;
        const qty = Number(item.quantity);
        
        // Sumar al global de tallas
        if (sizeBreakdown[size]) {
          sizeBreakdown[size].quantity += qty;
          sizeBreakdown[size].subtotal += Number(item.subtotal);
          totalShirtsCount += qty;
        }

        // Agregar al recibo de la familia
        familyItems.push({ size, quantity: qty });
      });

      familiesList.push({
        id: order.id,
        family_name: order.family_name,
        is_fully_paid: order.is_fully_paid,
        amount_paid: Number(order.amount_paid),
        total_amount: Number(order.total_amount),
        is_delivered: order.is_delivered,
        items: familyItems
      });
    });

    // 5. Si se consultó una sesión en específico, traemos sus metadatos
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
        sizeBreakdown,
        familiesList
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Error inesperado generando reporte.' };
  }
}