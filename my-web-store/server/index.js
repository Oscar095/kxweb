const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const app = express();
app.use(express.json());

// Configura estas variables en tu entorno
const PAYU_ENABLED = process.env.PAYU_ENABLED === 'true';
const PORT = process.env.PORT || 3000;

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

app.listen(PORT, () => console.log(`API server listening on ${PORT}`));