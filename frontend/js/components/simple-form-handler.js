// Clean form handler with pop-up notifications
class SimpleFormHandler {
    constructor() {
        this.setupForms();
    }

    setupForms() {
        setTimeout(() => {
            this.setupContactForms();
            this.setupNewsletterForms();
        }, 100);
    }

    setupContactForms() {
        const contactForms = document.querySelectorAll('form');

        contactForms.forEach((form) => {
            const hasContactFields = form.querySelector('input[name="name"]') &&
                                   form.querySelector('input[name="email"]') &&
                                   form.querySelector('textarea[name="message"]');

            if (hasContactFields) {
                this.setupFormHandler(form, 'contact');
            }
        });
    }

    setupNewsletterForms() {
        const newsletterForms = document.querySelectorAll('.newsletter-form');
        newsletterForms.forEach((form) => {
            this.setupFormHandler(form, 'newsletter');
        });
    }

    setupFormHandler(form, type) {
        form.removeEventListener('submit', this.handleSubmit);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (type === 'contact') {
                this.handleContactSubmit(form);
            } else if (type === 'newsletter') {
                this.handleNewsletterSubmit(form);
            }
        });
    }

    async handleContactSubmit(form) {
        const name = form.querySelector('input[name="name"]').value;
        const email = form.querySelector('input[name="email"]').value;
        const message = form.querySelector('textarea[name="message"]').value;

        if (!name || !email || !message) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        this.showMessage('Sending message...', 'info');

        try {
            // ✅ Use dynamic URL for API calls
            const apiUrl = UrlConfig ? UrlConfig.getApiUrl('contact/submit') : '/api/contact/submit';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, message })
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Thank you! Your message has been sent successfully.', 'success');
                form.reset();
            } else {
                this.showMessage(data.error || 'Failed to send message', 'error');
            }
        } catch (error) {
            this.showMessage('Failed to send message. Please try again.', 'error');
        }
    }

    async handleNewsletterSubmit(form) {
        const email = form.querySelector('input[type="email"]').value;

        if (!email) {
            this.showMessage('Please enter your email address', 'error');
            return;
        }

        this.showMessage('Subscribing...', 'info');

        try {
            // ✅ Use dynamic URL for API calls
            const apiUrl = UrlConfig ? UrlConfig.getApiUrl('newsletter/subscribe') : '/api/newsletter/subscribe';
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Successfully subscribed to our newsletter!', 'success');
                form.reset();
            } else {
                this.showMessage(data.error || 'Failed to subscribe', 'error');
            }
        } catch (error) {
            this.showMessage('Failed to subscribe. Please try again.', 'error');
        }
    }

    showMessage(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            padding: 20px 30px;
            border-radius: 10px;
            color: white;
            font-weight: bold;
            z-index: 10001;
            text-align: center;
            min-width: 250px;
            font-size: 16px;
            ${type === 'success' ? 'background: #28a745;' : ''}
            ${type === 'error' ? 'background: #dc3545;' : ''}
            ${type === 'info' ? 'background: #17a2b8;' : ''}
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        notification.textContent = message;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 4000);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    window.simpleFormHandler = new SimpleFormHandler();
});
