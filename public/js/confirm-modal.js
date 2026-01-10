document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-confirm');
    if (!btn) return;

    e.preventDefault();

    const titleKey = btn.dataset.confirmTitle;
    const messageKey = btn.dataset.confirmMessage;
    const paramsRaw = btn.dataset.confirmParams;

    let message = I18N.t(messageKey);

    if (paramsRaw) {
        try {
            const params = JSON.parse(paramsRaw);
            Object.keys(params).forEach(key => {
                message = message.replace(`{${key}}`, `<strong>${params[key]}</strong>`);
            });
        } catch (e) {
            console.warn('Invalid confirm params');
        }
    }

    // proveri da li dugme pripada formi
    const form = btn.closest('form');

    openConfirmModal({
        title: I18N.t(titleKey),
        message: message,
        //confirmUrl: btn.dataset.confirmUrl || btn.href
        onConfirm: () => {
            if (form) {
                form.submit();       // ✅ POST delete
            } else {
                window.location.href = btn.dataset.confirmUrl || btn.href;
            }
        }
    });
});

