// netlify/functions/delete-booking.js
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

    const { booking_id, user_id } = body;

    if (!booking_id || !user_id) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Missing booking_id or user_id' }) };
    }

    // Use the service key to delete the booking
    const { data, error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', booking_id)
        .eq('user_id', user_id) // Add user_id check for extra security
        .auth.setServiceRoleKey(SERVICE_KEY)

    if (error) {
        console.error('Error deleting booking:', error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Booking deleted successfully' }) };
};
