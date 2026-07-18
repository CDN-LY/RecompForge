/**
 * ================================================================
 * RecompForge Support — Cloudflare Worker Backend
 * ================================================================
 *
 * Bindings required (configure in wrangler.toml or dashboard):
 *   - D1 Database binding name: DB
 *
 * D1 Table schema (create manually or via migration):
 *
 *   CREATE TABLE IF NOT EXISTS supports (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     trans_id TEXT UNIQUE NOT NULL,
 *     user_id TEXT NOT NULL,
 *     country TEXT,
 *     reward TEXT,
 *     offer_id TEXT,
 *     status TEXT,
 *     created_at TEXT NOT NULL
 *   );
 *
 * Routes:
 *   GET  /                -> health check
 *   GET  /api/recent      -> latest 5 completions
 *   POST /api/callback    -> CPX Research postback receiver
 *   OPTIONS *             -> CORS preflight
 * ================================================================
 */

// ----------------------------------------------------------------
// CORS HELPERS
// ----------------------------------------------------------------
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

// ----------------------------------------------------------------
// ROUTE: GET /
// ----------------------------------------------------------------
function handleRoot() {
  return jsonResponse({
    success: true,
    message: "Support Worker Running",
  });
}

// ----------------------------------------------------------------
// ROUTE: GET /api/recent
// ----------------------------------------------------------------
async function handleRecent(env) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT trans_id, user_id, country, reward, offer_id, status, created_at
       FROM supports
       ORDER BY created_at DESC
       LIMIT 5`
    ).all();

    return jsonResponse({
      success: true,
      results: results || [],
    });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: "Failed to fetch recent supporters",
        details: String(err),
      },
      500
    );
  }
}

// ----------------------------------------------------------------
// ROUTE: POST /api/callback
// CPX Research postback:
//   ?status=1&trans_id=xxx&user_id=xxx&amount_local=xxx&offer_id=xxx&hash=xxx&country=xx
// ----------------------------------------------------------------
async function handleCallback(request, env) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;

    const status = params.get("status");
    const transId = params.get("trans_id");
    const userId = params.get("user_id");
    const amountLocal = params.get("amount_local");
    const offerId = params.get("offer_id");
    const country = params.get("country");

    // ---- required field validation ----
    if (!transId || !userId) {
      return jsonResponse(
        { success: false, error: "Missing required parameters" },
        400
      );
    }

    // Hash verification intentionally not implemented — not required for this integration.

    // ---- duplicate trans_id prevention ----
    const existing = await env.DB.prepare(
      `SELECT id FROM supports WHERE trans_id = ?`
    )
      .bind(transId)
      .first();

    if (existing) {
      return jsonResponse({
        success: true,
        duplicate: true,
        message: "Transaction already recorded",
      });
    }

    // ---- insert into D1 ----
    const statusText = status === "1" ? "confirmed" : "reversed";
    const createdAt = new Date().toISOString();

    await env.DB.prepare(
      `INSERT INTO supports (trans_id, user_id, country, reward, offer_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        transId,
        userId,
        country || null,
        amountLocal || null,
        offerId || null,
        statusText,
        createdAt
      )
      .run();

    return jsonResponse({
      success: true,
      message: "Callback recorded",
      trans_id: transId,
    });
  } catch (err) {
    return jsonResponse(
      {
        success: false,
        error: "Callback processing failed",
        details: String(err),
      },
      500
    );
  }
}

// ----------------------------------------------------------------
// MAIN FETCH HANDLER / ROUTER
// ----------------------------------------------------------------
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight — handled first, for every route
    if (method === "OPTIONS") {
      return handleOptions();
    }

    try {
      if (url.pathname === "/" && method === "GET") {
        return handleRoot();
      }

      if (url.pathname === "/api/recent" && method === "GET") {
        return handleRecent(env);
      }

      if (url.pathname === "/api/callback" && (method === "POST" || method === "GET")) {
        // CPX postbacks are commonly sent as GET server-to-server; support both.
        return handleCallback(request, env);
      }

      // ---- 404 fallback ----
      return jsonResponse(
        {
          success: false,
          error: "Not Found",
          path: url.pathname,
        },
        404
      );
    } catch (err) {
      // ---- top-level error guard ----
      return jsonResponse(
        {
          success: false,
          error: "Internal Server Error",
          details: String(err),
        },
        500
      );
    }
  },
};n