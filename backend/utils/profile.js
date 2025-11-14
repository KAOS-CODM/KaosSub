const supabase = require('../config/supabase');

async function ensureProfileExists(userId, email, userMetadata = {}) {
  try {
    // First, try to get the existing profile
    const { data: existingProfile, error: checkError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (!checkError && existingProfile) {
      return existingProfile;
    }

    console.log('Creating missing profile for user:', userId);
    
    const { data: newProfile, error: createError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        email: email,
        full_name: userMetadata.full_name || '',
        phone_number: userMetadata.phone_number || '',
        balance: 0,
        role: 'user'
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating profile:', createError);
      return null;
    }

    return newProfile;
  } catch (error) {
    console.error('Error in ensureProfileExists:', error);
    return null;
  }
}

module.exports = ensureProfileExists;
