const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.demoMode = true;
        this.emailQueue = [];
        this.sending = false;
        this.rateLimit = {
            maxEmailsPerMinute: parseInt(process.env.EMAIL_RATE_LIMIT) || 30,
            emailsSent: 0,
            lastReset: Date.now()
        };

        // Simplified email providers - only SendGrid, SMTP, and Demo
        this.sendGridEnabled = false;
        this.sendGrid = null;

        this.initializeTransporter();
    }

    initializeTransporter() {
        // Auto-detect if we're in production with email credentials
        const hasEmailConfig = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;
        const hasSendGridConfig = process.env.SENDGRID_API_KEY;

        // Initialize SendGrid if available
        if (hasSendGridConfig) {
            try {
                const sgMail = require('@sendgrid/mail');
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                this.sendGrid = sgMail;
                this.sendGridEnabled = true;
                console.log('📧 SendGrid service initialized');
            } catch (error) {
                console.log('❌ SendGrid initialization failed:', error.message);
            }
        }

        // Production mode check
        if ((hasEmailConfig || this.sendGridEnabled) && process.env.NODE_ENV === 'production') {
            console.log('📧 Email service initialized (production mode)');

            // Only create SMTP transporter if email config is available
            if (hasEmailConfig) {
                this.transporter = nodemailer.createTransport({
                    service: process.env.EMAIL_SERVICE || 'gmail',
                    host: process.env.EMAIL_HOST,
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: process.env.EMAIL_SECURE === 'true',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD,
                    },
                    // INCREASED TIMEOUTS FOR RENDER
                    connectionTimeout: 30000, // 30 seconds
                    socketTimeout: 60000, // 60 seconds
                    greetingTimeout: 30000,
                    debug: process.env.EMAIL_DEBUG === 'true',
                    logger: process.env.EMAIL_DEBUG === 'true'
                });
            }

            // Test the connection
            this.testConnection();
            this.demoMode = false;
        } else {
            console.log('📧 Email service initialized (demo mode)');
            this.demoMode = true;
        }
    }

    // Test email connection with enhanced timeout handling
    async testConnection() {
        console.log('🔧 Testing email connections...');

        // Test SendGrid if available
        if (this.sendGridEnabled) {
            try {
                console.log('✅ SendGrid API key configured and ready');
            } catch (error) {
                console.log('❌ SendGrid test failed:', error.message);
            }
        }

        // Test SMTP connection if available
        if (this.transporter) {
            try {
                await Promise.race([
                    this.transporter.verify(),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('SMTP verification timeout')), 15000)
                    )
                ]);
                console.log('✅ SMTP connection verified');
            } catch (error) {
                console.log('❌ SMTP connection failed:', error.message);
                if (!this.sendGridEnabled) {
                    console.log('🔄 Falling back to demo mode');
                    this.demoMode = true;
                }
            }
        }
    }

    // ✅ UPDATED: Enhanced email sending with improved SendGrid configuration
    async sendEmailWithRetry(email, subject, html, resolve, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                // Try SendGrid first (with improved configuration)
                if (this.sendGridEnabled && attempt <= 2) {
                    try {
                        const msg = {
                            to: email,
                            from: 'KaosSub <kaossub45@gmail.com>', // ✅ FRIENDLY NAME
                            replyTo: 'kaossub45@gmail.com', // ✅ REPLY-TO
                            subject: subject,
                            html: html,
                        };

                        await this.sendGrid.send(msg);
                        console.log(`✅ Email sent via SendGrid to: ${email}`);
                        resolve({ success: true, demo: false, attempt: attempt, method: 'sendgrid' });
                        return;
                    } catch (sendGridError) {
                        console.log(`❌ SendGrid failed: ${sendGridError.message}`);
                        if (sendGridError.response) {
                            console.log('SendGrid Response Body:', sendGridError.response.body);
                            console.log('SendGrid Response Code:', sendGridError.response.statusCode);
                        }
                        console.log('Falling back to SMTP...');
                    }
                }

                // Fallback to SMTP
                if (this.transporter) {
                    const mailOptions = {
                        from: process.env.EMAIL_FROM || 'KaosSub <noreply@kaossub.com>',
                        to: email,
                        subject: subject,
                        html: html,
                    };

                    await this.transporter.sendMail(mailOptions);
                    console.log(`✅ Email sent via SMTP to: ${email} (Attempt ${attempt})`);
                    resolve({ success: true, demo: false, attempt: attempt, method: 'smtp' });
                    return;
                } else {
                    throw new Error('No email transport available');
                }

            } catch (error) {
                console.error(`❌ Email send failed (Attempt ${attempt}/${retries} to ${email}):`, error.message);

                if (attempt === retries) {
                    // Final fallback to demo mode
                    console.log(`📧 DEMO: Email would be sent to: ${email}`);
                    console.log('   - Subject:', subject);
                    resolve({
                        success: true,
                        demo: true,
                        error: 'Production email failed, logged to console',
                        method: 'demo'
                    });
                    return;
                }

                // Wait before retry (exponential backoff)
                const backoffTime = 1000 * attempt * attempt;
                console.log(`🔄 Retrying in ${backoffTime/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
    }

    // Enhanced queue processing with better error handling
    async processQueue() {
        if (this.sending) return;

        this.sending = true;

        while (this.emailQueue.length > 0) {
            // Check rate limit
            const now = Date.now();
            if (now - this.rateLimit.lastReset > 60000) { // 1 minute
                this.rateLimit.emailsSent = 0;
                this.rateLimit.lastReset = now;
            }

            if (this.rateLimit.emailsSent >= this.rateLimit.maxEmailsPerMinute) {
                // Wait until next minute
                const waitTime = 60000 - (now - this.rateLimit.lastReset);
                console.log(`⏳ Rate limit reached. Waiting ${Math.ceil(waitTime/1000)} seconds...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            const emailData = this.emailQueue.shift();
            await this.sendEmailWithRetry(
                emailData.email,
                emailData.subject,
                emailData.html,
                emailData.resolve
            );
            this.rateLimit.emailsSent++;
        }

        this.sending = false;
    }

    // ✅ UPDATED: Simplified status method
    getStatus() {
        const providers = [];
        if (this.sendGridEnabled) providers.push('sendgrid');
        if (this.transporter) providers.push('smtp');
        providers.push('demo');

        return {
            demoMode: this.demoMode,
            queueLength: this.emailQueue.length,
            rateLimit: this.rateLimit,
            sending: this.sending,
            sendGridEnabled: this.sendGridEnabled,
            smtpEnabled: !!this.transporter,
            availableMethods: providers,
            providerPriority: ['sendgrid', 'smtp', 'demo']
        };
    }

    // Validate email format
    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // ✅ IMPROVED: Send OTP email with better subject lines
    async sendOTPEmail(email, otpCode, userName = 'Admin', retries = 3) {
        // ✅ IMPROVED SUBJECT LINES
        const subject = `Your KaosSub Login Code: ${otpCode}`;
        const html = this.generateOTPEmailTemplate(otpCode, userName);

        // Validate email
        if (!this.validateEmail(email)) {
            console.error('❌ Invalid email address:', email);
            return { success: false, error: 'Invalid email address' };
        }

        // Use queue for rate limiting in production
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }

        // Demo mode with retry simulation
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`📧 DEMO (Attempt ${attempt}/${retries}): OTP Email would be sent:`);
                console.log('   - To:', email);
                console.log('   - OTP:', otpCode);
                console.log('   - Subject:', subject);

                // Simulate random failures in demo mode for testing
                if (process.env.EMAIL_DEMO_FAILURES === 'true' && Math.random() < 0.2 && attempt < retries) {
                    throw new Error('Demo mode: Simulated email failure');
                }

                return {
                    success: true,
                    demo: true,
                    otp: otpCode,
                    attempt: attempt
                };

            } catch (error) {
                console.error(`❌ Demo email send failed (Attempt ${attempt}/${retries}):`, error.message);
                if (attempt === retries) {
                    return {
                        success: false,
                        error: error.message,
                        demo: true
                    };
                }
                // Wait before retry (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
    }

    // Queue email for rate limiting
    async queueEmail(email, subject, html) {
        return new Promise((resolve) => {
            this.emailQueue.push({ email, subject, html, resolve });
            if (!this.sending) {
                this.processQueue();
            }
        });
    }

    // Send admin notification email
    async sendAdminNotification(subject, message, retries = 3) {
        const adminEmail = process.env.ADMIN_EMAIL;

        if (!adminEmail) {
            console.log('📧 DEMO: Admin notification would be sent:');
            console.log('   - Subject:', subject);
            console.log('   - Message:', message);
            return { success: true, demo: true };
        }

        const html = this.generateAdminNotificationTemplate(subject, message);
        return await this.sendOTPEmail(adminEmail, 'N/A', 'Administrator', retries);
    }

    // ✅ FIXED: Send welcome email
    async sendWelcomeEmail(email, userName) {
        const subject = `Welcome to KaosSub, ${userName}!`;
        const html = this.generateWelcomeEmailTemplate(userName);
        
        // ✅ FIX: Use queueEmail directly instead of sendOTPEmail
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Welcome Email would be sent:`);
        console.log('   - To:', email);
        console.log('   - Subject:', subject);
        console.log('   - User:', userName);
        
        return {
            success: true,
            demo: true,
            message: 'Demo mode - Welcome email logged to console'
        };
    }

    // ✅ FIXED: Send password reset email
    async sendPasswordResetEmail(email, resetToken, userName) {
        const subject = `KaosSub Password Reset - Secure Your Account`;
        const html = this.generatePasswordResetTemplate(resetToken, userName);
        
        // ✅ FIX: Use queueEmail directly instead of sendOTPEmail
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Password Reset Email would be sent:`);
        console.log('   - To:', email);
        console.log('   - Subject:', subject);
        console.log('   - User:', userName);
        
        return {
            success: true,
            demo: true,
            message: 'Demo mode - Password reset email logged to console'
        };
    }

    // ✅ FIXED: Send order confirmation email
    async sendOrderConfirmation(email, orderDetails, userName) {
        const subject = `Order Confirmed! - ${orderDetails.reference}`;
        const html = this.generateOrderConfirmationTemplate(orderDetails, userName);
        
        // ✅ FIX: Use queueEmail directly instead of sendOTPEmail
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Order Confirmation Email would be sent:`);
        console.log('   - To:', email);
        console.log('   - Subject:', subject);
        console.log('   - Order:', orderDetails.reference);
        
        return {
            success: true,
            demo: true,
            message: 'Demo mode - Order confirmation email logged to console'
        };
    }

    // ✅ FIXED: Send registration OTP email
    async sendRegistrationOTPEmail(email, otpCode, userName = 'User') {
        const subject = `Verify Your KaosSub Account - Code: ${otpCode}`;
        const html = this.generateRegistrationOTPEmailTemplate(userName, otpCode);
        
        // ✅ This one is correct - it uses the registration template
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Registration OTP Email would be sent:`);
        console.log('   - To:', email);
        console.log('   - OTP:', otpCode);
        console.log('   - Subject:', subject);
        console.log('   - User:', userName);
        
        return {
            success: true,
            demo: true,
            otp: otpCode,
            message: 'Demo mode - Registration OTP logged to console'
        };
    }

    // ✅ ADD: Send password change notification email
    async sendPasswordChangeNotification(email, userName, changeTime) {
        const subject = `KaosSub Password Updated Successfully`;
        const html = this.generatePasswordChangeNotificationTemplate(userName, changeTime);
        
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Password Change Notification would be sent:`);
        console.log('   - To:', email);
        console.log('   - Subject:', subject);
        console.log('   - User:', userName);
        console.log('   - Change Time:', changeTime);
        
        return {
            success: true,
            demo: true,
            message: 'Demo mode - Password change notification logged to console'
        };
    }

    // ✅ ADD: Send wallet top-up confirmation email
    async sendWalletTopupEmail(email, topupDetails, userName) {
        const subject = `Wallet Top-up Successful! - ${topupDetails.reference}`;
        const html = this.generateWalletTopupTemplate(topupDetails, userName);
        
        if (!this.demoMode) {
            return await this.queueEmail(email, subject, html);
        }
        
        // Demo mode
        console.log(`📧 DEMO: Wallet Top-up Email would be sent:`);
        console.log('   - To:', email);
        console.log('   - Subject:', subject);
        console.log('   - Amount:', topupDetails.amount);
        
        return {
            success: true,
            demo: true,
            message: 'Demo mode - Wallet top-up email logged to console'
        };
    }

    // ✅ ADD: Generate password change notification template
    generatePasswordChangeNotificationTemplate(userName, changeTime) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    border: 1px solid #e0e0e0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .logo {
                    color: #28a745;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .success-badge {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    font-size: 20px;
                    font-weight: bold;
                    text-align: center;
                    margin: 20px 0;
                    box-shadow: 0 5px 15px rgba(40,167,69,0.3);
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #f0f0f0;
                }
                .info-box {
                    background: #d1ecf1;
                    border: 1px solid #bee5eb;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #0c5460;
                }
                .user-greeting {
                    font-size: 18px;
                    color: #333;
                    margin-bottom: 20px;
                }
                @media (max-width: 600px) {
                    .container { padding: 20px; margin: 10px; }
                    .success-badge { font-size: 18px; padding: 12px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <h2 style="color: #333; margin-top: 20px;">Password Updated</h2>
                </div>

                <p class="user-greeting">Hello <strong>${userName}</strong>,</p>

                <div class="success-badge">
                    ✅ Password Updated Successfully
                </div>

                <p style="color: #555; line-height: 1.6;">
                    Your KaosSub account password has been successfully updated.
                </p>

                <div class="info-box">
                    <strong>📅 Change Time:</strong> ${changeTime}<br>
                    <strong>🔐 Security:</strong> Your account is now secured with your new password
                </div>

                <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                    <strong>⚠️ Security Notice:</strong> If you didn't make this change, please 
                    <a href="mailto:support@kaossub.com" style="color: #dc3545; font-weight: bold;">contact support immediately</a>.
                </div>

                <p style="color: #555; line-height: 1.6;">
                    Thank you for keeping your account secure!
                </p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                    <p>This is an automated security notification.</p>
                </div>
            </div>

            <!-- ✅ ADD HIDDEN TEXT FOR SPAM FILTERS -->
            <div style="display:none; font-size:0px; line-height:0px;">
                Password Change Notification User: ${userName} Time: ${changeTime} KaosSub Security
            </div>
        </body>
        </html>
        `;
    }

    // ✅ ADD: Generate wallet top-up template
    generateWalletTopupTemplate(topupDetails, userName) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    border: 1px solid #e0e0e0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .logo {
                    color: #28a745;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .success-badge {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    font-size: 24px;
                    font-weight: bold;
                    text-align: center;
                    margin: 30px 0;
                    box-shadow: 0 5px 15px rgba(40,167,69,0.3);
                }
                .transaction-details {
                    background: #f8f9fa;
                    padding: 25px;
                    border-radius: 10px;
                    margin: 25px 0;
                    border-left: 4px solid #28a745;
                }
                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid #e9ecef;
                }
                .detail-row:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                }
                .detail-label {
                    font-weight: 600;
                    color: #495057;
                }
                .detail-value {
                    font-weight: 600;
                    color: #28a745;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #f0f0f0;
                }
                .user-greeting {
                    font-size: 18px;
                    color: #333;
                    margin-bottom: 20px;
                }
                .next-steps {
                    background: #e7f3ff;
                    border: 1px solid #cfe2ff;
                    padding: 20px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #084298;
                }
                @media (max-width: 600px) {
                    .container { padding: 20px; margin: 10px; }
                    .success-badge { font-size: 20px; padding: 15px; }
                    .detail-row { flex-direction: column; gap: 5px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <h2 style="color: #333; margin-top: 20px;">Wallet Top-up Successful! 🎉</h2>
                </div>

                <p class="user-greeting">Hello <strong>${userName}</strong>,</p>

                <div class="success-badge">
                    ✅ Payment Received Successfully
                </div>

                <p style="color: #555; line-height: 1.6; text-align: center;">
                    Your wallet has been credited successfully. You can now purchase data bundles instantly!
                </p>

                <div class="transaction-details">
                    <div class="detail-row">
                        <span class="detail-label">Reference:</span>
                        <span class="detail-value">${topupDetails.reference}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Amount:</span>
                        <span class="detail-value">₦${topupDetails.amount}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Transaction Type:</span>
                        <span class="detail-value">Wallet Top-up</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value" style="color: #28a745;">Completed</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Date:</span>
                        <span class="detail-value">${new Date().toLocaleString()}</span>
                    </div>
                </div>

                <div class="next-steps">
                    <h4 style="margin-top: 0; color: #084298;">🚀 What's Next?</h4>
                    <p style="margin: 10px 0;">Your wallet is now funded and ready for instant data purchases!</p>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>Purchase data bundles for all networks</li>
                        <li>Instant activation after purchase</li>
                        <li>24/7 service availability</li>
                    </ul>
                </div>

                <p style="color: #555; line-height: 1.6; text-align: center;">
                    Thank you for choosing KaosSub! If you have any questions, feel free to contact our support team.
                </p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                    <p>This is an automated transaction confirmation.</p>
                </div>
            </div>

            <!-- Hidden text for spam filters -->
            <div style="display:none; font-size:0px; line-height:0px;">
                Wallet Top-up Confirmation Amount: ₦${topupDetails.amount} Reference: ${topupDetails.reference} User: ${userName}
            </div>
        </body>
        </html>
        `;
    }

    // ✅ UPDATED: Generate beautiful OTP email template with hidden text
    generateOTPEmailTemplate(otpCode, userName) {
        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 10;
        const currentDate = new Date().toLocaleString();

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    border: 1px solid #e0e0e0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .logo {
                    color: #007bff;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .tagline {
                    color: #666;
                    font-size: 14px;
                    margin-top: 5px;
                }
                .otp-code {
                    background: linear-gradient(135deg, #007bff, #0056b3);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    font-size: 32px;
                    font-weight: bold;
                    text-align: center;
                    margin: 30px 0;
                    letter-spacing: 8px;
                    font-family: 'Courier New', monospace;
                    box-shadow: 0 5px 15px rgba(0,123,255,0.3);
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #f0f0f0;
                }
                .warning {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #856404;
                }
                .info-box {
                    background: #d1ecf1;
                    border: 1px solid #bee5eb;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #0c5460;
                }
                .user-greeting {
                    font-size: 18px;
                    color: #333;
                    margin-bottom: 20px;
                }
                @media (max-width: 600px) {
                    .container { padding: 20px; margin: 10px; }
                    .otp-code { font-size: 24px; padding: 15px; letter-spacing: 5px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <div class="tagline">Affordable Data Subscriptions</div>
                    <h2 style="color: #333; margin-top: 20px;">Admin Login Verification</h2>
                </div>

                <p class="user-greeting">Hello <strong>${userName}</strong>,</p>

                <p style="color: #555; line-height: 1.6;">You requested to login to the KaosSub Admin Dashboard. Use the OTP code below to complete your login:</p>

                <div class="otp-code">${otpCode}</div>

                <div class="info-box">
                    <strong>⏰ Code Expiry:</strong> This OTP will expire in ${expiryMinutes} minutes.
                </div>

                <div class="warning">
                    <strong>⚠️ Security Notice:</strong> This is a sensitive security code.
                    Do not share it with anyone. KaosSub will never ask for this code.
                </div>

                <p style="color: #555; line-height: 1.6;">
                    If you didn't request this OTP, please ignore this email or
                    <a href="mailto:support@kaossub.com" style="color: #007bff;">contact our support team</a> immediately.
                </p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p style="margin-top: 10px; font-size: 11px; color: #999;">
                        KaosSub Data Services • Secure Admin Authentication
                    </p>
                </div>
            </div>

            <!-- ✅ ADD HIDDEN TEXT FOR SPAM FILTERS -->
            <div style="display:none; font-size:0px; line-height:0px;">
                OTP Code: ${otpCode} User: ${userName} Date: ${currentDate} KaosSub Data Services Nigeria
            </div>
        </body>
        </html>
        `;
    }

    // Generate welcome email template
    generateWelcomeEmailTemplate(userName) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { color: #007bff; font-size: 24px; font-weight: bold; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <h2>Welcome to KaosSub!</h2>
                </div>

                <p>Hello <strong>${userName}</strong>,</p>

                <p>Welcome to KaosSub! Your account has been successfully created.</p>

                <p>You can now:</p>
                <ul>
                    <li>Purchase data bundles for all Nigerian networks</li>
                    <li>Manage your wallet and transactions</li>
                    <li>View your order history</li>
                    <li>Enjoy seamless data subscriptions</li>
                </ul>

                <p>If you have any questions, feel free to contact our support team.</p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

        // Generate password reset template
    generatePasswordResetTemplate(resetToken, userName) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { color: #007bff; font-size: 24px; font-weight: bold; }
                .reset-code { background: #dc3545; color: white; padding: 15px; border-radius: 5px; font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 5px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <h2>Password Reset Request</h2>
                </div>

                <p>Hello <strong>${userName}</strong>,</p>

                <p>You requested to reset your KaosSub password. Use the reset token below:</p>

                <div class="reset-code">${resetToken}</div>

                <div class="warning">
                    <strong>⚠️ Security Notice:</strong> This reset token will expire in 1 hour.
                    If you didn't request this reset, please secure your account immediately.
                </div>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate order confirmation template
    generateOrderConfirmationTemplate(orderDetails, userName) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { color: #28a745; font-size: 24px; font-weight: bold; }
                .order-details { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <h2>Order Confirmation</h2>
                </div>

                <p>Hello <strong>${userName}</strong>,</p>

                <p>Your data purchase has been confirmed!</p>

                <div class="order-details">
                    <p><strong>Reference:</strong> ${orderDetails.reference}</p>
                    <p><strong>Plan:</strong> ${orderDetails.plan}</p>
                    <p><strong>Phone:</strong> ${orderDetails.phone}</p>
                    <p><strong>Amount:</strong> ₦${orderDetails.amount}</p>
                    <p><strong>Status:</strong> ${orderDetails.status}</p>
                </div>

                <p>Your data bundle will be activated shortly. Thank you for choosing KaosSub!</p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Generate admin notification template
    generateAdminNotificationTemplate(subject, message) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { text-align: center; margin-bottom: 30px; }
                .logo { color: #dc3545; font-size: 24px; font-weight: bold; }
                .alert { background: #f8d7da; color: #721c24; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 30px; text-align: center; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub Admin</div>
                    <h2>${subject}</h2>
                </div>

                <div class="alert">
                    <strong>Admin Alert:</strong> ${message}
                </div>

                <p>This is an automated notification from the KaosSub system.</p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    // Clear email queue (for testing)
    clearQueue() {
        this.emailQueue = [];
        console.log('📧 Email queue cleared');
    }

    // ✅ UPDATED: Generate registration OTP email template with hidden text
    generateRegistrationOTPEmailTemplate(userName, otpCode) {
        const expiryMinutes = process.env.OTP_EXPIRY_MINUTES || 10;
        const currentDate = new Date().toLocaleString();

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    margin: 0;
                    padding: 20px;
                    min-height: 100vh;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background: white;
                    padding: 40px;
                    border-radius: 15px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    border: 1px solid #e0e0e0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                    padding-bottom: 20px;
                    border-bottom: 2px solid #f0f0f0;
                }
                .logo {
                    color: #007bff;
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 10px;
                }
                .tagline {
                    color: #666;
                    font-size: 14px;
                    margin-top: 5px;
                }
                .otp-code {
                    background: linear-gradient(135deg, #28a745, #20c997);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    font-size: 32px;
                    font-weight: bold;
                    text-align: center;
                    margin: 30px 0;
                    letter-spacing: 8px;
                    font-family: 'Courier New', monospace;
                    box-shadow: 0 5px 15px rgba(40,167,69,0.3);
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    color: #666;
                    font-size: 12px;
                    padding-top: 20px;
                    border-top: 1px solid #f0f0f0;
                }
                .info-box {
                    background: #d1ecf1;
                    border: 1px solid #bee5eb;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    color: #0c5460;
                }
                .user-greeting {
                    font-size: 18px;
                    color: #333;
                    margin-bottom: 20px;
                }
                .welcome-text {
                    color: #555;
                    line-height: 1.6;
                    margin-bottom: 20px;
                }
                @media (max-width: 600px) {
                    .container { padding: 20px; margin: 10px; }
                    .otp-code { font-size: 24px; padding: 15px; letter-spacing: 5px; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">KaosSub</div>
                    <div class="tagline">Affordable Data Subscriptions</div>
                    <h2 style="color: #333; margin-top: 20px;">Verify Your Account</h2>
                </div>

                <p class="user-greeting">Hello <strong>${userName}</strong>,</p>

                <p class="welcome-text">Welcome to KaosSub! We're excited to have you on board. To complete your registration and start purchasing data bundles, please verify your email address using the OTP code below:</p>

                <div class="otp-code">${otpCode}</div>

                <div class="info-box">
                    <strong>⏰ Code Expiry:</strong> This OTP will expire in ${expiryMinutes} minutes.
                </div>

                <p class="welcome-text">
                    Once verified, you'll be able to:
                </p>
                <ul style="color: #555; line-height: 1.6;">
                    <li>Purchase data bundles for all Nigerian networks</li>
                    <li>Fund your wallet securely</li>
                    <li>Track your order history</li>
                    <li>Enjoy fast and reliable data services</li>
                </ul>

                <p class="welcome-text">
                    If you didn't request this verification, please ignore this email.
                </p>

                <div class="footer">
                    <p>&copy; 2024 KaosSub. All rights reserved.</p>
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p style="margin-top: 10px; font-size: 11px; color: #999;">
                        KaosSub Data Services • Secure Account Verification
                    </p>
                </div>
            </div>

            <!-- ✅ ADD HIDDEN TEXT FOR SPAM FILTERS -->
            <div style="display:none; font-size:0px; line-height:0px;">
                Registration OTP: ${otpCode} User: ${userName} Date: ${currentDate} KaosSub Data Services Nigeria
            </div>
        </body>
        </html>
        `;
    }

    // Send contact form notification
    async sendContactNotification(contactData) {
        try {
            const { name, email, message, submitted_at } = contactData;

            const emailContent = {
                to: process.env.ADMIN_EMAIL || 'support@kaossub.com',
                subject: `New Contact Form Submission from ${name}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #dc3545;">New Contact Form Submission</h2>
                        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px;">
                            <p><strong>Name:</strong> ${name}</p>
                            <p><strong>Email:</strong> ${email}</p>
                            <p><strong>Submitted:</strong> ${new Date(submitted_at).toLocaleString()}</p>
                            <p><strong>Message:</strong></p>
                            <div style="background: white; padding: 15px; border-left: 4px solid #dc3545; margin-top: 10px;">
                                ${message.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                        <p style="margin-top: 20px; color: #666;">
                            This message was sent from the KaosSub contact form.
                        </p>
                    </div>
                `
            };

            // Use the existing sendOTPEmail method which handles both demo and production modes
            const result = await this.sendOTPEmail(
                emailContent.to,
                'CONTACT_FORM', // Using a placeholder since sendOTPEmail expects an OTP
                name,
                3
            );

            // Override the subject for contact form notifications
            if (result.success && !this.demoMode) {
                // In production, we need to send the actual contact form email
                const mailOptions = {
                    from: process.env.EMAIL_FROM || 'KaosSub <noreply@kaossub.com>',
                    to: emailContent.to,
                    subject: emailContent.subject,
                    html: emailContent.html,
                };

                await this.transporter.sendMail(mailOptions);
                console.log('✅ Contact notification email sent successfully');
            } else if (result.success && this.demoMode) {
                console.log('📧 DEMO: Contact notification would be sent:');
                console.log('   - To:', emailContent.to);
                console.log('   - Subject:', emailContent.subject);
                console.log('   - From:', name, `<${email}>`);
            }

            return result;

        } catch (error) {
            console.error('Failed to send contact notification:', error);
            throw error;
        }
    }
}

module.exports = new EmailService();
