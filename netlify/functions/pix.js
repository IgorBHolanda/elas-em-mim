exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const TOKEN = process.env.MP_ACCESS_TOKEN;

  try {
    const body = JSON.parse(event.body || "{}");
    const { action, payment_id, nome, email, cpf, token, installments } = body;

    // ── Verificar status ──
    if (action === "status") {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const data = await resp.json();
      return { statusCode: 200, headers, body: JSON.stringify({ status: data.status }) };
    }

    // ── Pagamento por cartão ──
    if (action === "card") {
      const idempotencyKey = `elasemmim-card-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload = {
        transaction_amount: 39.90,
        token: token,
        description: "Elas em Mim — livro de poesia",
        installments: installments || 1,
        payment_method_id: "visa", // será sobrescrito pelo token
        payer: {
          email: email || "cliente@elasemmimlivro.com",
          identification: cpf ? { type: "CPF", number: cpf.replace(/\D/g, "") } : undefined,
        },
      };
      const resp = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: data.message || "Erro no pagamento" }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ id: data.id, status: data.status }) };
    }

    // ── Criar pagamento Pix ──
    const idempotencyKey = `elasemmim-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const payload = {
      transaction_amount: 39.90,
      description: "Elas em Mim — livro de poesia",
      payment_method_id: "pix",
      payer: {
        email: email || "cliente@elasemmimlivro.com",
        first_name: (nome || "Cliente").split(" ")[0],
        last_name: (nome || "Cliente").split(" ").slice(1).join(" ") || ".",
        identification: cpf ? { type: "CPF", number: cpf.replace(/\D/g, "") } : undefined,
      },
    };
    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: data.message || "Erro ao criar pagamento" }) };
    }
    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        id: data.id,
        status: data.status,
        qr_code: data.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: data.point_of_interaction?.transaction_data?.qr_code_base64,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
