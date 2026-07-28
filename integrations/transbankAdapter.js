'use strict';

/**
 * transbankAdapter.js
 *
 * Abstraction layer for Transbank WebPay payment processing.
 *
 * TO REPLACE: Set TRANSBANK_API_KEY and update TRANSBANK_BASE_URL to
 * production endpoint. Remove mock mode block.
 *
 * Docs: https://www.transbankdevelopers.cl/referencia/webpay
 */

const { v4: uuidv4 } = require('uuid');
const logger = require('../src/utils/logger');
const { TRANSBANK_API_KEY } = require('../src/config');

// Integration endpoints
const TRANSBANK_BASE_URL_MOCK = 'https://mock.transbank.cl';
// const TRANSBANK_BASE_URL_PROD = 'https://webpay3g.transbank.cl';

/**
 * Create a payment intent.
 *
 * @param {{ monto: number, orden_id: string, descripcion: string }} opts
 * @returns {Promise<{ url_pago: string, token: string, expira: string }>}
 */
async function crearPago({ monto, orden_id, descripcion }) {
  if (!TRANSBANK_API_KEY) {
    // MOCK MODE
    const token = uuidv4().replace(/-/g, '');
    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
    const url_pago = `${TRANSBANK_BASE_URL_MOCK}/pay?token=${token}`;
    logger.info(`transbankAdapter [MOCK] crearPago — orden_id=${orden_id}, monto=${monto}, token=${token}`);
    return { url_pago, token, expira };
  }

  // REAL MODE (Transbank WebPay Plus — Init Transaction)
  try {
    const res = await fetch('https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Tbk-Api-Key-Id': '597055555532', // commerce code — replace with real
        'Tbk-Api-Key-Secret': TRANSBANK_API_KEY,
      },
      body: JSON.stringify({
        buy_order: orden_id,
        session_id: uuidv4(),
        amount: monto,
        return_url: `${process.env.APP_URL || 'http://localhost:3000'}/webhook/payments/transbank`,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      logger.error('transbankAdapter.crearPago error:', JSON.stringify(data));
      throw new Error(data.error_message || 'Error Transbank');
    }

    const expira = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    return {
      url_pago: `${data.url}?token_ws=${data.token}`,
      token: data.token,
      expira,
    };
  } catch (err) {
    logger.error('transbankAdapter.crearPago excepción:', err.message);
    throw err;
  }
}

/**
 * Confirm/commit a payment by token.
 *
 * @param {string} token
 * @returns {Promise<{ estado: string, monto: number, orden_id: string }>}
 */
async function confirmarPago(token) {
  if (!TRANSBANK_API_KEY) {
    // MOCK MODE
    logger.info(`transbankAdapter [MOCK] confirmarPago — token=${token}`);
    return {
      estado: 'AUTHORIZED',
      monto: 0, // unknown in mock
      orden_id: 'mock-orden',
      authorization_code: '123456',
      payment_type_code: 'VD',
    };
  }

  // REAL MODE
  try {
    const res = await fetch(
      `https://webpay3g.transbank.cl/rswebpaytransaction/api/webpay/v1.2/transactions/${token}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Tbk-Api-Key-Id': '597055555532',
          'Tbk-Api-Key-Secret': TRANSBANK_API_KEY,
        },
      }
    );

    const data = await res.json();
    if (!res.ok) {
      logger.error('transbankAdapter.confirmarPago error:', JSON.stringify(data));
      throw new Error(data.error_message || 'Error confirmación Transbank');
    }

    return {
      estado: data.status,
      monto: data.amount,
      orden_id: data.buy_order,
      authorization_code: data.authorization_code,
      payment_type_code: data.payment_type_code,
    };
  } catch (err) {
    logger.error('transbankAdapter.confirmarPago excepción:', err.message);
    throw err;
  }
}

module.exports = { crearPago, confirmarPago };
