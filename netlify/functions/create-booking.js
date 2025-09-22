// netlify/functions/create-booking.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;

  if (!SERVICE_KEY || !SUPABASE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Service key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { room, start, end, user_id, user_email } = body;

  if (!room || !start || !end || !user_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };
  }

  const startDt = new Date(start);
  const endDt = new Date(end);

  if (isNaN(startDt) || isNaN(endDt) || endDt <= startDt) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid dates' }) };
  }

  const durationHours = (endDt - startDt) / (1000 * 60 * 60);

  if (durationHours > 4) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Maximum 4 hours per booking' }) };
  }

  // 1) Проверяем суммарное время для этого пользователя в этот день (макс 4 часа)
  const userBookingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?user_id=eq.${encodeURIComponent(user_id)}&select=start,end`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
  });

  if (!userBookingsRes.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to query user bookings' }) };
  }

  const userBookings = await userBookingsRes.json();
  const startDay = startDt.toISOString().slice(0, 10); // 'YYYY-MM-DD'

  let occupiedHours = 0;
  for (const b of userBookings) {
    const bStart = new Date(b.start);
    if (bStart.toISOString().slice(0, 10) === startDay) {
      occupiedHours += (new Date(b.end) - bStart) / (1000 * 60 * 60);
    }
  }

  if (occupiedHours + durationHours > 4) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Превышение лимита 4 часов в день для этого пользователя' }) };
  }

  // 2) Проверяем пересечения по времени для выбранной комнаты
  const roomBookingsRes = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?room=eq.${encodeURIComponent(room)}&select=start,end`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
  });

  if (!roomBookingsRes.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to query room bookings' }) };
  }

  const roomBookings = await roomBookingsRes.json();

  for (const b of roomBookings) {
    const bStart = new Date(b.start);
    const bEnd = new Date(b.end);

    if ((startDt < bEnd) && (endDt > bStart)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Выбранное время уже занято' }) };
    }
  }

  // Если все проверки пройдены, вставляем новую запись
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      user_id,
      user_email: user_email || null,
      room,
      start: startDt.toISOString(),
      end: endDt.toISOString()
    })
  });

  if (!insertRes.ok) {
    const txt = await insertRes.text();
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to insert booking: ' + txt }) };
  }

  const inserted = await insertRes.json();
  return { statusCode: 200, body: JSON.stringify(inserted[0]) };
};
