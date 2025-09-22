async function createBooking() {
    if (!selectedTime) {
        showMessage('bookingMessage', 'Выберите время', 'error');
        return;
    }

    const date = document.getElementById('bookingDate').value;
    const duration = parseInt(document.getElementById('duration').value);
    
    // Создаем даты начала и конца для отправки на сервер
    const startTime = new Date(date + 'T' + selectedTime + ':00');
    const endTime = new Date(startTime.getTime() + duration * 60 * 60 * 1000);

    // Отправка запроса на Netlify Function
    const response = await fetch('/.netlify/functions/create-booking', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            user_id: currentUser.id,
            user_email: currentUser.email,
            room: 'Читальный зал',
            start: startTime.toISOString(),
            end: endTime.toISOString()
        })
    });

    const data = await response.json();

    if (response.ok) {
        showMessage('bookingMessage', 'Бронь создана успешно!', 'success');
        loadUserBookings();
        loadAvailableSlots();
        selectedTime = null;
        document.querySelectorAll('.time-slot').forEach(slot => {
            slot.classList.remove('selected');
        });
    } else {
        showMessage('bookingMessage', 'Ошибка при создании брони: ' + data.error, 'error');
    }
}
