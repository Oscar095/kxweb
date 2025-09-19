const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const crypto = require('crypto');
const path = require('path');
require('dotenv').config(); // Carga variables de .env

const app = express();
app.use(express.json());

// Configura estas variables en tu entorno
const PAYU_ENABLED = process.env.PAYU_ENABLED === 'true';
const PORT = process.env.PORT || 3000;

// Wompi
const WOMPI_PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY || 'pub_test_placeholder';
const WOMPI_INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET || 'test_integrity_secret_placeholder';

// Servir el frontend estático desde /src para tener mismo origen en dev
const staticDir = path.resolve(__dirname, '..', 'src');
app.use(express.static(staticDir));

app.post('/api/create-payu-order', async (req, res) => {
  try {
    const { items, shipping, paymentMethod } = req.body;
    const amount = (items || []).reduce((s,i)=> s + Number(i.price || 0), 0);

    if (!PAYU_ENABLED) {
      // Modo prueba: devolver URL simulada (Útil para desarrollo sin integrar PayU aún)
      return res.json({ redirectUrl: `https://httpbin.org/get?mock_payu=true&amount=${amount}` });
    }

    // Aquí debes implementar la llamada real al API de PayU según su documentación.
    // Ejemplo conceptual (NO es código listo para producción):
    const payuPayload = {
      // payload según PayU: información de buyer, order, amount, items, etc.
      // Ver docs PayU de tu región para campos exactos.
      order: {
        amount: amount,
        currency: 'COP',
        // ...
      },
      buyer: {
        fullName: shipping.name,
        email: shipping.email,
        phone: shipping.phone,
        shippingAddress: shipping.address,
        city: shipping.city
      },
      // redirection URLs
      redirectUrls: {
        success: process.env.PAYU_SUCCESS_URL,
        failure: process.env.PAYU_FAILURE_URL
      }
    };

    // Envía la petición a PayU (endpoint y autenticación según tu cuenta)
    const payuResponse = await fetch(process.env.PAYU_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PAYU_API_KEY}` // ejemplo
      },
      body: JSON.stringify(payuPayload)
    });

    const payuBody = await payuResponse.json();
    // Extraer la URL de redirección según la respuesta real de PayU:
    const redirectUrl = payuBody && (payuBody.redirectUrl || payuBody.data?.redirectUrl);

    if (!redirectUrl) {
      return res.status(500).json({ message: 'No se obtuvo URL de pago desde PayU', raw: payuBody });
    }

    return res.json({ redirectUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor', error: String(err) });
  }
});

// Endpoint para generar la firma de integridad de Wompi
// Recibe: { reference, amountInCents, currency, redirectUrl? }
// Responde: { publicKey, signature: { integrity }, currency, redirectUrl }
app.post('/api/wompi/signature', async (req, res) => {
  try {
    const { reference, amountInCents, currency = 'COP', redirectUrl } = req.body || {};
    if (!reference || !amountInCents) {
      return res.status(400).json({ message: 'Faltan campos: reference y amountInCents son obligatorios.' });
    }

    // Firma de integridad: sha256(reference + amountInCents + currency + integritySecret)
    const integrity = crypto
      .createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${WOMPI_INTEGRITY_SECRET}`)
      .digest('hex');

    // Si no envían redirectUrl, usar checkout.html como destino por defecto
    const defaultRedirect = `${req.protocol}://${req.get('host')}/checkout.html`;

    return res.json({
      publicKey: WOMPI_PUBLIC_KEY,
      signature: { integrity },
      currency,
      redirectUrl: redirectUrl || defaultRedirect
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generando firma', error: String(err) });
  }
});

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));