class FooterComponent {
    constructor() {
        this.footerData = null;
        this.init();
    }

    async init() {
        try {
            await this.loadFooterData();
            this.renderFooter();
        } catch (error) {
            this.renderFallbackFooter();
        }
    }

    async loadFooterData() {
        // ✅ Use dynamic URL for assets
        const assetsUrl = UrlConfig ? UrlConfig.getFrontendUrl('/assets/footer-data.json') : '/assets/footer-data.json';
        const response = await fetch(assetsUrl);
        if (!response.ok) {
            throw new Error('Failed to load footer data');
        }
        this.footerData = await response.json();
    }

    renderFooter() {
        const footerHTML = `
            <footer id="footer">
                ${this.renderNewsletter()}
                ${this.renderFooterTop()}
                ${this.renderCopyright()}
            </footer>
        `;

        // Insert footer before closing body tag or at the end of content
        const mainContent = document.querySelector('main') || document.body;
        mainContent.insertAdjacentHTML('afterend', footerHTML);

        // Remove existing simple footer if present
        const oldFooter = document.querySelector('footer[style*="text-align: center"]');
        if (oldFooter) {
            oldFooter.remove();
        }
    }

    renderNewsletter() {
        const { newsletter } = this.footerData;
        return `
            <div class="footer-newsletter">
                <div class="container">
                    <div class="row justify-content-center">
                        <div class="col-lg-6">
                            <h4>${newsletter.title}</h4>
                            <p>${newsletter.description}</p>
                            <form action="" method="post" class="newsletter-form">
                                <input type="email" name="email" placeholder="Enter your email" required>
                                <input type="submit" value="${newsletter.buttonText}">
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFooterTop() {
        return `
            <div class="footer-top">
                <div class="container">
                    <div class="row">
                        ${this.renderContactInfo()}
                        ${this.renderUsefulLinks()}
                        ${this.renderProducts()}
                        ${this.renderSocialLinks()}
                    </div>
                </div>
            </div>
        `;
    }

    renderContactInfo() {
        const { company } = this.footerData;
        return `
            <div class="col-lg-3 col-md-6 footer-contact">
                <h3>${company.name}<span>.com</span></h3>
                <p>
                    ${company.fullName}<br>
                    ${company.address}<br><br>
                    <strong>Phone:</strong> ${company.phone}<br>
                    <strong>Email:</strong> ${company.email.replace('@', '<span>@</span>')}<br>
                </p>
            </div>
        `;
    }

    renderUsefulLinks() {
        const { usefulLinks } = this.footerData;
        const linksHTML = usefulLinks.map(link => `
            <li>
                <i class="fas fa-chevron-right"></i>
                <a href="${link.url}" ${link.target ? `target="${link.target}"` : ''}>${link.name}</a>
            </li>
        `).join('');

        return `
            <div class="col-lg-3 col-md-6 footer-links">
                <h4>Useful Links</h4>
                <ul>${linksHTML}</ul>
            </div>
        `;
    }

    renderProducts() {
        const { products } = this.footerData;
        const linksHTML = products.map(product => `
            <li>
                <i class="fas fa-chevron-right"></i>
                <a href="${product.url}" class="${product.comingSoon ? 'coming-soon' : ''}">
                    ${product.name}
                    ${product.comingSoon ? '<small>(Coming Soon)</small>' : ''}
                </a>
            </li>
        `).join('');

        return `
            <div class="col-lg-3 col-md-6 footer-links">
                <h4>Our Products</h4>
                <ul>${linksHTML}</ul>
            </div>
        `;
    }

    renderSocialLinks() {
        const { socialMedia } = this.footerData;

        const linksHTML = socialMedia.map(social => `
            <a href="${social.url}" class="${social.name}">
                <i class="${social.icon}"></i>
            </a>
        `).join('');

        return `
            <div class="col-lg-3 col-md-6 footer-links">
                <h4>Our Social Networks</h4>
                <p>Follow us on social media for updates and information.</p>
                <div class="social-links mt-3">${linksHTML}</div>
            </div>
        `;
    }

    renderCopyright() {
        const { company } = this.footerData;
        const currentYear = new Date().getFullYear();

        return `
            <div class="container py-4">
                <div class="copyright">
                    &copy; Copyright ${currentYear} <strong><span>${company.name}</span></strong>. All Rights Reserved
                </div>
                <div class="credits">
                    ${company.slogan}
                </div>
            </div>
        `;
    }

    renderFallbackFooter() {
        const fallbackHTML = `
            <footer style="text-align: center; padding: 2rem 0; color: #666; border-top: 1px solid #eee;">
                <div class="container">
                    <p>&copy; ${new Date().getFullYear()} KaosSub. All rights reserved.</p>
                    <p>Affordable Data Subscriptions for Everyone</p>
                </div>
            </footer>
        `;

        const mainContent = document.querySelector('main') || document.body;
        mainContent.insertAdjacentHTML('afterend', fallbackHTML);
    }
}

// Initialize footer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new FooterComponent();
});
