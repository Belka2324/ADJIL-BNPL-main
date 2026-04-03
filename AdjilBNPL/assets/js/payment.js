const PaymentSystem = {
    init: () => {
        PaymentSystem.setupMasking();
        PaymentSystem.setupValidation();
    },

    setupMasking: () => {
        const cardInput = document.getElementById('card-number');
        const expiryInput = document.getElementById('card-expiry');
        const cvvInput = document.getElementById('card-cvv');

        if (cardInput) {
            cardInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                val = val.substring(0, 16);
                let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
                e.target.value = formatted;
            });
        }

        if (expiryInput) {
            expiryInput.addEventListener('input', (e) => {
                let val = e.target.value.replace(/\D/g, '');
                if (val.length >= 2) {
                    val = val.substring(0, 2) + '/' + val.substring(2, 4);
                }
                e.target.value = val;
            });
        }

        if (cvvInput) {
            cvvInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').substring(0, 3);
            });
        }
    },

    setupValidation: () => {
        const form = document.getElementById('checkout-form');
        if (form) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                PaymentSystem.processPayment();
            });
        }
    },

    detectCardType: (number) => {
        const visaIcon = document.getElementById('icon-visa');
        const masterIcon = document.getElementById('icon-master');
        
        // Reset — guard against null if icons are not present in current page
        if (visaIcon) visaIcon.classList.remove('visible');
        if (masterIcon) masterIcon.classList.remove('visible');

        if (number.startsWith('4')) {
            if (visaIcon) visaIcon.classList.add('visible');
        } else if (/^5[1-5]/.test(number)) {
            if (masterIcon) masterIcon.classList.add('visible');
        }
    },

    validateForm: () => {
        const holder = document.getElementById('card-holder').value.trim();
        const number = document.getElementById('card-number').value.replace(/\s/g, '');
        const expiry = document.getElementById('card-expiry').value;
        const cvv = document.getElementById('card-cvv').value;
        const amount = document.getElementById('pay-amount-new').value;

        if (holder.length < 3) return false;
        if (number.length < 16) return false;
        if (expiry.length !== 5) return false;
        if (cvv.length < 3) return false;
        if (!amount || parseFloat(amount) <= 0) return false;

        // Basic expiry check
        const [mm, yy] = expiry.split('/');
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;

        if (parseInt(mm) < 1 || parseInt(mm) > 12) return false;
        if (parseInt(yy) < currentYear || (parseInt(yy) === currentYear && parseInt(mm) < currentMonth)) return false;

        return true;
    },

    processPayment: () => {
        const btn = document.getElementById('btn-confirm-pay');
        const formContainer = document.querySelector('.payment-card-container');
        
        if (!PaymentSystem.validateForm()) {
            formContainer.classList.add('shake');
            setTimeout(() => formContainer.classList.remove('shake'), 500);
            return;
        }

        // Lock UI
        btn.disabled = true;
        btn.classList.add('processing');
        const originalText = btn.querySelector('span').textContent;
        btn.querySelector('span').textContent = 'جاري المعالجة...';

        // Mock API Call
        setTimeout(() => {
            const successOverlay = document.getElementById('payment-success');
            let processed = false;

            // Helper to clean up UI state on early exit
            const resetBtn = () => {
                btn.disabled = false;
                btn.classList.remove('processing');
                btn.querySelector('span').textContent = originalText;
            };

            if (typeof app !== 'undefined' && app.user) {
                const amount = parseFloat(document.getElementById('pay-amount-new').value);
                const merchant = document.getElementById('pay-merchant-new').value || 'Manual Payment';
                if (app.user?.status && app.user.status !== 'active') {
                    alert(app.lang === 'ar' ? 'الحساب غير نشط' : 'Account is inactive');
                    resetBtn();
                    return;
                }
                if (!amount || amount <= 0) {
                    alert(app.lang === 'ar' ? 'يرجى إدخال مبلغ صحيح' : 'Invalid Amount');
                    resetBtn();
                    return;
                }
                if (amount > app.user.balance) {
                    const t = app.translations?.[app.lang] || {};
                    alert(t.insufficient_balance || 'Insufficient balance');
                    resetBtn();
                    return;
                }
                
                // Deduct balance logic (Mocking real transaction)
                const users = DB.get('users');
                const currentUserIdx = users.findIndex(u => u.id === app.user.id);
                if (currentUserIdx !== -1) {
                    users[currentUserIdx].balance = Math.max(0, (users[currentUserIdx].balance || 0) - amount);
                    users[currentUserIdx].txs.push({
                        id: 'TX-CARD-' + Date.now(),
                        amount: amount,
                        merchant: merchant,
                        date: new Date().toLocaleString('ar-DZ'),
                        status: 'completed',
                        method: 'Credit Card'
                    });
                    DB.set('users', users);
                    app.user = users[currentUserIdx];
                    localStorage.setItem('adjil_session', JSON.stringify(app.user));
                    app.updateDashboardUI();
                    app.notifyLowBalance?.(app.user);
                    processed = true;
                }
            }
            if (processed) {
                successOverlay.classList.add('active');
            }

            setTimeout(() => {
                // Reset and Close
                successOverlay.classList.remove('active');
                btn.disabled = false;
                btn.classList.remove('processing');
                btn.querySelector('span').textContent = originalText;
                
                // Close modal if it exists in the main app
                if (typeof app !== 'undefined') {
                    app.closePaymentModal();
                }
                
                // Clear inputs
                document.getElementById('card-number').value = '';
                document.getElementById('card-expiry').value = '';
                document.getElementById('card-cvv').value = '';
                document.getElementById('card-holder').value = '';
                document.getElementById('pay-amount-new').value = '';
            }, 2000);

        }, 2500); // 2.5 seconds delay
    }
};

// Initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', PaymentSystem.init);
} else {
    PaymentSystem.init();
}
