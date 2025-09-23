  // netlify/functions/delete-booking.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  
  const SERVICE_KEY = process.env.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZHBja3RiZ2F6enJxenF4eGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1Mjc4MzIsImV4cCI6MjA3NDEwMzgzMn0.GT3YDB3pKZyDqTX-I3dkZQb4xpWP8xK9bhMgFnaZhsM;
  const SUPABASE_URL = process.env.https://ufdpcktbgazzrqzqxxhf.supabase.co;
  
  if (!SERVICE_KEY || !SUPABASE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Service key or URL not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { booking_id } = body;
  if (!booking_id) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing booking_id' }) };
  }

  // Используем fetch для удаления
  const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}`, {
    method: 'DELETE',
    headers: { 
      apikey: SERVICE_KEY, 
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    }
  });
  
  if (!res.ok) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to delete booking' }) };
  }
  
  return { statusCode: 200, body: JSON.stringify({ message: 'Booking deleted successfully' }) };
};
