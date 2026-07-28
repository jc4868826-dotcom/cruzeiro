'use strict';

/**
 * khipuAdapter.js
 *
 * Abstraction layer for Khipu payment processing (bank transfer, Chile).
 *
 * TO REPLACE: Set KHIPU_API_KEY in .env (Receiver ID + Secret).
 * Docs: https://khipu.com/page/api
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/utils/logger');
const { KHIPU_API_KEY } = require('../src/config');

const KHIPU_BASE_URL = 'https://khipu.com/api/2.0';

/**
 * Create a Khipu payment.
 *
 * @param {{ monto: number, orden_id: string, descripcion: string }} opts
 * @returns {Promise<{ url_pago: string, payment_id: string, expira: string }>}
 */
async function crearPago({ monto, orden_id, descripcion }) {
  if (!KHIPU_API_KEY) {
    // MOCK MODE
    const payment_id = uuidv4();
    const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    const url_pago = `https://mock.khipu.com/pay/${payment_id}`;
    logger.info(`khipuAdapter [MOCK] crearPago — orden_id=${orden_id}, monto=${monto}, payment_id=${payment_id}`);
    return { url_pago, payment_id, expira };
  }

  // REAL MODE
  try {
    // Khipu v2 uses HMAC-SHA256 signature — simplified here
    const params = new URLSearchParams({
      subject: descripcion || `Pedido ${orden_id}`,
      currency: 'CLP',
      amount: monto.toString(),
      transaction_id: orden_id,
      return_url: `${process.env.APP_URL || 'http://localhost:3000'}/webhook/payments/khipu`,
      notify_url: `${process.env.APP_URL || 'http://localhost:3000'}/webhook/payments/khipu`,
    });

    const res = await fetch(`${KHIPU_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${KHIPU_API_KEY}`,
      },
      body: params.toString(),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('khipuAdapter.crearPago error:', JSON.stringify(data));
      throw new Error(data.message || 'Error Khipu');
    }

    return {
      url_pago: data.payment_url,
      payment_id: data.payment_id,
      expira: data.expires_date || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };
  } catch (err) {
    logger.error('khipuAdapter.crearPago excepción:', err.message);
    throw err;
  }
}

/**
 * Confirm/verify a Khipu payment.
 *
 * @param {string} payment_id
 * @returns {Promise<{ estado: string, monto: number, orden_id: string }>}
 */
async function confirmarPago(payment_id) {
  if (!KHIPU_API_KEY) {
    // MOCK MODE
    logger.info(`khipuAdapter [MOCK] confirmarPago — payment_id=${payment_id}`);
    return {
      estado: 'done',
      monto: 0,
      orden_id: 'mock-orden',
    };
  }

  // REAL MODE
  try {
    const res = await fetch(`${KHIPU_BASE_URL}/payments/${payment_id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${KHIPU_API_KEY}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('khipuAdapter.confirmarPago error:', JSON.stringify(data));
      throw new Error(data.message || 'Error confirmación Khipu');
    }

    return {
      estado: data.status,
      monto: data.amount,
      orden_id: data.transaction_id,
    };
  } catch (err) {
    logger.error('khipuAdapter.confirmarPago excepción:', err.message);
    throw err;
  }
}

module.exports = { crearPago, confirmarPago };
