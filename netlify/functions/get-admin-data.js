// netlify/functions/get-admin-data.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL; // https://...supabase.co
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY || !SUPABASE_URL) return { statusCode:500, body: JSON.stringify({ error: 'env not set' }) };

  // 1) получаем токен из заголовка
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth) return { statusCode:401, body: JSON.stringify({ error: 'No auth' }) };
  const token = auth.replace('Bearer ', '');

  // 2) узнаём user по токену
  const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!whoRes.ok) return { statusCode:401, body: JSON.stringify({ error: 'Invalid token' }) };
  const user = await whoRes.json();
  const userId = user.id;

  // 3) проверяем is_admin в profiles (используем service_role)
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  if (!profRes.ok) return { statusCode:500, body: JSON.stringify({ error: 'Failed to check profile' }) };
  const profData = await profRes.json();
  if (!profData || !profData[0] || !profData[0].is_admin) return { statusCode:403, body: JSON.stringify({ error: 'Forbidden' }) };

  // 4) получили, что пользователь — админ. Возвращаем пользователей и брони
  // users через Admin API
  const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  const users = await usersRes.json();

  // bookings через REST
  const bookingsRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
  });
  const bookings = await bookingsRes.json();

  return { statusCode:200, body: JSON.stringify({ users, bookings }) };
};
