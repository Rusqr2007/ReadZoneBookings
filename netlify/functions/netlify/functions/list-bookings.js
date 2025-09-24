// netlify/functions/list-bookings.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if(!SERVICE_KEY || !SUPABASE_URL) return { statusCode:500, body: JSON.stringify({ error: 'Service key not configured' }) };

  const q = event.queryStringParameters || {};
  const { room, user_id } = q;

  // Запрос теперь просто получает все данные из таблицы бронирований
  let url = `${SUPABASE_URL}/rest/v1/bookings?select=*`;
  if(room) url += `&room=eq.${encodeURIComponent(room)}`;
  if(user_id) url += `&user_id=eq.${encodeURIComponent(user_id)}`;

  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if(!res.ok) return { statusCode:500, body: JSON.stringify({ error: 'Failed to fetch bookings' }) };
  const data = await res.json();
  return { statusCode:200, body: JSON.stringify(data) };
};
