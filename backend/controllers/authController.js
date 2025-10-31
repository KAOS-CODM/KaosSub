const supabase = require('../config/supabase');
const ensureProfileExists = require('../utils/profile');
const { successResponse, errorResponse } = require('../utils/response');
const { validateEmail, validatePhone } = require('../utils/validation');
const otpService = require('../services/otpService');
const emailService = require('../services/emailService');

class AuthController {
  // Register new user with OTP verification
  async register(req, res) {
    try {
      const { email, password, full_name, phone_number, otp_code } = req.body;

      // Validation
      if (!email || !password) {
        return errorResponse(res, 'Email and password are required');
      }

      if (!validateEmail(email)) {
        return errorResponse(res, 'Please provide a valid email address');
      }

      if (password.length < 6) {
        return errorResponse(res, 'Password must be at least 6 characters');
      }

      if (phone_number && !validatePhone(phone_number)) {
        return errorResponse(res, 'Phone number must be 11 digits');
      }

      // Check if OTP is provided and verify it
      if (!otp_code) {
        return errorResponse(res, 'OTP code is required for registration');
      }

      // Verify registration OTP
      const otpResult = await otpService.verifyRegistrationOTP(email, otp_code);
      if (!otpResult.success) {
        return errorResponse(res, otpResult.error || 'OTP verification failed');
      }

      // Check if user already exists
      const { data: existingUser, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return errorResponse(res, 'User already exists with this email');
      }

      // Use regular signUp instead of admin.createUser to avoid automatic profile creation issues
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name: full_name || '',
            phone_number: phone_number || ''
          }
        }
      });

      if (authError) {
        console.error('Auth creation error:', authError);
        return errorResponse(res, authError.message);
      }

      if (!authData.user) {
        return errorResponse(res, 'User registration failed');
      }

      // Use ensureProfileExists to handle profile creation (it checks if profile exists first)
      const profile = await ensureProfileExists(
        authData.user.id,
        email.trim().toLowerCase(),
        { 
          full_name: full_name || '',
          phone_number: phone_number || '' 
        }
      );

      if (!profile) {
        console.error('Profile creation/retrieval failed');
        return errorResponse(res, 'Failed to create user profile');
      }

      // Send welcome email
      await emailService.sendWelcomeEmail(email, full_name);

      console.log('✅ User registered successfully:', email);

      return successResponse(res, 'Registration successful', {
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone_number: profile.phone_number
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return errorResponse(res, 'Internal server error during registration', 500);
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return errorResponse(res, 'Email and password are required');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (error) {
        console.error('Login error:', error);
        let errorMessage = 'Invalid email or password';
        if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please verify your email before logging in';
        }
        return errorResponse(res, errorMessage);
      }

      // Ensure profile exists and get it
      const profile = await ensureProfileExists(
        data.user.id,
        data.user.email,
        data.user.user_metadata
      );

      if (!profile) {
        return errorResponse(res, 'Failed to load user profile', 500);
      }

      return successResponse(res, 'Login successful!', {
        user: data.user,
        profile: profile,
        session: data.session
      });

    } catch (error) {
      console.error('Login error:', error);
      return errorResponse(res, 'Internal server error during login', 500);
    }
  }

  // Get user profile
  async getProfile(req, res) {
    try {
      const profile = await ensureProfileExists(
        req.user.id,
        req.user.email,
        req.user.user_metadata
      );

      if (!profile) {
        return errorResponse(res, 'Failed to load user profile', 500);
      }

      return successResponse(res, 'Profile retrieved successfully', profile);

    } catch (error) {
      console.error('Profile error:', error);
      return errorResponse(res, error.message, 500);
    }
  }
}

module.exports = new AuthController();
