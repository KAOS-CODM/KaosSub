// services/otpService.js - Updated with separate registration OTP table
const supabase = require('../config/supabase');
const emailService = require('./emailService');
const crypto = require('crypto');

class OTPService {
    constructor() {
        this.otpLength = parseInt(process.env.OTP_LENGTH) || 6;
        this.otpExpiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
        this.maxAttemptsPerMinute = parseInt(process.env.MAX_OTP_ATTEMPTS_PER_MINUTE) || 3;
        this.maxFailedAttempts = parseInt(process.env.MAX_FAILED_OTP_ATTEMPTS) || 5;
        this.lockoutMinutes = parseInt(process.env.OTP_LOCKOUT_MINUTES) || 15;
        this.hasIpColumn = false; // Track if IP column exists
        this.hasAttemptsTable = false; // Track if attempts table exists
        this.hasRegistrationTable = false; // Track if registration_otps table exists
        this.checkDatabaseSchema(); // Check schema on startup
    }

    // Check database schema compatibility
    async checkDatabaseSchema() {
        try {
            // Check if admin_otps has ip_address column
            const { error } = await supabase
                .from('admin_otps')
                .select('ip_address')
                .limit(1);

            this.hasIpColumn = !error;
            console.log(`📊 IP column available: ${this.hasIpColumn}`);

            // Check if admin_otp_attempts table exists
            const { error: attemptsError } = await supabase
                .from('admin_otp_attempts')
                .select('id')
                .limit(1);

            this.hasAttemptsTable = !attemptsError;
            console.log(`📊 OTP attempts table available: ${this.hasAttemptsTable}`);

            // Check if registration_otps table exists
            const { error: regError } = await supabase
                .from('registration_otps')
                .select('id')
                .limit(1);

            this.hasRegistrationTable = !regError;
            console.log(`📊 Registration OTP table available: ${this.hasRegistrationTable}`);

        } catch (error) {
            console.log('📊 Schema check failed, using fallback mode');
            this.hasIpColumn = false;
            this.hasAttemptsTable = false;
            this.hasRegistrationTable = false;
        }
    }

    // Cryptographically secure OTP generation
    generateOTP() {
        const digits = '0123456789';
        let otp = '';
        const randomBytes = crypto.randomBytes(this.otpLength);

        for (let i = 0; i < this.otpLength; i++) {
            otp += digits[randomBytes[i] % 10];
        }
        return otp;
    }

    // Validate OTP code format
    validateOTPCode(otpCode) {
        return /^\d{6}$/.test(otpCode); // Exactly 6 digits
    }

    // Rate limiting to prevent OTP spam (with fallback)
    async canRequestOTP(userId, ipAddress = null) {
        try {
            const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

            let query = supabase
                .from('admin_otps')
                .select('created_at')
                .eq('user_id', userId)
                .gt('created_at', oneMinuteAgo);

            // Only include IP if column exists
            if (this.hasIpColumn && ipAddress) {
                query = query.select('created_at, ip_address');
            }

            const { data: recentOTPs, error } = await query;

            if (error) {
                console.error('❌ Rate limit check failed:', error);
                // If it's a column error, use basic rate limiting without IP
                if (error.code === '42703') {
                    this.hasIpColumn = false;
                    return await this.basicRateLimit(userId);
                }
                return false; // Fail safe - don't allow OTP on error
            }

            // Check if user has exceeded rate limit
            if (recentOTPs.length >= this.maxAttemptsPerMinute) {
                console.log(`🚫 Rate limit exceeded for user ${userId}: ${recentOTPs.length} requests in last minute`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Rate limit check error:', error);
            return await this.basicRateLimit(userId); // Fallback to basic rate limiting
        }
    }

    // Basic rate limiting fallback (without IP)
    async basicRateLimit(userId) {
        try {
            const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();

            const { data: recentOTPs, error } = await supabase
                .from('admin_otps')
                .select('created_at')
                .eq('user_id', userId)
                .gt('created_at', oneMinuteAgo);

            if (error) {
                console.error('❌ Basic rate limit check failed:', error);
                return true; // Allow OTP if we can't check rate limit
            }

            return recentOTPs.length < this.maxAttemptsPerMinute;
        } catch (error) {
            console.error('❌ Basic rate limit error:', error);
            return true; // Allow OTP if everything fails
        }
    }

    // Check if user is temporarily locked out (with fallback)
    async isUserLockedOut(userId) {
        if (!this.hasAttemptsTable) {
            return false; // No lockout if attempts table doesn't exist
        }

        try {
            const lockoutTime = new Date(Date.now() - this.lockoutMinutes * 60 * 1000).toISOString();

            const { data: failedAttempts, error } = await supabase
                .from('admin_otp_attempts')
                .select('attempted_at, success')
                .eq('user_id', userId)
                .eq('success', false)
                .gt('attempted_at', lockoutTime);

            if (error) {
                console.error('❌ Lockout check failed:', error);
                return false;
            }

            return failedAttempts.length >= this.maxFailedAttempts;
        } catch (error) {
            console.error('❌ Lockout check error:', error);
            return false;
        }
    }

    // Log OTP attempt for security monitoring (with fallback)
    async logOTPAttempt(userId, otpCode, success, ipAddress = null) {
        if (!this.hasAttemptsTable) {
            return; // Skip logging if table doesn't exist
        }

        try {
            const logData = {
                user_id: userId,
                otp_code: otpCode,
                success: success,
                attempted_at: new Date().toISOString()
            };

            // Only include IP if column exists
            if (ipAddress) {
                logData.ip_address = ipAddress;
            }

            await supabase
                .from('admin_otp_attempts')
                .insert(logData);
        } catch (error) {
            console.error('❌ Failed to log OTP attempt:', error);
        }
    }

    // Create and send OTP for admin login
    async createAdminOTP(userId, userEmail, userName = 'Admin', ipAddress = null) {
        try {
            console.log(`🔐 Creating OTP for admin: ${userEmail}`);

            // Check if user is locked out
            if (await this.isUserLockedOut(userId)) {
                throw new Error(`Account temporarily locked. Please try again in ${this.lockoutMinutes} minutes.`);
            }

            // Check rate limiting
            if (!await this.canRequestOTP(userId, ipAddress)) {
                throw new Error('Too many OTP requests. Please wait a minute before trying again.');
            }

            // Verify user is admin
            if (!await this.isUserAdmin(userId)) {
                throw new Error('Access denied. Admin privileges required.');
            }

            // Generate OTP
            const otpCode = this.generateOTP();
            const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

            // Invalidate any existing OTPs for this user first
            await supabase
                .from('admin_otps')
                .update({ used: true })
                .eq('user_id', userId)
                .eq('used', false);

            // Prepare OTP data
            const otpData = {
                user_id: userId,
                otp_code: otpCode,
                expires_at: expiresAt.toISOString(),
                used: false
            };

            // Only include IP if column exists
            if (this.hasIpColumn && ipAddress) {
                otpData.ip_address = ipAddress;
            }

            // Store OTP in database
            const { data: otpRecord, error } = await supabase
                .from('admin_otps')
                .insert(otpData)
                .select()
                .single();

            if (error) {
                console.error('❌ Failed to create OTP record:', error);
                throw new Error('Failed to create OTP');
            }

            // Send OTP via email
            const emailResult = await emailService.sendOTPEmail(userEmail, otpCode, userName);

            if (!emailResult.success) {
                // If email fails, delete the OTP record
                await supabase
                    .from('admin_otps')
                    .delete()
                    .eq('id', otpRecord.id);

                throw new Error('Failed to send OTP email');
            }

            // Log successful OTP creation
            await this.logOTPAttempt(userId, otpCode, true, ipAddress);

            console.log(`✅ OTP created and sent: ${otpCode} (expires: ${expiresAt.toLocaleString()})`);

            return {
                success: true,
                otp_id: otpRecord.id,
                expires_at: expiresAt,
                demo_mode: emailResult.demo || false,
                message: `OTP sent to ${userEmail}. Valid for ${this.otpExpiryMinutes} minutes.`
            };

        } catch (error) {
            console.error('❌ OTP creation failed:', error);
            // Log failed attempt
            await this.logOTPAttempt(userId, 'REQUEST_FAILED', false, ipAddress);

            throw error;
        }
    }

    // Verify OTP code with enhanced security
    async verifyOTP(userId, otpCode, ipAddress = null) {
        try {
            console.log(`🔍 Verifying OTP for user: ${userId}, code: ${otpCode}`);

            // Validate OTP format
            if (!this.validateOTPCode(otpCode)) {
                await this.logOTPAttempt(userId, otpCode, false, ipAddress);
                return {
                    success: false,
                    error: 'Invalid OTP format. Must be 6 digits.'
                };
            }

            // Check if user is locked out
            if (await this.isUserLockedOut(userId)) {
                return {
                    success: false,
                    error: `Account temporarily locked due to too many failed attempts. Please try again in ${this.lockoutMinutes} minutes.`
                };
            }

            // Find valid OTP
            const { data: otpRecord, error } = await supabase
                .from('admin_otps')
                .select('*')
                .eq('user_id', userId)
                .eq('otp_code', otpCode)
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !otpRecord) {
                console.error('❌ Invalid or expired OTP');
                await this.logOTPAttempt(userId, otpCode, false, ipAddress);
                return {
                    success: false,
                    error: 'Invalid or expired OTP code. Please request a new one.'
                };
            }

            // Mark OTP as used
            await supabase
                .from('admin_otps')
                .update({ used: true })
                .eq('id', otpRecord.id);

            // Log successful verification
            await this.logOTPAttempt(userId, otpCode, true, ipAddress);

            console.log('✅ OTP verified successfully');

            return {
                success: true,
                otp_id: otpRecord.id,
                message: 'OTP verified successfully'
            };

        } catch (error) {
            console.error('❌ OTP verification failed:', error);
            await this.logOTPAttempt(userId, otpCode, false, ipAddress);
            return {
                success: false,
                error: 'OTP verification failed',
                details: error.message
            };
        }
    }

    // Create and send OTP for user registration
    async createRegistrationOTP(email, fullName = 'User', ipAddress = null) {
        try {
            console.log(`🔐 Creating registration OTP for: ${email}`);

            // Check rate limiting by email
            if (!await this.canRequestRegistrationOTP(email, ipAddress)) {
                throw new Error('Too many OTP requests. Please wait a minute before trying again.');
            }

            // Generate OTP
            const otpCode = this.generateOTP();
            const expiresAt = new Date(Date.now() + this.otpExpiryMinutes * 60 * 1000);

            // Use registration_otps table if available, otherwise fallback to admin_otps
            const otpTable = this.hasRegistrationTable ? 'registration_otps' : 'admin_otps';
            
            // Invalidate any existing registration OTPs for this email first
            await supabase
                .from(otpTable)
                .update({ used: true })
                .eq('email', email)
                .eq('used', false);

            // Prepare OTP data for registration
            const otpData = {
                email: email,
                otp_code: otpCode,
                expires_at: expiresAt.toISOString(),
                used: false,
                purpose: 'registration'
            };

            // Only include IP if column exists
            if (this.hasIpColumn && ipAddress) {
                otpData.ip_address = ipAddress;
            }

            // Store OTP in database
            const { data: otpRecord, error } = await supabase
                .from(otpTable)
                .insert(otpData)
                .select()
                .single();

            if (error) {
                console.error('❌ Failed to create registration OTP record:', error);
                throw new Error('Failed to create OTP');
            }

            // Send OTP via email
            const emailResult = await emailService.sendRegistrationOTPEmail(email, otpCode, fullName);

            if (!emailResult.success) {
                // If email fails, delete the OTP record
                await supabase
                    .from(otpTable)
                    .delete()
                    .eq('id', otpRecord.id);

                throw new Error('Failed to send OTP email');
            }

            console.log(`✅ Registration OTP created and sent: ${otpCode} (expires: ${expiresAt.toLocaleString()})`);

            return {
                success: true,
                otp_id: otpRecord.id,
                expires_at: expiresAt,
                demo_mode: emailResult.demo || false,
                message: `OTP sent to ${email}. Valid for ${this.otpExpiryMinutes} minutes.`
            };

        } catch (error) {
            console.error('❌ Registration OTP creation failed:', error);
            throw error;
        }
    }

    // Rate limiting for registration OTP by email
    async canRequestRegistrationOTP(email, ipAddress = null) {
        try {
            const oneMinuteAgo = new Date(Date.now() - 1 * 60 * 1000).toISOString();
            
            // Use registration_otps table if available, otherwise fallback to admin_otps
            const otpTable = this.hasRegistrationTable ? 'registration_otps' : 'admin_otps';

            let query = supabase
                .from(otpTable)
                .select('created_at')
                .eq('email', email)
                .gt('created_at', oneMinuteAgo);

            const { data: recentOTPs, error } = await query;

            if (error) {
                console.error('❌ Registration rate limit check failed:', error);
                return true; // Allow on error
            }

            // Check if email has exceeded rate limit
            if (recentOTPs.length >= this.maxAttemptsPerMinute) {
                console.log(`🚫 Registration rate limit exceeded for email ${email}: ${recentOTPs.length} requests in last minute`);
                return false;
            }

            return true;
        } catch (error) {
            console.error('❌ Registration rate limit check error:', error);
            return true; // Allow on error
        }
    }

    // Verify registration OTP
    async verifyRegistrationOTP(email, otpCode, ipAddress = null) {
        try {
            console.log(`🔍 Verifying registration OTP for email: ${email}, code: ${otpCode}`);

            // Validate OTP format
            if (!this.validateOTPCode(otpCode)) {
                return {
                    success: false,
                    error: 'Invalid OTP format. Must be 6 digits.'
                };
            }

            // Use registration_otps table if available, otherwise fallback to admin_otps
            const otpTable = this.hasRegistrationTable ? 'registration_otps' : 'admin_otps';

            // Find valid registration OTP
            const { data: otpRecord, error } = await supabase
                .from(otpTable)
                .select('*')
                .eq('email', email)
                .eq('otp_code', otpCode)
                .eq('used', false)
                .gt('expires_at', new Date().toISOString())
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (error || !otpRecord) {
                console.error('❌ Invalid or expired registration OTP');
                return {
                    success: false,
                    error: 'Invalid or expired OTP code. Please request a new one.'
                };
            }

            // Mark OTP as used
            await supabase
                .from(otpTable)
                .update({ used: true })
                .eq('id', otpRecord.id);

            console.log('✅ Registration OTP verified successfully');

            return {
                success: true,
                otp_id: otpRecord.id,
                message: 'OTP verified successfully'
            };

        } catch (error) {
            console.error('❌ Registration OTP verification failed:', error);
            return {
                success: false,
                error: 'OTP verification failed',
                details: error.message
            };
        }
    }

    // Clean up expired OTPs and old attempts
    async cleanupExpiredOTPs() {
        try {
            // Clean expired OTPs from admin_otps
            const { error: otpError } = await supabase
                .from('admin_otps')
                .delete()
                .lt('expires_at', new Date().toISOString());

            if (otpError) {
                console.error('❌ Failed to cleanup expired admin OTPs:', otpError);
            }

            // Clean expired OTPs from registration_otps if table exists
            if (this.hasRegistrationTable) {
                const { error: regOtpError } = await supabase
                    .from('registration_otps')
                    .delete()
                    .lt('expires_at', new Date().toISOString());

                if (regOtpError) {
                    console.error('❌ Failed to cleanup expired registration OTPs:', regOtpError);
                }
            }

            // Clean old OTP attempts if table exists
            if (this.hasAttemptsTable) {
                const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { error: attemptsError } = await supabase
                    .from('admin_otp_attempts')
                    .delete()
                    .lt('attempted_at', expiryTime);

                if (attemptsError) {
                    console.error('❌ Failed to cleanup old OTP attempts:', attemptsError);
                }
            }

            console.log('✅ Cleaned up expired OTPs and old attempts');

        } catch (error) {
            console.error('❌ OTP cleanup failed:', error);
        }
    }

    // Check if user has admin role - FIXED VERSION
async isUserAdmin(userId) {
    try {
        console.log(`🔐 Checking admin status for user: ${userId}`);
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id, email, role, full_name')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('❌ Error checking admin status:', error);
            console.log('🔍 Error details:', {
                userId: userId,
                errorCode: error.code,
                errorMessage: error.message
            });
            return false;
        }

        if (!profile) {
            console.log(`❌ No profile found for user: ${userId}`);
            return false;
        }

        const isAdmin = profile.role === 'admin';
        
        console.log(`🔐 Admin check result for ${profile.email}: ${isAdmin} (role: ${profile.role})`);
        
        return isAdmin;
    } catch (error) {
        console.error('❌ Failed to check admin status:', error);
        console.log('🔍 Exception details:', error.stack);
        return false;
    }
}

    // Get OTP statistics for security monitoring
    async getOTPStats(userId) {
        if (!this.hasAttemptsTable) {
            return null;
        }

        try {
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

            const { data: attempts, error } = await supabase
                .from('admin_otp_attempts')
                .select('success, attempted_at')
                .eq('user_id', userId)
                .gt('attempted_at', twentyFourHoursAgo);

            if (error) {
                return null;
            }

            const successful = attempts.filter(a => a.success).length;
            const failed = attempts.filter(a => !a.success).length;

            return {
                total_attempts: attempts.length,
                successful_attempts: successful,
                failed_attempts: failed,
                success_rate: attempts.length > 0 ? (successful / attempts.length * 100).toFixed(1) : 0
            };
        } catch (error) {
            console.error('❌ Error getting OTP stats:', error);
            return null;
        }
    }

    // Check if email already exists in profiles
    async checkEmailExists(email) {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id')
                .eq('email', email)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
                console.error('❌ Error checking email existence:', error);
                return false;
            }

            return !!data; // Returns true if email exists, false if not
        } catch (error) {
            console.error('❌ Error checking email existence:', error);
            return false;
        }
    }
}

module.exports = new OTPService();
