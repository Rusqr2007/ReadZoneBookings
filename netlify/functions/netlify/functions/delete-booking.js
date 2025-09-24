// netlify/functions/delete-booking.js
const fetch = require("node-fetch");

exports.handler = async function (event) {
  // CORS
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server not configured" }),
    };
  }

  // parse body
  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Invalid JSON" }),
    };
  }

  const bookingId = body.booking_id || body.bookingId;
  if (!bookingId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: "Missing booking_id" }),
    };
  }

  // auth token
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: "No auth token" }),
    };
  }
  const token = authHeader.replace("Bearer ", "");

  try {
    // 1) resolve token -> user
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!whoRes.ok) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }
    const user = await whoRes.json();
    const requesterId = user.id;

    // 2) fetch booking
    const bookingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=*`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
      }
    );

    if (!bookingRes.ok) {
      const t = await bookingRes.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to fetch booking",
          details: t,
        }),
      };
    }

    const bookings = await bookingRes.json();
    if (!bookings || bookings.length === 0) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Booking not found" }),
      };
    }
    const booking = bookings[0];

    let allowed = false;
    // 3) owner check
    if (booking.user_id === requesterId) {
      allowed = true;
    } else {
      // 4) check admin
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${requesterId}&select=is_admin`,
        {
          headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
          },
        }
      );

      if (!profRes.ok) {
        const t = await profRes.text();
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({
            error: "Failed to check admin",
            details: t,
          }),
        };
      }

      const prof = await profRes.json();
      const isAdmin = Array.isArray(prof) && prof[0] && prof[0].is_admin;
      if (isAdmin) allowed = true;
    }

    if (!allowed) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: "Forbidden" }),
      };
    }

    // 5) delete booking
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: "DELETE",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "return=minimal",
        },
      }
    );

    if (!delRes.ok) {
      const t = await delRes.text();
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to delete booking",
          details: t,
        }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, booking_id: bookingId }),
    };
  } catch (err) {
    console.error("delete-booking error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Internal error", details: err.message }),
    };
  }
};
