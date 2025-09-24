// netlify/functions/get-admin-data.js

exports.handler = async (event) => {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL; // например https://xxxxx.supabase.co
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error("❌ Нет переменных окружения SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY");
      return { statusCode: 500, body: JSON.stringify({ error: "Environment variables not set" }) };
    }

    // 1) Проверяем авторизацию
    const auth = event.headers.authorization || event.headers.Authorization;
    if (!auth) {
      return { statusCode: 401, body: JSON.stringify({ error: "No Authorization header" }) };
    }
    const token = auth.replace("Bearer ", "");

    // 2) Получаем пользователя по токену
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!whoRes.ok) {
      console.error("❌ Ошибка при проверке токена", await whoRes.text());
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid token" }) };
    }
    const user = await whoRes.json();
    const userId = user.id;

    // 3) Проверяем is_admin в таблице profiles
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=is_admin`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });

    if (!profRes.ok) {
      console.error("❌ Ошибка запроса к profiles:", await profRes.text());
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to check profile" }) };
    }

    const profData = await profRes.json();
    if (!profData || !profData[0] || !profData[0].is_admin) {
      return { statusCode: 403, body: JSON.stringify({ error: "Forbidden (not admin)" }) };
    }

    // 4) Получаем пользователей через Admin API
    const usersRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!usersRes.ok) {
      console.error("❌ Ошибка получения списка пользователей:", await usersRes.text());
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch users" }) };
    }
    const users = await usersRes.json();

    // 5) Получаем бронирования через REST
    const bookingsRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?select=*`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (!bookingsRes.ok) {
      console.error("❌ Ошибка получения бронирований:", await bookingsRes.text());
      return { statusCode: 500, body: JSON.stringify({ error: "Failed to fetch bookings" }) };
    }
    const bookings = await bookingsRes.json();

    // 6) Возвращаем данные
    return {
      statusCode: 200,
      body: JSON.stringify({ users, bookings }),
    };
  } catch (e) {
    console.error("❌ Критическая ошибка в get-admin-data.js:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
