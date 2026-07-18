/**
 * ================================================================
 * RecompForge Support — Cloudflare Worker Backend
 * ================================================================
 *
 * Bindings required (configure in wrangler.toml or dashboard):
 *   - D1 Database binding name: DB
 *
 * Optional environment variable:
 *   - CPX_SECRET  (if set, MD5 hash verification is enforced on callback)
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
// MD5 IMPLEMENTATION (pure JS — Workers runtime has no crypto.md5)
// Used only when CPX_SECRET is configured.
// ----------------------------------------------------------------
function md5(input) {
  function rotateLeft(x, c) {
    return (x << c) | (x >>> (32 - c));
  }
  function addUnsigned(x, y) {
    const x4 = x & 0x40000000;
    const y4 = y & 0x40000000;
    const x8 = x & 0x80000000;
    const y8 = y & 0x80000000;
    const result = (x & 0x3fffffff) + (y & 0x3fffffff);
    if (x4 & y4) return result ^ 0x80000000 ^ x8 ^ y8;
    if (x4 | y4) {
      if (result & 0x40000000) return result ^ 0xc0000000 ^ x8 ^ y8;
      return result ^ 0x40000000 ^ x8 ^ y8;
    }
    return result ^ x8 ^ y8;
  }
  function F(x, y, z) { return (x & y) | (~x & z); }
  function G(x, y, z) { return (x & z) | (y & ~z); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | ~z); }
  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(str) {
    let wordCount;
    const messageLength = str.length;
    const numberOfWordsTempOne = messageLength + 8;
    const numberOfWordsTempTwo =
      (numberOfWordsTempOne - (numberOfWordsTempOne % 64)) / 64;
    const numberOfWords = (numberOfWordsTempTwo + 1) * 16;
    const wordArray = new Array(numberOfWords - 1);
    let bytePosition = 0;
    let byteCount = 0;
    while (byteCount < messageLength) {
      wordCount = (byteCount - (byteCount % 4)) / 4;
      bytePosition = (byteCount % 4) * 8;
      wordArray[wordCount] =
        (wordArray[wordCount] || 0) |
        (str.charCodeAt(byteCount) << bytePosition);
      byteCount++;
    }
    wordCount = (byteCount - (byteCount % 4)) / 4;
    bytePosition = (byteCount % 4) * 8;
    wordArray[wordCount] = (wordArray[wordCount] || 0) | (0x80 << bytePosition);
    wordArray[numberOfWords - 2] = messageLength << 3;
    wordArray[numberOfWords - 1] = messageLength >>> 29;
    return wordArray;
  }
  function wordToHex(value) {
    let result = "";
    for (let i = 0; i <= 3; i++) {
      const byte = (value >>> (i * 8)) & 255;
      result += ("0" + byte.toString(16)).slice(-2);
    }
    return result;
  }

  const utf8Str = unescape(encodeURIComponent(input));
  const x = convertToWordArray(utf8Str);
  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;

    a = FF(a, b, c, d, x[k + 0], 7, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], 12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], 17, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], 22, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], 7, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], 12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], 17, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], 22, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], 7, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], 12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], 17, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], 22, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], 7, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], 12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], 17, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], 22, 0x49b40821);

    a = GG(a, b, c, d, x[k + 1], 5, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], 9, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], 14, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], 20, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], 5, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], 9, 0x02441453);
    c = GG(c, d, a, b, x[k + 15], 14, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], 20, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], 5, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], 9, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], 14, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], 20, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], 5, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], 9, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], 14, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], 20, 0x8d2a4c8a);

    a = HH(a, b, c, d, x[k + 5], 4, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], 11, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], 16, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], 23, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], 4, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], 11, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], 16, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], 23, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], 4, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], 11, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], 16, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], 23, 0x04881d05);
    a = HH(a, b, c, d, x[k + 9], 4, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], 11, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], 16, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], 23, 0xc4ac5665);

    a = II(a, b, c, d, x[k + 0], 6, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], 10, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], 15, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], 21, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], 6, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], 10, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], 15, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], 21, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], 6, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], 10, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], 15, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], 21, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], 6, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], 10, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], 15, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], 21, 0xeb86d391);

    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }

  return (
    wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)
  ).toLowerCase();
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
    const hash = params.get("hash");
    const country = params.get("country");

    // ---- required field validation ----
    if (!transId || !userId) {
      return jsonResponse(
        { success: false, error: "Missing required parameters" },
        400
      );
    }

    // ---- optional hash verification ----
    // CPX Research standard hash formula: md5(trans_id + "-" + CPX_SECRET)
    if (env.CPX_SECRET) {
      const expectedHash = md5(`${transId}-${env.CPX_SECRET}`);
      if (!hash || hash.toLowerCase() !== expectedHash.toLowerCase()) {
        return jsonResponse(
          { success: false, error: "Invalid hash — verification failed" },
          403
        );
      }
    }
    // If CPX_SECRET is not set, verification is skipped intentionally.

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
};