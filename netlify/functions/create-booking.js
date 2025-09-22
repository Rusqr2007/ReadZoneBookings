// netlify/functions/create-booking.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  if(!SERVICE_KEY || !SUPABASE_URL) return { statusCode:500, body: JSON.stringify({ error: 'Service key not configured' }) };

  let body;
  try { body = JSON.parse(event.body); } catch(e){ return { statusCode:400, body: JSON.stringify({ error:'Invalid JSON' }) }; }

  const { room, start, end, user_id, user_email } = body;
  if(!room || !start || !end || !user_id) return { statusCode:400, body: JSON.stringify({ error:'Missing fields' }) };

  // Преобразования
  const startDt = new Date(start);
  const endDt = new Date(end);
  if(isNaN(startDt) || isNaN(endDt) || endDt <= startDt) return { statusCode:400, body: JSON.stringify({ error:'Invalid dates' }) };

  // Считаем длительность в часах
  const durationHours = (endDt - startDt) / (1000*60*60);
  if(durationHours > 4) return { statusCode:400, body: JSON.stringify({ error: 'Maximum 4 hours per booking' }) };

  // Ограничение: в пределах одного календарного дня (по локали UTC)
  const startDay = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate()));
  const endDay = new Date(Date.UTC(endDt.getUTCFullYear(), endDt.getUTCMonth(), endDt.getUTCDate()));
  if(startDay.getTime() !== endDay.getTime()) return { statusCode:400, body: JSON.stringify({ error: 'Booking must be within single day' }) };

  // 1) Проверяем суммарное время этого пользователя в этой комнате в тот день (макс 4 часов)
  // Получим все брони для room и для same day
  const dayStartISO = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate())).toISOString();
  const dayEndISO = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth(), startDt.getUTCDate(), 23,59,59,999)).toISOString();

  // Запрос к Supabase через REST Admin API
  const url = `${SUPABASE_URL}/rest/v1/bookings?room=eq.${encodeURIComponent(room)}&start=gte.${encodeURIComponent(dayStartISO)}&end=lte.${encodeURIComponent(dayEndISO)}`;
  // Но проще: используем SQL RPC через Postgres — сделаем запрос к /rpc? (некоторым аккаунтам может понадобиться включить)
  // Для простоты — делаем общий запрос к /rest/v1/bookings и затем фильтруем в коде (маленькие таблицы).
  const allRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings?room=eq.${encodeURIComponent(room)}&select=*`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`
    }
  });
  if(!allRes.ok){
    const t = await allRes.text();
    return { statusCode:500, body: JSON.stringify({ error: 'Failed to query bookings: ' + t }) };
  }
  const bookings = await allRes.json();

  // Фильтруем только по дню и проверяем пересечения
  const toDay = (dt) => new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate())).getTime();
  const targetDay = toDay(startDt);
  // Посчитать уже занятое время этого дня в этой комнате (в часах)
  let occupiedHours = 0;
  for(const b of bookings){
    const bStart = new Date(b.start);
    const bEnd = new Date(b.end);
    if(toDay(bStart) !== targetDay) continue;
    // проверка пересечения
    if( (startDt < bEnd) && (endDt > bStart) ) {
      return { statusCode:400, body: JSON.stringify({ error: 'Время пересекается с другой бронью' }) };
    }
    // если бронь того же user_id, считаем суммарно для пользователя на день (чтобы ограничить 4 часа на пользователя если нужно)
    if(b.user_id === user_id) {
      occupiedHours += (bEnd - bStart)/(1000*60*60);
    }
  }

  // Если суммарно у пользователя уже есть время в этот день >=4 => запрет
  if(occupiedHours + durationHours > 4) {
    return { statusCode:400, body: JSON.stringify({ error:'Превышение лимита 4 часов в день для этого пользователя/комнаты' }) };
  }

  // Всё ок — вставим запись
  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/bookings`, {
    method:'POST',
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

  if(!insertRes.ok){
    const txt = await insertRes.text();
    return { statusCode:500, body: JSON.stringify({ error: 'Failed to insert booking: ' + txt }) };
  }
  const inserted = await insertRes.json();
  return { statusCode:200, body: JSON.stringify(inserted[0]) };
};
