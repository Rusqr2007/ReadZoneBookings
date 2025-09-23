// netlify/functions/delete-booking.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Добавляем CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Обрабатываем OPTIONS запрос (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: 'Method not allowed' 
    };
  }
  
  // Ваши данные Supabase
  const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZHBja3RiZ2F6enJxenF4eGhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1Mjc4MzIsImV4cCI6MjA3NDEwMzgzMn0.GT3YDB3pKZyDqTX-I3dkZQb4xpWP8xK9bhMgFnaZhsM";
  const SUPABASE_URL = "https://ufdpcktbgazzrqzqxxhf.supabase.co";

  let body;
  try {
    body = JSON.parse(event.body);
    console.log('Received booking_id:', body.booking_id);
  } catch (e) {
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ error: 'Invalid JSON' }) 
    };
  }

  const { booking_id } = body;
  if (!booking_id) {
    return { 
      statusCode: 400, 
      headers,
      body: JSON.stringify({ error: 'Missing booking_id' }) 
    };
  }

  try {
    // Используем fetch для удаления
    const res = await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${booking_id}`, {
      method: 'DELETE',
      headers: { 
        'apikey': SERVICE_KEY, 
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    });
    
    console.log('Delete response status:', res.status);
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Supabase error:', errorText);
      return { 
        statusCode: 500, 
        headers,
        body: JSON.stringify({ 
          error: 'Failed to delete booking',
          details: errorText
        }) 
      };
    }
    
    return { 
      statusCode: 200, 
      headers,
      body: JSON.stringify({ 
        message: 'Booking deleted successfully',
        booking_id: booking_id
      }) 
    };
    
  } catch (error) {
    console.error('Fetch error:', error);
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ 
        error: 'Network error',
        details: error.message 
      }) 
    };
  }
};
