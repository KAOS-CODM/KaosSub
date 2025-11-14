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

      // ✅ AUTO-LOGIN: Sign in the user to get session token
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password
      });

      if (signInError) {
        console.error('Auto-login after registration failed:', signInError);
        // Even if auto-login fails, return success but without session
        return successResponse(res, 'Registration successful! Please log in to continue.', {
          profile: {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
            phone_number: profile.phone_number,
            balance: profile.balance || 0
          }
        });
      }

      // Send welcome email
      await emailService.sendWelcomeEmail(email, full_name);

      console.log('✅ User registered successfully:', email);

      // ✅ RETURN SESSION TOKEN
      return successResponse(res, 'Registration successful', {
        profile: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone_number: profile.phone_number,
          balance: profile.balance || 0
        },
        session: {
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
          expires_in: signInData.session.expires_in
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      return errorResponse(res, 'Internal server error during registration', 500);
    }
  }

  // Login user (UNCHANGED)
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

  // Get user profile (UNCHANGED)
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
// Add this method to your AuthController class in authController.js
async changePassword(req, res) {
    try {
        const { current_password, new_password } = req.body;
        const userId = req.user.id;

        if (!current_password || !new_password) {
            return errorResponse(res, 'Current password and new password are required');
        }

        if (new_password.length < 6) {
            return errorResponse(res, 'New password must be at least 6 characters');
        }

        // First, verify the current password by signing in
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: req.user.email,
            password: current_password
        });

        if (signInError) {
            return errorResponse(res, 'Current password is incorrect');
        }

        // Update to new password - this will invalidate the current session
        const { error: updateError } = await supabase.auth.updateUser({
            password: new_password
        });

        if (updateError) {
            console.error('Password update error:', updateError);
            return errorResponse(res, 'Failed to update password');
        }

        // Get a new session for the user
        const { data: newSession, error: newSessionError } = await supabase.auth.signInWithPassword({
            email: req.user.email,
            password: new_password
        });

        if (newSessionError) {
            console.error('New session error:', newSessionError);
            // Even if new session fails, password was updated successfully
            return successResponse(res, 'Password updated successfully! Please log in again.', {
                requires_relogin: true
            });
        }

        return successResponse(res, 'Password updated successfully!', {
            session: {
                access_token: newSession.session.access_token,
                refresh_token: newSession.session.refresh_token
            },
            requires_relogin: false
        });

    } catch (error) {
        console.error('Password change error:', error);
        return errorResponse(res, 'Internal server error during password change', 500);
    }
}

}

module.exports = new AuthController();
