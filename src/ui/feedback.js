// Lightweight feedback modal wiring usable on any page (landing or app)
// Independent of app controllers; localized via existing translations system

import { t, updatePageTranslations } from '../translations.js';
import { FeedbackSolicitation } from './feedbackSolicitation.js';

function getEl(id) {
    return document.getElementById(id);
}

function openModal() {
    const modal = getEl('feedbackModal');
    if (modal) modal.style.display = 'block';
}

function closeModal() {
    const modal = getEl('feedbackModal');
    if (modal) modal.style.display = 'none';
}

function setStatus(message, type = 'info') {
    const status = getEl('feedbackStatus');
    if (!status) return;
    status.textContent = message || '';
    status.style.color = type === 'error' ? '#b00020' : '#1B2A20';
}

async function submitFeedback(e) {
    e.preventDefault();

    const name = (getEl('feedbackName')?.value || '').trim();
    const email = (getEl('feedbackEmail')?.value || '').trim();
    const message = (getEl('feedbackMessage')?.value || '').trim();
    const website = (getEl('feedbackWebsite')?.value || '').trim(); // honeypot

    if (!message || message.length < 5) {
        setStatus(t('feedback.validation.messageShort') || 'Message too short', 'error');
        return;
    }

    const btn = getEl('sendFeedbackBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = t('feedback.sending') || 'Sending...';
    }
    setStatus('');

    try {
        const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, message, website, meta: { path: location.pathname, ua: navigator.userAgent } })
        });
        if (res.ok) {
            setStatus(t('feedback.success') || 'Thanks for your feedback!');
            // Clear form
            if (getEl('feedbackForm')) getEl('feedbackForm').reset();
            // Close after a moment
            setTimeout(() => closeModal(), 1200);
        } else {
            const data = await res.json().catch(() => ({}));
            setStatus((data?.error) || (t('feedback.error') || 'Something went wrong. Please try again later.'), 'error');
        }
    } catch (err) {
        setStatus(t('feedback.error') || 'Something went wrong. Please try again later.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = t('feedback.send') || 'Send';
        }
    }
}

function wireHandlersOnce() {
    const link = getEl('feedbackLink');
    const closeBtn = getEl('feedbackCloseBtn');
    const cancelBtn = getEl('cancelFeedbackBtn');
    const form = getEl('feedbackForm');
    const modal = getEl('feedbackModal');

    if (link && !link.__wired) {
        link.addEventListener('click', (e) => { e.preventDefault(); openModal(); });
        link.__wired = true;
    }
    if (closeBtn && !closeBtn.__wired) {
        closeBtn.addEventListener('click', closeModal);
        closeBtn.__wired = true;
    }
    if (cancelBtn && !cancelBtn.__wired) {
        cancelBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
        cancelBtn.__wired = true;
    }
    if (form && !form.__wired) {
        form.addEventListener('submit', submitFeedback);
        form.__wired = true;
    }
    if (modal && !modal.__backdropWired) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        modal.__backdropWired = true;
    }
}

export function setupFeedbackForm() {
    // Try now
    wireHandlersOnce();
    try { updatePageTranslations(); } catch (e) {}

    // Initialize feedback solicitation system
    FeedbackSolicitation.init();

    // Observe footer injection if link not yet present
    if (!getEl('feedbackLink')) {
        const footerHost = document.getElementById('footer') || document.body;
        const observer = new MutationObserver(() => {
            if (getEl('feedbackLink') && getEl('feedbackModal')) {
                wireHandlersOnce();
                try { updatePageTranslations(); } catch (e) {}
                observer.disconnect();
            }
        });
        observer.observe(footerHost, { childList: true, subtree: true });
    }
}


